from datetime import date
from django.db import transaction


def is_product_available(product, start_date: date, end_date: date) -> bool:
    """
    Returns True if no availability blocks overlap the requested date range.
    Must be called inside a transaction with SELECT FOR UPDATE on the product row
    to prevent concurrent bookings.
    """
    from apps.products.models import AvailabilityBlock
    return not AvailabilityBlock.objects.filter(
        product=product,
        start_date__lte=end_date,
        end_date__gte=start_date,
    ).exists()


def block_dates_for_booking(product, start_date: date, end_date: date, booking) -> object:
    """Create a booking_hold block. Call inside a transaction."""
    from apps.products.models import AvailabilityBlock
    return AvailabilityBlock.objects.create(
        product=product,
        start_date=start_date,
        end_date=end_date,
        block_type='booking_hold',
        booking=booking,
    )


def get_blocked_dates(product) -> list[dict]:
    """Return all blocked date ranges for a product's availability calendar."""
    from apps.products.models import AvailabilityBlock
    blocks = AvailabilityBlock.objects.filter(product=product).values(
        'id', 'start_date', 'end_date', 'block_type'
    )
    return list(blocks)
