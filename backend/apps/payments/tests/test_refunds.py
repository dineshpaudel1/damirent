"""
Tests for the refund workflow.

Covers:
- initiate_refund() creates a Refund record and marks it completed in dev mode
- initiate_refund() is idempotent (same payment+reason → existing record returned)
- Refund amount cannot exceed original payment amount
- process_deposit_refunds task triggers a refund from the rental payment
- process_deposit_refunds skips bookings with zero deposit
- Khalti API failure marks refund as failed and raises PaymentError
"""
import pytest
from datetime import date, timedelta
from unittest.mock import patch, MagicMock

from apps.accounts.models import IdentityVerification, User, UserProfile
from apps.bookings.models import Booking, BookingStatusHistory
from apps.payments.models import Payment, Refund
from apps.products.models import Category, Product
from services.payment_service import initiate_refund, PaymentError


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def users(db):
    def make(n):
        u = User.objects.create_user(
            email=f'refund{n}@test.com', full_name=f'User {n}', password='pass'
        )
        UserProfile.objects.get_or_create(user=u)
        iv, _ = IdentityVerification.objects.get_or_create(user=u)
        iv.verification_status = IdentityVerification.VERIFIED
        iv.save()
        return u
    return make


@pytest.fixture
def completed_booking_with_payment(db, users):
    owner = users(1)
    renter = users(2)
    cat, _ = Category.objects.get_or_create(
        slug='ref-cat', defaults={'name': 'Ref', 'sort_order': 0}
    )
    product = Product.objects.create(
        owner=owner, category=cat, title='Refund Bike', description='x',
        condition='good', price_per_day=1000, security_deposit=2000,
        pickup_location='KTM',
    )
    booking = Booking.objects.create(
        product=product, renter=renter, owner=owner,
        start_date=date.today() + timedelta(days=1),
        end_date=date.today() + timedelta(days=3),
        total_days=2, rental_total=2000, platform_fee=160,
        security_deposit=2000, total_charged=4160,
        status='completed',
    )
    payment = Payment.objects.create(
        booking=booking, payment_type='rental',
        amount=4160, gateway='khalti',
        status='completed', gateway_ref='test-pidx-refund',
    )
    return booking, payment, renter


# ─── Tests: initiate_refund() ─────────────────────────────────────────────────

