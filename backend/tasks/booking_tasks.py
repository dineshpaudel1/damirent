from celery import shared_task
from django.utils import timezone
from datetime import timedelta, date
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


@shared_task(name='tasks.expire_pending_bookings')
def expire_pending_bookings():
    """Auto-expire bookings where owner hasn't responded within the configured window."""
    from apps.bookings.models import Booking
    from services.booking_service import transition_booking, BookingError

    cutoff = timezone.now() - timedelta(hours=settings.OWNER_RESPONSE_WINDOW_HOURS)
    stale = Booking.objects.filter(status='pending_approval', created_at__lte=cutoff)
    expired_count = 0
    for booking in stale:
        try:
            transition_booking(booking, 'expired', note='Auto-expired: no owner response within window.')
            expired_count += 1
        except BookingError as e:
            logger.warning(f'Could not expire booking {booking.id}: {e}')
    return f'Expired {expired_count} pending bookings.'


@shared_task(name='tasks.expire_approved_bookings')
def expire_approved_bookings():
    """Auto-expire approved bookings where renter hasn't paid within the window."""
    from apps.bookings.models import Booking
    from services.booking_service import transition_booking, BookingError

    cutoff = timezone.now() - timedelta(hours=settings.PAYMENT_WINDOW_HOURS)
    stale = Booking.objects.filter(status='approved', updated_at__lte=cutoff)
    expired_count = 0
    for booking in stale:
        try:
            transition_booking(booking, 'expired', note='Auto-expired: payment not completed within window.')
            expired_count += 1
        except BookingError as e:
            logger.warning(f'Could not expire booking {booking.id}: {e}')
    return f'Expired {expired_count} approved bookings.'


@shared_task(name='tasks.activate_confirmed_bookings')
def activate_confirmed_bookings():
    """Transition confirmed bookings to active when their start_date is reached."""
    from apps.bookings.models import Booking
    from services.booking_service import transition_booking, BookingError

    today = date.today()
    due = Booking.objects.filter(status='confirmed', start_date__lte=today)
    activated_count = 0
    for booking in due:
        try:
            transition_booking(booking, 'active', note='Auto-activated: rental period started.')
            activated_count += 1
        except BookingError as e:
            logger.warning(f'Could not activate booking {booking.id}: {e}')
    return f'Activated {activated_count} bookings.'
