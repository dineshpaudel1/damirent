"""
Payment integration tests.

Covers:
- Payment initiation requires auth and approved booking
- Idempotent re-initiation (same payment returned)
- Khalti callback: amount mismatch rejected
- Khalti callback: idempotency (double callback safe)
- Khalti dev-mode callback marks booking confirmed
- Unauthorized payment status access
"""
import pytest
from datetime import date, timedelta
from unittest.mock import patch

from apps.accounts.models import IdentityVerification, User, UserProfile
from apps.bookings.models import Booking, BookingStatusHistory
from apps.payments.models import Payment
from apps.products.models import Category, Product


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def make_verified_user(db):
    counter = [0]

    def _make():
        counter[0] += 1
        n = counter[0]
        user = User.objects.create_user(
            email=f'payuser{n}@test.com',
            full_name=f'Pay User {n}',
            password='testpass123',
        )
        UserProfile.objects.get_or_create(user=user)
        iv, _ = IdentityVerification.objects.get_or_create(user=user)
        iv.verification_status = IdentityVerification.VERIFIED
        iv.save()
        return user

    return _make


@pytest.fixture
def make_approved_booking(db, make_verified_user):
    def _make():
        from rest_framework.test import APIClient
        owner = make_verified_user()
        renter = make_verified_user()
        cat, _ = Category.objects.get_or_create(
            slug='pay-cat', defaults={'name': 'Pay Cat', 'sort_order': 0}
        )
        product = Product.objects.create(
            owner=owner, category=cat,
            title='Pay Test Bike', description='Bike',
            condition='good', price_per_day=1000,
            security_deposit=2000, pickup_location='KTM',
        )
        start = date.today() + timedelta(days=2)
        end = date.today() + timedelta(days=4)
        booking = Booking.objects.create(
            product=product, renter=renter, owner=owner,
            start_date=start, end_date=end, total_days=2,
            rental_total=2000, platform_fee=160,
            security_deposit=2000, total_charged=4160,
            status='approved',
        )
        BookingStatusHistory.objects.create(
            booking=booking, from_status=None, status='approved', changed_by=owner,
        )
        return booking, renter, owner

    return _make


# ─── Tests ─────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestPaymentInitiate:
    def test_requires_auth(self, client):
        from rest_framework.test import APIClient
        resp = APIClient().post('/api/v1/payments/initiate/', {'booking': 'fake-id'})
        assert resp.status_code == 401

    def test_requires_approved_booking(self, make_approved_booking):
        from rest_framework.test import APIClient
        booking, renter, _ = make_approved_booking()
        booking.status = 'pending_approval'
        booking.save()

        c = APIClient()
        c.force_authenticate(user=renter)
        resp = c.post('/api/v1/payments/initiate/', {'booking': str(booking.id)})
        assert resp.status_code == 400

    def test_dev_mode_returns_mock_url(self, make_approved_booking, settings):
        from rest_framework.test import APIClient
        settings.KHALTI_SECRET_KEY = ''
        booking, renter, _ = make_approved_booking()

        c = APIClient()
        c.force_authenticate(user=renter)
        resp = c.post('/api/v1/payments/initiate/', {'booking': str(booking.id)})

        assert resp.status_code == 200
        data = resp.data
        assert 'payment_url' in data
        assert 'DEV-' in data['pidx']

        # Booking should move to payment_pending
        booking.refresh_from_db()
        assert booking.status == 'payment_pending'

        # Payment record created
        assert Payment.objects.filter(booking=booking).exists()

    def test_idempotent_reinitiation(self, make_approved_booking, settings):
        """Calling initiate twice returns the same payment."""
        from rest_framework.test import APIClient
        settings.KHALTI_SECRET_KEY = ''
        booking, renter, _ = make_approved_booking()

        c = APIClient()
        c.force_authenticate(user=renter)
        resp1 = c.post('/api/v1/payments/initiate/', {'booking': str(booking.id)})
        resp2 = c.post('/api/v1/payments/initiate/', {'booking': str(booking.id)})

        assert resp1.status_code == 200
        assert resp2.status_code == 200
        # Only one payment record
        assert Payment.objects.filter(booking=booking).count() == 1

    def test_renter_owns_payment_initiation(self, make_approved_booking, make_verified_user, settings):
        """Owner cannot initiate payment for their own booking."""
        from rest_framework.test import APIClient
        settings.KHALTI_SECRET_KEY = ''
        booking, renter, owner = make_approved_booking()

        c = APIClient()
        c.force_authenticate(user=owner)
        resp = c.post('/api/v1/payments/initiate/', {'booking': str(booking.id)})
        assert resp.status_code == 404


