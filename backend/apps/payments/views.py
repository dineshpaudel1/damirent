from datetime import datetime, timezone

from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.throttles import PaymentInitiateThrottle
from apps.bookings.models import Booking, BookingStatusHistory, CancellationPenalty
from services.notification_service import notify_payment_confirmed
from .models import Payment
from .serializers import PaymentSerializer, PaymentInitiateSerializer
from . import khalti


class PaymentInitiateView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [PaymentInitiateThrottle]

    def post(self, request):
        serializer = PaymentInitiateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        booking = get_object_or_404(
            Booking.objects.select_related('renter', 'product'),
            pk=serializer.validated_data['booking'],
            renter=request.user,
        )

        if booking.status not in ('approved', 'payment_pending'):
            return Response(
                {'error': 'Payment can only be initiated for approved bookings.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Idempotency — reuse existing pending/processing payment if present
        existing = booking.payments.filter(status__in=['pending', 'processing']).first()
        if existing:
            payment = existing
        else:
            payment = Payment.objects.create(
                booking=booking,
                payment_type='rental',
                amount=booking.total_charged,
                gateway='khalti',
                status='pending',
            )

        # Transition booking to payment_pending (only if still in approved state)
        if booking.status == 'approved':
            from_status = booking.status
            booking.status = 'payment_pending'
            booking.save(update_fields=['status', 'updated_at'])
            BookingStatusHistory.objects.create(
                booking=booking,
                from_status=from_status,
                status='payment_pending',
                changed_by=request.user,
            )

        # If Khalti keys are not configured, return a mock response for dev
        if not settings.KHALTI_SECRET_KEY:
            callback_base = request.build_absolute_uri('/api/v1/payments/khalti-callback/')
            return Response({
                'payment_url': f'{callback_base}?pidx=DEV-{payment.id}&status=Completed',
                'pidx': f'DEV-{payment.id}',
            })

        return_url = request.build_absolute_uri('/api/v1/payments/khalti-callback/')

        try:
            result = khalti.initiate(
                payment_id=payment.id,
                amount_npr=payment.amount,
                order_name=f'DamiRent – {booking.product.title[:50]}',
                customer_name=booking.renter.full_name,
                customer_email=booking.renter.email,
                return_url=return_url,
            )
        except Exception as e:
            payment.status = 'failed'
            payment.save(update_fields=['status'])
            return Response(
                {'error': f'Payment gateway error: {str(e)}'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        payment.gateway_ref = result.get('pidx', '')
        payment.status = 'processing'
        payment.save(update_fields=['gateway_ref', 'status'])

        return Response({
            'payment_url': result['payment_url'],
            'pidx': result['pidx'],
        })


class KhaltiCallbackView(APIView):
    """
    Khalti redirects the user here after payment (success or failure).
    Query params: pidx, status, transaction_id, tidx, amount, mobile, purchase_order_id, ...
    """
    permission_classes = [AllowAny]

    def get(self, request):
        pidx = request.query_params.get('pidx', '')
        callback_status = request.query_params.get('status', '')

        if not pidx:
            return Response({'error': 'Missing pidx.'}, status=status.HTTP_400_BAD_REQUEST)

        # Dev mock path
        if pidx.startswith('DEV-'):
            payment_id = pidx[4:]
            payment = get_object_or_404(Payment, pk=payment_id)
            if callback_status == 'Completed':
                _complete_payment(payment, txn_id=pidx, raw={})
                return _payment_html_page('completed')
            return _payment_html_page('failed')

        # Real Khalti verification
        payment = Payment.objects.filter(gateway_ref=pidx).first()
        if not payment:
            return Response({'error': 'Payment not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            result = khalti.lookup(pidx)
        except Exception as e:
            return Response({'error': f'Verification failed: {str(e)}'}, status=status.HTTP_502_BAD_GATEWAY)

        payment.raw_callback = result
        payment.save(update_fields=['raw_callback'])

        khalti_status = result.get('status', '')
        txn_id = result.get('transaction_id', '')

        if khalti_status == 'Completed':
            # Verify the amount returned by Khalti matches what we expect.
            # Khalti returns amounts in paisa (1 NPR = 100 paisa).
            expected_paisa = payment.amount * 100
            actual_paisa = result.get('total_amount', 0)
            if actual_paisa != expected_paisa:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(
                    'Khalti amount mismatch: payment_id=%s expected=%d actual=%d',
                    payment.id, expected_paisa, actual_paisa,
                )
                payment.status = 'failed'
                payment.save(update_fields=['status'])
                return _payment_html_page('failed')

            _complete_payment(payment, txn_id=txn_id, raw=result)
            return _payment_html_page('completed')

        if khalti_status in ('Pending', 'Initiated'):
            return _payment_html_page('pending')

        # Failed / User Canceled
        payment.status = 'failed'
        payment.save(update_fields=['status'])
        return _payment_html_page('failed')


def _complete_payment(payment: Payment, txn_id: str, raw: dict) -> None:
    """Mark payment completed and confirm the booking. Idempotent and atomic."""
    from django.db import transaction as db_transaction

    with db_transaction.atomic():
        # Re-fetch with lock inside the transaction to prevent race conditions
        try:
            payment = Payment.objects.select_for_update().get(pk=payment.pk)
        except Payment.DoesNotExist:
            return

        if payment.status == 'completed':
            return

        payment.gateway_txn_id = txn_id
        payment.status = 'completed'
        payment.completed_at = datetime.now(timezone.utc)
        payment.raw_callback = raw
        payment.save(update_fields=['gateway_txn_id', 'status', 'completed_at', 'raw_callback'])

        booking = payment.booking
        if booking.status == 'payment_pending':
            booking.status = 'confirmed'
            booking.save(update_fields=['status', 'updated_at'])
            BookingStatusHistory.objects.create(
                booking=booking,
                from_status='payment_pending',
                status='confirmed',
                changed_by=None,
                note='Payment confirmed via Khalti',
            )
            notify_payment_confirmed(booking)


def _payment_html_page(result: str, deep_link_params: str = '') -> HttpResponse:
    """
    Return a browser-friendly page after Khalti redirects back.
    Also attempts to redirect back into the DamiRent app via deep link.
    """
    if result == 'completed':
        icon, heading, msg, color = '✓', 'Payment Successful', 'Your booking is confirmed. Returning to DamiRent…', '#16a34a'
        deep_link_status = 'Completed'
    elif result == 'pending':
        icon, heading, msg, color = '⏳', 'Payment Pending', 'Your payment is being processed. Returning to DamiRent…', '#d97706'
        deep_link_status = 'Pending'
    else:
        icon, heading, msg, color = '✗', 'Payment Failed', 'Something went wrong. Returning to DamiRent…', '#dc2626'
        deep_link_status = 'Failed'

    # Build the deep link URL to reopen the app on the callback screen.
    # The app's scheme is 'damirent' as configured in app.json.
    deep_link = f'damirent://checkout/callback?status={deep_link_status}'
    if deep_link_params:
        deep_link += f'&{deep_link_params}'

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DamiRent – {heading}</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: #f8fafc; display: flex; align-items: center; justify-content: center;
           min-height: 100vh; padding: 24px; }}
    .card {{ background: white; border-radius: 16px; padding: 40px 32px; max-width: 400px;
             width: 100%; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,.08); }}
    .icon {{ font-size: 56px; margin-bottom: 16px; color: {color}; }}
    h1 {{ font-size: 22px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }}
    p {{ font-size: 15px; color: #64748b; line-height: 1.6; }}
    .btn {{ display: inline-block; margin-top: 24px; padding: 14px 28px;
            background: #1d4ed8; color: white; text-decoration: none;
            border-radius: 10px; font-size: 15px; font-weight: 600; }}
    .brand {{ margin-top: 24px; font-size: 13px; color: #94a3b8; }}
  </style>
  <script>
    // Attempt to open the app immediately via deep link
    window.location.href = '{deep_link}';
    // Fallback: show the manual button after 1.5 s if the redirect didn't work
    setTimeout(function() {{
      var btn = document.getElementById('open-btn');
      if (btn) btn.style.display = 'inline-block';
    }}, 1500);
  </script>
</head>
<body>
  <div class="card">
    <div class="icon">{icon}</div>
    <h1>{heading}</h1>
    <p>{msg}</p>
    <a id="open-btn" href="{deep_link}" class="btn" style="display:none">Return to DamiRent</a>
    <p class="brand">DamiRent</p>
  </div>
</body>
</html>"""
    return HttpResponse(html, content_type='text/html')


class PaymentStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, booking_id):
        booking = get_object_or_404(Booking, pk=booking_id)
        if booking.renter != request.user and booking.owner != request.user:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        payment = booking.payments.order_by('-initiated_at').first()
        if not payment:
            return Response({'error': 'No payment found for this booking.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(PaymentSerializer(payment).data)


class PenaltyPaymentInitiateView(APIView):
    """Initiate a Khalti payment to clear an outstanding cancellation penalty."""
    permission_classes = [IsAuthenticated]

    def post(self, request, penalty_id):
        penalty = get_object_or_404(
            CancellationPenalty,
            pk=penalty_id,
            user=request.user,
            status=CancellationPenalty.STATUS_PENDING,
        )

        # Dev mock — no Khalti keys configured
        if not settings.KHALTI_SECRET_KEY:
            callback_base = request.build_absolute_uri('/api/v1/payments/penalty-callback/')
            return Response({
                'payment_url': f'{callback_base}?pidx=DEVPENALTY-{penalty.id}&status=Completed',
                'pidx': f'DEVPENALTY-{penalty.id}',
            })

        return_url = request.build_absolute_uri('/api/v1/payments/penalty-callback/')

        try:
            result = khalti.initiate(
                payment_id=penalty.id,
                amount_npr=penalty.amount,
                order_name='DamiRent – Cancellation Penalty',
                customer_name=request.user.full_name,
                customer_email=request.user.email,
                return_url=return_url,
            )
        except Exception as e:
            return Response(
                {'error': f'Payment gateway error: {str(e)}'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        penalty.gateway_ref = result.get('pidx', '')
        penalty.save(update_fields=['gateway_ref'])

        return Response({
            'payment_url': result['payment_url'],
            'pidx': result['pidx'],
        })


class PenaltyKhaltiCallbackView(APIView):
    """
    Khalti redirects here after penalty payment.
    Query params: pidx, status  (or pidx=DEVPENALTY-<uuid> in dev mode)
    """
    permission_classes = [AllowAny]

    def get(self, request):
        pidx = request.query_params.get('pidx', '')
        callback_status = request.query_params.get('status', '')

        if not pidx:
            return Response({'error': 'Missing pidx.'}, status=status.HTTP_400_BAD_REQUEST)

        # Dev mock path
        if pidx.startswith('DEVPENALTY-'):
            penalty_id = pidx[len('DEVPENALTY-'):]
            penalty = get_object_or_404(CancellationPenalty, pk=penalty_id)
            if callback_status == 'Completed':
                _complete_penalty_payment(penalty, txn_id=pidx, raw={})
                return _payment_html_page('completed')
            return _payment_html_page('failed')

        # Real Khalti verification
        penalty = CancellationPenalty.objects.filter(gateway_ref=pidx).first()
        if not penalty:
            return Response({'error': 'Penalty payment not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            result = khalti.lookup(pidx)
        except Exception as e:
            return Response({'error': f'Verification failed: {str(e)}'}, status=status.HTTP_502_BAD_GATEWAY)

        khalti_status = result.get('status', '')
        txn_id = result.get('transaction_id', '')

        if khalti_status == 'Completed':
            _complete_penalty_payment(penalty, txn_id=txn_id, raw=result)
            return _payment_html_page('completed')

        if khalti_status in ('Pending', 'Initiated'):
            return _payment_html_page('pending')

        return _payment_html_page('failed')


def _complete_penalty_payment(penalty, txn_id: str, raw: dict) -> None:
    """Mark penalty as paid. Idempotent."""
    if penalty.status == CancellationPenalty.STATUS_PAID:
        return
    penalty.gateway_txn_id = txn_id
    penalty.status = CancellationPenalty.STATUS_PAID
    penalty.paid_at = datetime.now(timezone.utc)
    penalty.save(update_fields=['gateway_txn_id', 'status', 'paid_at'])
