from datetime import date
from django.conf import settings
from django.db import transaction
from apps.bookings.models import Booking, BookingStatusHistory, ALLOWED_TRANSITIONS
from apps.products.models import Product
from services.availability_service import is_product_available, block_dates_for_booking


class BookingError(Exception):
    pass


def compute_booking_totals(product: Product, start_date: date, end_date: date) -> dict:
    """Compute all monetary values server-side. Never trust client amounts."""
    total_days = (end_date - start_date).days + 1
    rental_total = product.price_per_day * total_days
    platform_fee = round(rental_total * settings.PLATFORM_FEE_PERCENT / 100)
    security_deposit = product.security_deposit
    total_charged = rental_total + security_deposit + platform_fee
    return {
        'total_days': total_days,
        'rental_total': rental_total,
        'platform_fee': platform_fee,
        'security_deposit': security_deposit,
        'total_charged': total_charged,
    }


@transaction.atomic
def create_booking(
    product: Product,
    renter,
    start_date: date,
    end_date: date,
    message: str = '',
) -> Booking:
    """
    Create a booking request with overlap prevention.
    Uses SELECT FOR UPDATE to prevent concurrent bookings on the same product.
    """
    if str(product.owner_id) == str(renter.id):
        raise BookingError('You cannot rent your own product.')
    if start_date > end_date:
        raise BookingError('Start date must be before end date.')
    if start_date < date.today():
        raise BookingError('Start date cannot be in the past.')

    min_days = product.min_rental_days
    total_days = (end_date - start_date).days + 1
    if total_days < min_days:
        raise BookingError(f'Minimum rental period for this product is {min_days} day(s).')
    if product.max_rental_days and total_days > product.max_rental_days:
        raise BookingError(f'Maximum rental period is {product.max_rental_days} day(s).')
    if not product.is_active:
        raise BookingError('This product is not currently available for rent.')

    # Lock the product row to prevent concurrent booking creation
    Product.objects.select_for_update().get(pk=product.pk)

    if not is_product_available(product, start_date, end_date):
        raise BookingError('This product is not available for the selected dates.')

    totals = compute_booking_totals(product, start_date, end_date)

    booking = Booking.objects.create(
        product=product,
        renter=renter,
        owner=product.owner,
        start_date=start_date,
        end_date=end_date,
        renter_message=message,
        **totals,
    )
    BookingStatusHistory.objects.create(
        booking=booking,
        status='pending_approval',
        note='Booking request submitted.',
    )
    return booking


@transaction.atomic
def transition_booking(
    booking: Booking,
    new_status: str,
    actor=None,
    note: str = '',
) -> Booking:
    """
    Transition a booking to a new status, enforcing the allowed transition table.
    Always call this instead of setting booking.status directly.
    """
    if not booking.can_transition_to(new_status):
        raise BookingError(
            f"Cannot move booking from '{booking.status}' to '{new_status}'."
        )
    booking.status = new_status
    booking.save(update_fields=['status', 'updated_at'])
    BookingStatusHistory.objects.create(
        booking=booking,
        status=new_status,
        changed_by=actor,
        note=note,
    )
    return booking