@pytest.mark.django_db
class TestKhaltiDevCallback:
    def test_dev_callback_completes_payment(self, make_approved_booking, settings):
        from rest_framework.test import APIClient
        settings.KHALTI_SECRET_KEY = ''
        booking, renter, _ = make_approved_booking()

        c = APIClient()
        c.force_authenticate(user=renter)
        init_resp = c.post('/api/v1/payments/initiate/', {'booking': str(booking.id)})
        pidx = init_resp.data['pidx']

        # Simulate Khalti redirect to our callback
        anon = APIClient()
        cb_resp = anon.get(f'/api/v1/payments/khalti-callback/?pidx={pidx}&status=Completed')
        assert cb_resp.status_code == 200
        assert b'Payment Successful' in cb_resp.content

        booking.refresh_from_db()
        assert booking.status == 'confirmed'

        payment = Payment.objects.get(booking=booking)
        assert payment.status == 'completed'

    def test_dev_callback_idempotent(self, make_approved_booking, settings):
        """Calling the callback twice should not fail or duplicate records."""
        from rest_framework.test import APIClient
        settings.KHALTI_SECRET_KEY = ''
        booking, renter, _ = make_approved_booking()

        c = APIClient()
        c.force_authenticate(user=renter)
        init_resp = c.post('/api/v1/payments/initiate/', {'booking': str(booking.id)})
        pidx = init_resp.data['pidx']

        anon = APIClient()
        anon.get(f'/api/v1/payments/khalti-callback/?pidx={pidx}&status=Completed')
        resp2 = anon.get(f'/api/v1/payments/khalti-callback/?pidx={pidx}&status=Completed')
        # Should still return success (idempotent)
        assert resp2.status_code == 200

        booking.refresh_from_db()
        assert booking.status == 'confirmed'
        assert Payment.objects.filter(booking=booking).count() == 1


@pytest.mark.django_db
class TestKhaltiAmountVerification:
    def test_amount_mismatch_fails_payment(self, make_approved_booking, settings):
        """If Khalti returns a different amount, payment must be rejected."""
        from rest_framework.test import APIClient
        settings.KHALTI_SECRET_KEY = 'real-key'
        booking, renter, _ = make_approved_booking()

        payment = Payment.objects.create(
            booking=booking, payment_type='rental',
            amount=booking.total_charged, gateway='khalti',
            status='processing', gateway_ref='test-pidx-123',
        )

        lookup_response = {
            'status': 'Completed',
            'transaction_id': 'TXN123',
            'total_amount': 999,  # Wrong! Should be 4160 * 100 = 416000
            'pidx': 'test-pidx-123',
        }

        with patch('apps.payments.khalti.lookup', return_value=lookup_response):
            anon = APIClient()
            resp = anon.get(
                '/api/v1/payments/khalti-callback/?pidx=test-pidx-123&status=Completed'
            )
            assert resp.status_code == 200
            assert b'Payment Failed' in resp.content

        payment.refresh_from_db()
        assert payment.status == 'failed'
        booking.refresh_from_db()
        assert booking.status == 'approved'  # Not changed


@pytest.mark.django_db
class TestPaymentStatus:
    def test_renter_can_check_status(self, make_approved_booking, settings):
        from rest_framework.test import APIClient
        settings.KHALTI_SECRET_KEY = ''
        booking, renter, _ = make_approved_booking()

        c = APIClient()
        c.force_authenticate(user=renter)
        c.post('/api/v1/payments/initiate/', {'booking': str(booking.id)})

        resp = c.get(f'/api/v1/payments/{booking.id}/')
        assert resp.status_code == 200
        assert resp.data['status'] in ('pending', 'processing', 'completed')

    def test_stranger_cannot_check_status(self, make_approved_booking, make_verified_user, settings):
        from rest_framework.test import APIClient
        settings.KHALTI_SECRET_KEY = ''
        booking, renter, _ = make_approved_booking()
        stranger = make_verified_user()

        c = APIClient()
        c.force_authenticate(user=renter)
        c.post('/api/v1/payments/initiate/', {'booking': str(booking.id)})

        c2 = APIClient()
        c2.force_authenticate(user=stranger)
        resp = c2.get(f'/api/v1/payments/status/{booking.id}/')
        assert resp.status_code == 404
