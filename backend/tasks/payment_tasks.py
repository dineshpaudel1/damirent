from celery import shared_task
import logging

logger = logging.getLogger(__name__)


@shared_task(name='tasks.poll_pending_payments', bind=True, max_retries=3)
def poll_pending_payments(self):
    """
    Poll Khalti for payments that have been in 'pending' for over 30 minutes
    but haven't received a webhook callback.
    TODO: Implement Khalti lookup API call.
    """
    from apps.payments.models import Payment
    from django.utils import timezone
    from datetime import timedelta

    cutoff = timezone.now() - timedelta(minutes=30)
    stale = Payment.objects.filter(status='pending', initiated_at__lte=cutoff)
    logger.info(f'Found {stale.count()} stale pending payments to poll.')
    # TODO: For each, call Khalti lookup API and update status
    return f'Polled {stale.count()} stale payments.'


@shared_task(name='tasks.process_deposit_refunds', bind=True, max_retries=5)
def process_deposit_refunds(self, booking_id: str):
    """
    Initiate security deposit refund after a booking is completed.
    Called automatically when a booking transitions to 'completed'.
    """
    from apps.bookings.models import Booking
    from apps.payments.models import Payment
    from services.payment_service import initiate_refund

    try:
        booking = Booking.objects.get(id=booking_id)
        deposit_payment = booking.payments.filter(
            payment_type='security_deposit', status='completed'
        ).first()
        if deposit_payment:
            initiate_refund(deposit_payment, deposit_payment.amount, 'deposit_return')
            logger.info(f'Initiated deposit refund for booking {booking_id}')
    except Exception as exc:
        logger.error(f'Deposit refund failed for {booking_id}: {exc}')
        raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1))
