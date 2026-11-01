"""
Integration tests for the booking API views.

Covers:
- Authentication requirements
- Identity verification enforcement
- Double-booking prevention
- State machine transitions (valid and invalid)
- Cancellation policy (grace period and penalty)
- Object-level permission (only parties to a booking may access it)
"""
import pytest
from datetime import date, timedelta
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import IdentityVerification, User, UserProfile
from apps.bookings.models import Booking, CancellationPenalty, FREE_CANCELLATION_WINDOW_MINUTES
from apps.products.models import AvailabilityBlock, Category, Product


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def make_user(db):
    counter = [0]

    def _make(verified=True, **kwargs):
        counter[0] += 1
        n = counter[0]
        user = User.objects.create_user(
            email=f'user{n}@test.com',
            full_name=f'Test User {n}',
            password='testpassword123',
        )
        UserProfile.objects.get_or_create(user=user)
        if verified:
            iv, _ = IdentityVerification.objects.get_or_create(user=user)
            iv.verification_status = IdentityVerification.VERIFIED
            iv.save()
        for attr, val in kwargs.items():
            setattr(user, attr, val)
        user.save()
        return user

    return _make


@pytest.fixture
def make_product(db):
    def _make(owner, price_per_day=500, security_deposit=2000):
        cat, _ = Category.objects.get_or_create(
            slug='test-cat', defaults={'name': 'Test', 'sort_order': 0}
        )
        return Product.objects.create(
            owner=owner,
            category=cat,
            title='Test Bicycle',
            description='A test bicycle for rent.',
            condition='good',
            price_per_day=price_per_day,
            security_deposit=security_deposit,
            pickup_location='Kathmandu',
        )

    return _make


@pytest.fixture
def auth_client(make_user):
    user = make_user()
    c = APIClient()
    c.force_authenticate(user=user)
    return c, user


# ─── Tests: Authentication ────────────────────────────────────────────────────

@pytest.mark.django_db
class TestBookingAuthRequired:
    def test_list_requires_auth(self, client):
        resp = client.get('/api/v1/bookings/')
        assert resp.status_code == 401

    def test_create_requires_auth(self, client):
        resp = client.post('/api/v1/bookings/', {})
        assert resp.status_code == 401


# ─── Tests: Verification enforcement ─────────────────────────────────────────

@pytest.mark.django_db
class TestBookingVerificationRequired:
    def test_unverified_user_cannot_book(self, make_user, make_product):
        owner = make_user(verified=True)
        renter = make_user(verified=False)
        product = make_product(owner=owner)

        c = APIClient()
        c.force_authenticate(user=renter)

        start = (date.today() + timedelta(days=3)).isoformat()
        end = (date.today() + timedelta(days=5)).isoformat()

        resp = c.post('/api/v1/bookings/', {
            'product': str(product.id),
            'start_date': start,
            'end_date': end,
        })
        assert resp.status_code == 403
        assert 'verification' in resp.data.get('error', '').lower()

    def test_pending_verification_cannot_book(self, make_user, make_product):
        owner = make_user(verified=True)
        renter = make_user(verified=False)
        iv, _ = IdentityVerification.objects.get_or_create(user=renter)
        iv.verification_status = IdentityVerification.PENDING
        iv.save()
        product = make_product(owner=owner)

        c = APIClient()
        c.force_authenticate(user=renter)

        resp = c.post('/api/v1/bookings/', {
            'product': str(product.id),
            'start_date': (date.today() + timedelta(days=3)).isoformat(),
            'end_date': (date.today() + timedelta(days=5)).isoformat(),
        })
        assert resp.status_code == 403


# ─── Tests: Basic booking creation ───────────────────────────────────────────

