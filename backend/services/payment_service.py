import logging
from django.conf import settings
from django.utils import timezone
from apps.payments.models import Payment, Refund
from apps.bookings.models import Booking

logger = logging.getLogger(__name__)


class PaymentError(Exception):
    pass


def initiate_payment(booking: Booking) -> dict:
    """
    Create a pending Payment record and return the gateway payload.
    Production: calls Khalti /epayment/initiate/ API.
    Development: returns a mock payment_url.

    IMPORTANT: Do not call this endpoint directly from the mobile client.
    The client calls our server, the server calls Khalti, and returns the payment_url.
    """
    gateway_ref = f"DR-{booking.id.hex[:12].upper()}"

    payment = Payment.objects.create(
        booking=booking,
        payment_type='rental',
        amount=booking.total_charged,
        gateway='khalti',
        gateway_ref=gateway_ref,
    )

    # TODO: Replace with real Khalti API call
    # POST https://a.khalti.com/api/v2/epayment/initiate/
    # Headers: Authorization: key <KHALTI_SECRET_KEY>
    # Body: {
    #   "return_url": "<our_callback_url>",
    #   "website_url": "https://damirent.com",
    #   "amount": booking.total_charged * 100,  # Khalti uses paisa
    #   "purchase_order_id": gateway_ref,
    #   "purchase_order_name": f"Rental: {booking.product.title}",
    # }
    # Response includes payment_url to redirect the user to

    return {
        'payment_id': str(payment.id),
        'gateway_ref': gateway_ref,
        'amount': booking.total_charged,
        'payment_url': f'https://khalti.com/payment/demo/{gateway_ref}/',  # DEV placeholder
    }


def handle_khalti_callback(payload: dict) -> Payment:
    """
    Idempotently process a Khalti webhook/redirect callback.
    Called after the user completes payment on Khalti's hosted page.
    Duplicate calls with the same transaction ID are silently ignored.
    """
    txn_id = payload.get('transaction_id') or payload.get('tidx')
    gateway_ref = payload.get('purchase_order_id') or payload.get('merchant_order_id')

    if not txn_id or not gateway_ref:
        raise PaymentError('Missing transaction_id or purchase_order_id in callback.')

    # Idempotency: if this txn_id was already processed, return existing record
    existing = Payment.objects.filter(gateway_txn_id=txn_id).first()
    if existing:
        return existing

    try:
        payment = Payment.objects.select_related('booking__product').get(
            gateway_ref=gateway_ref, status='pending'
        )
    except Payment.DoesNotExist:
        raise PaymentError(f'No pending payment found for ref: {gateway_ref}')

    # TODO: Verify HMAC signature from Khalti before trusting the payload
    # signature = payload.get('signature')
    # expected = hmac.new(KHALTI_SECRET_KEY.encode(), gateway_ref.encode(), sha256).hexdigest()
    # if not hmac.compare_digest(signature, expected):
    #     raise PaymentError('Invalid Khalti signature.')

    # TODO: Verify amount — Khalti returns amount in paisa
    # if payload.get('total_amount') != payment.amount * 100:
    #     raise PaymentError('Amount mismatch.')

    payment.gateway_txn_id = txn_id
    payment.status = 'completed'
    payment.completed_at = timezone.now()
    payment.raw_callback = payload
    payment.save()

    return payment


def initiate_refund(payment: Payment, amount: int, reason: str, initiated_by=None) -> Refund:
    """
    Create a Refund record and call Khalti to process the refund.

    Idempotent: if a completed refund already exists for the same payment
    and reason, it returns the existing record without calling Khalti again.

    In dev mode (no KHALTI_SECRET_KEY), marks the refund completed immediately
    without hitting the API — useful for local testing.

    Raises PaymentError if the amount exceeds the original payment or if
    Khalti returns an error that is not retryable.
    """
    if amount <= 0:
        raise PaymentError('Refund amount must be greater than zero.')
    if amount > payment.amount:
        raise PaymentError('Refund amount cannot exceed original payment amount.')

    # Idempotency: don't create a duplicate refund for the same payment + reason
    existing = Refund.objects.filter(
        payment=payment, reason=reason, status='completed'
    ).first()
    if existing:
        logger.info('Refund already completed: refund_id=%s, skipping.', existing.id)
        return existing

    refund = Refund.objects.create(
        payment=payment,
        amount=amount,
        reason=reason,
        initiated_by=initiated_by,
        status='pending',
    )

    # Dev mode: no Khalti key configured — mark completed immediately
    if not getattr(settings, 'KHALTI_SECRET_KEY', ''):
        refund.status = 'completed'
        refund.gateway_refund_id = f'DEV-REFUND-{refund.id.hex[:8].upper()}'
        refund.completed_at = timezone.now()
        refund.save(update_fields=['status', 'gateway_refund_id', 'completed_at'])
        logger.info(
            'DEV refund completed: refund_id=%s, payment_id=%s, amount=%d NPR, reason=%s',
            refund.id, payment.id, amount, reason,
        )
        # Update original payment status to reflect refund
        _update_payment_refund_status(payment, amount)
        return refund

    # Production: call Khalti refund API
    if not payment.gateway_ref:
        refund.status = 'failed'
        refund.save(update_fields=['status'])
        raise PaymentError(
            f'Payment {payment.id} has no gateway_ref (pidx) — cannot issue refund.'
        )

    from apps.payments import khalti
    try:
        result = khalti.refund(pidx=payment.gateway_ref, amount_npr=amount)
    except Exception as exc:
        refund.status = 'failed'
        refund.save(update_fields=['status'])
        logger.error(
            'Khalti refund API error: refund_id=%s, payment_id=%s, error=%s',
            refund.id, payment.id, exc,
        )
        raise PaymentError(f'Khalti refund failed: {exc}') from exc

    refund.gateway_refund_id = result.get('refund_id', '')
    refund.status = 'completed'
    refund.completed_at = timezone.now()
    refund.save(update_fields=['gateway_refund_id', 'status', 'completed_at'])

    logger.info(
        'Khalti refund successful: refund_id=%s, khalti_refund_id=%s, amount=%d NPR',
        refund.id, refund.gateway_refund_id, amount,
    )

    _update_payment_refund_status(payment, amount)
    return refund


def _update_payment_refund_status(payment: Payment, refunded_amount: int) -> None:
    """Update payment status to refunded or partially_refunded."""
    total_refunded = sum(
        r.amount for r in payment.refunds.filter(status='completed')
    )
    if total_refunded >= payment.amount:
        payment.status = 'refunded'
    else:
        payment.status = 'partially_refunded'
    payment.save(update_fields=['status'])