@pytest.mark.django_db
class TestInitiateRefund:
    def test_dev_mode_marks_refund_completed(self, completed_booking_with_payment, settings):
        settings.KHALTI_SECRET_KEY = ''
        _, payment, _ = completed_booking_with_payment
        refund = initiate_refund(payment, amount=2000, reason='deposit_return')

        assert refund.status == 'completed'
        assert refund.gateway_refund_id.startswith('DEV-REFUND-')
        assert refund.completed_at is not None

    def test_dev_mode_updates_payment_to_partially_refunded(self, completed_booking_with_payment, settings):
        settings.KHALTI_SECRET_KEY = ''
        _, payment, _ = completed_booking_with_payment
        initiate_refund(payment, amount=2000, reason='deposit_return')  # 2000 of 4160

        payment.refresh_from_db()
        assert payment.status == 'partially_refunded'

    def test_dev_mode_full_refund_marks_payment_refunded(self, completed_booking_with_payment, settings):
        settings.KHALTI_SECRET_KEY = ''
        _, payment, _ = completed_booking_with_payment
        initiate_refund(payment, amount=4160, reason='cancellation')

        payment.refresh_from_db()
        assert payment.status == 'refunded'

    def test_idempotent_same_payment_same_reason(self, completed_booking_with_payment, settings):
        """Calling twice returns the existing completed refund, no duplicate."""
        settings.KHALTI_SECRET_KEY = ''
        _, payment, _ = completed_booking_with_payment
        r1 = initiate_refund(payment, amount=2000, reason='deposit_return')
        r2 = initiate_refund(payment, amount=2000, reason='deposit_return')

        assert r1.id == r2.id
        assert Refund.objects.filter(payment=payment, reason='deposit_return').count() == 1

    def test_amount_exceeds_payment_raises(self, completed_booking_with_payment, settings):
        settings.KHALTI_SECRET_KEY = ''
        _, payment, _ = completed_booking_with_payment
        with pytest.raises(PaymentError, match='cannot exceed'):
            initiate_refund(payment, amount=9999, reason='deposit_return')

    def test_zero_amount_raises(self, completed_booking_with_payment, settings):
        settings.KHALTI_SECRET_KEY = ''
        _, payment, _ = completed_booking_with_payment
        with pytest.raises(PaymentError, match='greater than zero'):
            initiate_refund(payment, amount=0, reason='deposit_return')

    def test_khalti_api_failure_marks_refund_failed(self, completed_booking_with_payment, settings):
        """If Khalti returns an error, refund is marked failed and PaymentError raised."""
        settings.KHALTI_SECRET_KEY = 'real-key'
        _, payment, _ = completed_booking_with_payment

        import urllib.error
        with patch('apps.payments.khalti.refund', side_effect=urllib.error.URLError('timeout')):
            with pytest.raises(PaymentError, match='Khalti refund failed'):
                initiate_refund(payment, amount=2000, reason='deposit_return')

        refund = Refund.objects.get(payment=payment, reason='deposit_return')
        assert refund.status == 'failed'

    def test_khalti_api_success(self, completed_booking_with_payment, settings):
        """Successful Khalti API call marks refund completed."""
        settings.KHALTI_SECRET_KEY = 'real-key'
        _, payment, _ = completed_booking_with_payment

        mock_result = {'refund_id': 'KTI-REFUND-123', 'status': 'Refunded'}
        with patch('apps.payments.khalti.refund', return_value=mock_result):
            refund = initiate_refund(payment, amount=2000, reason='deposit_return')

        assert refund.status == 'completed'
        assert refund.gateway_refund_id == 'KTI-REFUND-123'
        payment.refresh_from_db()
        assert payment.status == 'partially_refunded'


# ─── Tests: process_deposit_refunds task ─────────────────────────────────────

@pytest.mark.django_db
class TestDepositRefundTask:
    def test_task_refunds_deposit_from_rental_payment(self, completed_booking_with_payment, settings):
        settings.KHALTI_SECRET_KEY = ''
        booking, payment, _ = completed_booking_with_payment

        from tasks.payment_tasks import process_deposit_refunds
        process_deposit_refunds(str(booking.id))

        refund = Refund.objects.get(payment=payment, reason='deposit_return')
        assert refund.status == 'completed'
        assert refund.amount == booking.security_deposit  # 2000

    def test_task_skips_zero_deposit(self, db, users, settings):
        settings.KHALTI_SECRET_KEY = ''
        owner = users(3)
        renter = users(4)
        cat, _ = Category.objects.get_or_create(
            slug='ref-cat2', defaults={'name': 'Ref2', 'sort_order': 1}
        )
        product = Product.objects.create(
            owner=owner, category=cat, title='No-deposit Bike', description='x',
            condition='good', price_per_day=500, security_deposit=0,
            pickup_location='KTM',
        )
        booking = Booking.objects.create(
            product=product, renter=renter, owner=owner,
            start_date=date.today() + timedelta(days=1),
            end_date=date.today() + timedelta(days=2),
            total_days=1, rental_total=500, platform_fee=40,
            security_deposit=0, total_charged=540, status='completed',
        )

        from tasks.payment_tasks import process_deposit_refunds
        process_deposit_refunds(str(booking.id))

        # No refund created
        assert not Refund.objects.filter(payment__booking=booking).exists()

    def test_task_is_idempotent(self, completed_booking_with_payment, settings):
        """Running the task twice should not create duplicate refunds."""
        settings.KHALTI_SECRET_KEY = ''
        booking, payment, _ = completed_booking_with_payment

        from tasks.payment_tasks import process_deposit_refunds
        process_deposit_refunds(str(booking.id))
        process_deposit_refunds(str(booking.id))

        assert Refund.objects.filter(payment=payment, reason='deposit_return').count() == 1
