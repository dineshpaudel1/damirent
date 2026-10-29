import pytest
from datetime import date, timedelta
from services.booking_service import create_booking, transition_booking, BookingError


@pytest.mark.django_db
class TestBookingService:
    def test_cannot_book_own_product(self, create_user, create_product):
        owner = create_user(phone='9801111111', full_name='Owner')
        product = create_product(owner=owner)
        with pytest.raises(BookingError, match='cannot rent your own'):
            create_booking(product, owner, date.today() + timedelta(days=1), date.today() + timedelta(days=2))

    def test_create_booking_computes_totals_server_side(self, create_user, create_product):
        renter = create_user(phone='9802222222', full_name='Renter')
        product = create_product()  # price_per_day=500, security_deposit=2000
        start = date.today() + timedelta(days=1)
        end = date.today() + timedelta(days=3)  # 3 days
        booking = create_booking(product, renter, start, end)
        assert booking.total_days == 3
        assert booking.rental_total == 1500  # 500 * 3
        assert booking.platform_fee == 120   # 8% of 1500
        assert booking.security_deposit == 2000
        assert booking.total_charged == 3620  # 1500 + 2000 + 120
        assert booking.status == 'pending_approval'

    def test_overlapping_booking_rejected(self, create_user, create_product):
        renter1 = create_user(phone='9803333333', full_name='Renter 1')
        renter2 = create_user(phone='9804444444', full_name='Renter 2')
        product = create_product()
        start = date.today() + timedelta(days=5)
        end = date.today() + timedelta(days=7)

        # First booking is created; transition to confirmed to block dates
        b1 = create_booking(product, renter1, start, end)
        transition_booking(b1, 'approved')
        transition_booking(b1, 'payment_pending')
        transition_booking(b1, 'confirmed')

        # Overlap dates — should fail
        from apps.products.models import AvailabilityBlock
        from services.availability_service import block_dates_for_booking
        block_dates_for_booking(product, start, end, b1)

        with pytest.raises(BookingError, match='not available'):
            create_booking(product, renter2, start, end)

    def test_invalid_transition_raises(self, create_user, create_product):
        renter = create_user(phone='9805555555', full_name='Renter')
        product = create_product()
        booking = create_booking(
            product, renter,
            date.today() + timedelta(days=1),
            date.today() + timedelta(days=2),
        )
        with pytest.raises(BookingError, match="Cannot move booking"):
            transition_booking(booking, 'completed')  # Cannot jump from pending_approval to completed

    def test_past_start_date_rejected(self, create_user, create_product):
        renter = create_user(phone='9806666666', full_name='Renter')
        product = create_product()
        with pytest.raises(BookingError, match='in the past'):
            create_booking(product, renter, date.today() - timedelta(days=1), date.today())