@pytest.mark.django_db
class TestBookingCreation:
    def test_verified_user_can_book(self, make_user, make_product):
        owner = make_user()
        renter = make_user()
        product = make_product(owner=owner)

        c = APIClient()
        c.force_authenticate(user=renter)

        start = (date.today() + timedelta(days=2)).isoformat()
        end = (date.today() + timedelta(days=4)).isoformat()

        resp = c.post('/api/v1/bookings/', {
            'product': str(product.id),
            'start_date': start,
            'end_date': end,
        })
        assert resp.status_code == 201
        data = resp.data
        assert data['status'] == 'pending_approval'
        assert data['total_days'] == 2
        # Verify availability block was created
        assert AvailabilityBlock.objects.filter(
            product=product, block_type='booking_hold'
        ).exists()

    def test_owner_cannot_book_own_product(self, make_user, make_product):
        owner = make_user()
        product = make_product(owner=owner)

        c = APIClient()
        c.force_authenticate(user=owner)

        resp = c.post('/api/v1/bookings/', {
            'product': str(product.id),
            'start_date': (date.today() + timedelta(days=2)).isoformat(),
            'end_date': (date.today() + timedelta(days=4)).isoformat(),
        })
        assert resp.status_code == 400

    def test_past_start_date_rejected(self, make_user, make_product):
        owner = make_user()
        renter = make_user()
        product = make_product(owner=owner)

        c = APIClient()
        c.force_authenticate(user=renter)

        resp = c.post('/api/v1/bookings/', {
            'product': str(product.id),
            'start_date': (date.today() - timedelta(days=1)).isoformat(),
            'end_date': date.today().isoformat(),
        })
        assert resp.status_code == 400

    def test_end_date_before_start_rejected(self, make_user, make_product):
        owner = make_user()
        renter = make_user()
        product = make_product(owner=owner)

        c = APIClient()
        c.force_authenticate(user=renter)

        resp = c.post('/api/v1/bookings/', {
            'product': str(product.id),
            'start_date': (date.today() + timedelta(days=5)).isoformat(),
            'end_date': (date.today() + timedelta(days=3)).isoformat(),
        })
        assert resp.status_code == 400


# ─── Tests: Double-booking prevention ────────────────────────────────────────

@pytest.mark.django_db
class TestDoubleBookingPrevention:
    def test_overlapping_booking_rejected(self, make_user, make_product):
        owner = make_user()
        renter1 = make_user()
        renter2 = make_user()
        product = make_product(owner=owner)

        # First renter books days 5–7
        c1 = APIClient()
        c1.force_authenticate(user=renter1)
        resp1 = c1.post('/api/v1/bookings/', {
            'product': str(product.id),
            'start_date': (date.today() + timedelta(days=5)).isoformat(),
            'end_date': (date.today() + timedelta(days=7)).isoformat(),
        })
        assert resp1.status_code == 201

        # Second renter tries to book overlapping days 6–8
        c2 = APIClient()
        c2.force_authenticate(user=renter2)
        resp2 = c2.post('/api/v1/bookings/', {
            'product': str(product.id),
            'start_date': (date.today() + timedelta(days=6)).isoformat(),
            'end_date': (date.today() + timedelta(days=8)).isoformat(),
        })
        assert resp2.status_code == 400
        assert 'available' in resp2.data.get('error', '').lower()

    def test_adjacent_dates_are_allowed(self, make_user, make_product):
        """A booking ending on day 5 should not block a booking starting on day 5."""
        owner = make_user()
        renter1 = make_user()
        renter2 = make_user()
        product = make_product(owner=owner)

        c1 = APIClient()
        c1.force_authenticate(user=renter1)
        c1.post('/api/v1/bookings/', {
            'product': str(product.id),
            'start_date': (date.today() + timedelta(days=3)).isoformat(),
            'end_date': (date.today() + timedelta(days=5)).isoformat(),
        })

        c2 = APIClient()
        c2.force_authenticate(user=renter2)
        resp2 = c2.post('/api/v1/bookings/', {
            'product': str(product.id),
            'start_date': (date.today() + timedelta(days=5)).isoformat(),
            'end_date': (date.today() + timedelta(days=7)).isoformat(),
        })
        assert resp2.status_code == 201


# ─── Tests: State machine transitions ────────────────────────────────────────

