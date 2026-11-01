from celery import shared_task
import logging

logger = logging.getLogger(__name__)


@shared_task(name='tasks.poll_pending_payments', bind=True, max_retries=3)
def poll_pending_payments(self):
    """
    Poll Khalti for payments that have been in 'pending' or 'processing' for
    over 30 minutes without a callback. This catches cases where the user
    closed the browser before Khalti redirected back.
    """
    from apps.payments.models import Payment
    from apps.payments.views import _complete_payment
    from apps.payments import khalti
    from django.utils import timezone
    from datetime import timedelta
    from django.conf import settings

    if not getattr(settings, 'KHALTI_SECRET_KEY', ''):
        logger.info('poll_pending_payments: skipping in dev mode (no KHALTI_SECRET_KEY).')
        return 'Skipped (dev mode).'

    cutoff = timezone.now() - timedelta(minutes=30)
    stale = Payment.objects.filter(
        status__in=['pending', 'processing'],
        initiated_at__lte=cutoff,
        gateway_ref__gt='',   # must have a pidx to look up
    ).select_related('booking')

    count = stale.count()
    logger.info('poll_pending_payments: found %d stale payment(s) to reconcile.', count)

    resolved = 0
    for payment in stale:
        try:
            result = khalti.lookup(payment.gateway_ref)
            khalti_status = result.get('status', '')
            txn_id = result.get('transaction_id', '')

            if khalti_status == 'Completed':
                _complete_payment(payment, txn_id=txn_id, raw=result)
                logger.info(
                    'poll_pending_payments: payment %s completed via lookup.', payment.id
                )
                resolved += 1
            elif khalti_status in ('Expired', 'User canceled', 'Failed'):
                payment.status = 'failed'
                payment.save(update_fields=['status'])
                logger.info(
                    'poll_pending_payments: payment %s marked failed (status=%s).',
                    payment.id, khalti_status,
                )
        except Exception as exc:
            logger.warning(
                'poll_pending_payments: lookup failed for payment %s: %s', payment.id, exc
            )

    return f'Polled {count} stale payment(s), resolved {resolved}.'


@shared_task(name='tasks.process_deposit_refunds', bind=True, max_retries=5)
def process_deposit_refunds(self, booking_id: str):
    """
    Initiate a security deposit refund after a booking is marked completed.

    The deposit is NOT a separate Payment — it is part of the single rental
    Payment (total_charged = rental_total + platform_fee + security_deposit).
    We issue a partial refund of booking.security_deposit from that payment.

    Idempotent: if the refund was already completed, initiate_refund() returns
    the existing record without calling Khalti again.
    """
    from apps.bookings.models import Booking
    from services.payment_service import initiate_refund, PaymentError

    try:
        booking = Booking.objects.get(id=booking_id)
    except Booking.DoesNotExist:
        logger.error('process_deposit_refunds: booking %s not found.', booking_id)
        return

    if booking.security_deposit <= 0:
        logger.info(
            'process_deposit_refunds: booking %s has no deposit, skipping.', booking_id
        )
        return

    # The rental Payment covers total_charged (rent + fee + deposit).
    # We refund the deposit portion from the completed rental payment.
    rental_payment = (
        booking.payments
        .filter(payment_type='rental', status__in=['completed', 'partially_refunded'])
        .order_by('-initiated_at')
        .first()
    )

    if not rental_payment:
        logger.warning(
            'process_deposit_refunds: no completed rental payment for booking %s.', booking_id
        )
        return

    try:
        refund = initiate_refund(
            payment=rental_payment,
            amount=booking.security_deposit,
            reason='deposit_return',
        )
        logger.info(
            'process_deposit_refunds: deposit refund %s for booking %s — status=%s.',
            refund.id, booking_id, refund.status,
        )
    except PaymentError as exc:
        logger.error(
            'process_deposit_refunds: PaymentError for booking %s: %s', booking_id, exc
        )
        # Exponential back-off: 1 min, 2 min, 4 min, 8 min, 16 min
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
    except Exception as exc:
        logger.error(
            'process_deposit_refunds: unexpected error for booking %s: %s', booking_id, exc
        )
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