@pytest.mark.django_db
class TestBookingStateMachine:
    def _create_booking(self, owner, renter, product):
        c = APIClient()
        c.force_authenticate(user=renter)
        resp = c.post('/api/v1/bookings/', {
            'product': str(product.id),
            'start_date': (date.today() + timedelta(days=3)).isoformat(),
            'end_date': (date.today() + timedelta(days=5)).isoformat(),
        })
        assert resp.status_code == 201
        return resp.data['id']

    def test_owner_can_approve(self, make_user, make_product):
        owner = make_user()
        renter = make_user()
        product = make_product(owner=owner)
        booking_id = self._create_booking(owner, renter, product)

        c = APIClient()
        c.force_authenticate(user=owner)
        resp = c.post(f'/api/v1/bookings/{booking_id}/approve/')
        assert resp.status_code == 200
        assert resp.data['status'] == 'approved'

    def test_renter_cannot_approve(self, make_user, make_product):
        owner = make_user()
        renter = make_user()
        product = make_product(owner=owner)
        booking_id = self._create_booking(owner, renter, product)

        c = APIClient()
        c.force_authenticate(user=renter)
        resp = c.post(f'/api/v1/bookings/{booking_id}/approve/')
        assert resp.status_code == 404  # Not the owner

    def test_invalid_transition_rejected(self, make_user, make_product):
        """Cannot jump from pending_approval directly to completed."""
        owner = make_user()
        renter = make_user()
        product = make_product(owner=owner)
        booking_id = self._create_booking(owner, renter, product)

        c = APIClient()
        c.force_authenticate(user=owner)
        resp = c.post(f'/api/v1/bookings/{booking_id}/confirm-return/')
        assert resp.status_code == 400

    def test_third_party_cannot_access_booking(self, make_user, make_product):
        """An unrelated user should receive 404, not the booking data."""
        owner = make_user()
        renter = make_user()
        stranger = make_user()
        product = make_product(owner=owner)
        booking_id = self._create_booking(owner, renter, product)

        c = APIClient()
        c.force_authenticate(user=stranger)
        resp = c.get(f'/api/v1/bookings/{booking_id}/')
        assert resp.status_code == 404


# ─── Tests: Cancellation penalty ─────────────────────────────────────────────

@pytest.mark.django_db
class TestCancellationPenalty:
    def _make_pending_booking(self, owner, renter, product):
        c = APIClient()
        c.force_authenticate(user=renter)
        resp = c.post('/api/v1/bookings/', {
            'product': str(product.id),
            'start_date': (date.today() + timedelta(days=3)).isoformat(),
            'end_date': (date.today() + timedelta(days=6)).isoformat(),
        })
        assert resp.status_code == 201
        return resp.data['id']

    def test_cancellation_within_grace_period_no_penalty(self, make_user, make_product):
        """Cancelling within FREE_CANCELLATION_WINDOW_MINUTES from creation: no penalty."""
        owner = make_user()
        renter = make_user()
        product = make_product(owner=owner)
        booking_id = self._make_pending_booking(owner, renter, product)

        c = APIClient()
        c.force_authenticate(user=renter)
        resp = c.post(f'/api/v1/bookings/{booking_id}/cancel/')
        assert resp.status_code == 200
        assert resp.data['status'] == 'cancelled_by_renter'
        # No penalty created (well within 60-minute window)
        assert not CancellationPenalty.objects.filter(booking_id=booking_id).exists()

    def test_cancellation_after_grace_period_creates_penalty(self, make_user, make_product):
        """Simulate post-grace-period cancellation by backdating created_at."""
        from django.utils import timezone
        owner = make_user()
        renter = make_user()
        product = make_product(owner=owner)
        booking_id = self._make_pending_booking(owner, renter, product)

        # Backdate the booking creation beyond the grace period
        Booking.objects.filter(pk=booking_id).update(
            created_at=timezone.now() - timedelta(minutes=FREE_CANCELLATION_WINDOW_MINUTES + 5)
        )

        c = APIClient()
        c.force_authenticate(user=renter)
        resp = c.post(f'/api/v1/bookings/{booking_id}/cancel/')
        assert resp.status_code == 200
        penalty = CancellationPenalty.objects.filter(booking_id=booking_id).first()
        assert penalty is not None
        assert penalty.status == CancellationPenalty.STATUS_PENDING
        # 5% of rental_total (3 days × 500 = 1500 → penalty = 75)
        assert penalty.amount == 75

    def test_outstanding_penalty_blocks_new_booking(self, make_user, make_product):
        """User with unpaid penalty cannot create a new booking."""
        from django.utils import timezone
        owner = make_user()
        renter = make_user()
        product = make_product(owner=owner)
        booking_id = self._make_pending_booking(owner, renter, product)

        # Force a penalty
        Booking.objects.filter(pk=booking_id).update(
            created_at=timezone.now() - timedelta(minutes=FREE_CANCELLATION_WINDOW_MINUTES + 5)
        )
        c = APIClient()
        c.force_authenticate(user=renter)
        c.post(f'/api/v1/bookings/{booking_id}/cancel/')

        # Create a new product and try to book
        product2 = make_product(owner=owner)
        resp = c.post('/api/v1/bookings/', {
            'product': str(product2.id),
            'start_date': (date.today() + timedelta(days=10)).isoformat(),
            'end_date': (date.today() + timedelta(days=12)).isoformat(),
        })
        assert resp.status_code == 403
        assert 'penalty' in resp.data.get('error', '').lower()
