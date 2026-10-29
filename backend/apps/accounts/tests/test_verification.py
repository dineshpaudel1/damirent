"""
Tests for profile photo upload and identity verification features.

Covers:
- Profile photo upload / delete
- Identity document submission (valid, invalid type, too large, duplicates)
- Document serving (owner-only, admin-only)
- Verification admin dashboard (access control)
- Approve / reject actions (success, invalid transitions, missing reason)
- Verification status exposure in /users/me/
"""
import io
import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import IdentityVerification, UserProfile

User = get_user_model()

ADMIN_EMAIL = 'paudeldinesh961@gmail.com'

# ── Fixtures ──────────────────────────────────────────────────────────────────


def make_user(email, full_name='Test User', password='testpass123', **kwargs):
    user = User.objects.create_user(email=email, full_name=full_name, password=password, **kwargs)
    UserProfile.objects.get_or_create(user=user)
    return user


def auth_client_for(user):
    client = APIClient()
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token.access_token)}')
    return client


def small_jpeg(name='photo.jpg'):
    """Minimal valid JPEG bytes."""
    data = (
        b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00'
        b'\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t'
        b'\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a'
        b'\x1f\x1e\x1d\x1a\x1c\x1c $.\' ",#\x1c\x1c(7),01444\x1f\'9=82<.342\x1e'
        b'\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f'
        b'\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00'
        b'\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xda\x00\x08\x01\x01'
        b'\x00\x00?\x00\xfb\xd7\xff\xd9'
    )
    return SimpleUploadedFile(name, data, content_type='image/jpeg')


def small_png(name='doc.png'):
    """Minimal 1x1 red PNG."""
    data = (
        b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01'
        b'\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00'
        b'\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18'
        b'\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
    )
    return SimpleUploadedFile(name, data, content_type='image/png')


@pytest.fixture
def regular_user(db):
    return make_user('renter@example.com', full_name='Regular User')


@pytest.fixture
def other_user(db):
    return make_user('other@example.com', full_name='Other User')


@pytest.fixture
def admin_user(db):
    return make_user(ADMIN_EMAIL, full_name='Admin User')


@pytest.fixture
def user_client(regular_user):
    return auth_client_for(regular_user)


@pytest.fixture
def admin_client(admin_user):
    return auth_client_for(admin_user)


@pytest.fixture
def other_client(other_user):
    return auth_client_for(other_user)


# ── Profile photo ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestProfilePhotoUpload:
    URL = '/api/v1/users/me/photo/'

    def test_upload_jpeg_success(self, user_client, regular_user):
        res = user_client.post(
            self.URL,
            {'photo': small_jpeg()},
            format='multipart',
        )
        assert res.status_code == 200
        assert 'avatar' in res.data
        assert res.data['avatar'].endswith('.jpg') or 'photo' in res.data['avatar']
        regular_user.profile.refresh_from_db()
        assert regular_user.profile.profile_photo is not None

    def test_upload_png_success(self, user_client):
        res = user_client.post(
            self.URL,
            {'photo': small_png()},
            format='multipart',
        )
        assert res.status_code == 200
        assert 'avatar' in res.data

    def test_upload_invalid_type_rejected(self, user_client):
        txt = SimpleUploadedFile('bad.txt', b'not an image', content_type='text/plain')
        res = user_client.post(self.URL, {'photo': txt}, format='multipart')
        assert res.status_code == 400
        assert 'error' in res.data

    def test_upload_too_large_rejected(self, user_client):
        big = SimpleUploadedFile(
            'big.jpg',
            b'\xff\xd8\xff' + b'X' * (5 * 1024 * 1024 + 1),
            content_type='image/jpeg',
        )
        res = user_client.post(self.URL, {'photo': big}, format='multipart')
        assert res.status_code == 400

    def test_upload_missing_file_rejected(self, user_client):
        res = user_client.post(self.URL, {}, format='multipart')
        assert res.status_code == 400

    def test_unauthenticated_rejected(self):
        client = APIClient()
        res = client.post(self.URL, {'photo': small_jpeg()}, format='multipart')
        assert res.status_code == 401

    def test_replace_existing_photo(self, user_client, regular_user):
        user_client.post(self.URL, {'photo': small_jpeg()}, format='multipart')
        regular_user.profile.refresh_from_db()
        first_name = regular_user.profile.profile_photo.name

        res = user_client.post(self.URL, {'photo': small_png('new.png')}, format='multipart')
        assert res.status_code == 200
        regular_user.profile.refresh_from_db()
        assert regular_user.profile.profile_photo.name != first_name

    def test_delete_photo(self, user_client, regular_user):
        user_client.post(self.URL, {'photo': small_jpeg()}, format='multipart')
        res = user_client.delete(self.URL)
        assert res.status_code == 204
        regular_user.profile.refresh_from_db()
        assert not regular_user.profile.profile_photo

    def test_delete_no_photo_is_idempotent(self, user_client):
        res = user_client.delete(self.URL)
        assert res.status_code == 204


# ── Identity verification status in /users/me/ ────────────────────────────────

@pytest.mark.django_db
class TestMeVerificationStatus:
    URL = '/api/v1/users/me/'

    def test_default_not_submitted(self, user_client):
        res = user_client.get(self.URL)
        assert res.status_code == 200
        iv = res.data.get('identity_verification')
        assert iv is not None
        assert iv['verification_status'] == 'not_submitted'

    def test_shows_pending_after_submission(self, user_client, regular_user):
        IdentityVerification.objects.create(
            user=regular_user,
            verification_status=IdentityVerification.PENDING,
        )
        res = user_client.get(self.URL)
        assert res.data['identity_verification']['verification_status'] == 'pending'

    def test_shows_verified_after_approval(self, user_client, regular_user, admin_user):
        IdentityVerification.objects.create(
            user=regular_user,
            verification_status=IdentityVerification.VERIFIED,
            verified_by=admin_user,
        )
        res = user_client.get(self.URL)
        assert res.data['identity_verification']['verification_status'] == 'verified'


# ── Identity document submission ──────────────────────────────────────────────

@pytest.mark.django_db
class TestIdentityDocumentSubmit:
    URL = '/api/v1/users/me/identity/'

    def test_submit_valid_documents(self, user_client, regular_user):
        res = user_client.post(
            self.URL,
            {'id_front': small_jpeg('front.jpg'), 'id_back': small_jpeg('back.jpg')},
            format='multipart',
        )
        assert res.status_code == 200
        assert res.data['verification_status'] == 'pending'
        iv = IdentityVerification.objects.get(user=regular_user)
        assert iv.id_front.name is not None
        assert iv.id_back.name is not None

    def test_missing_front_rejected(self, user_client):
        res = user_client.post(
            self.URL,
            {'id_back': small_jpeg('back.jpg')},
            format='multipart',
        )
        assert res.status_code == 400
        assert 'id_front' in res.data.get('field_errors', {})

    def test_missing_back_rejected(self, user_client):
        res = user_client.post(
            self.URL,
            {'id_front': small_jpeg('front.jpg')},
            format='multipart',
        )
        assert res.status_code == 400
        assert 'id_back' in res.data.get('field_errors', {})

    def test_invalid_file_type_rejected(self, user_client):
        bad = SimpleUploadedFile('virus.exe', b'\x4d\x5a', content_type='application/octet-stream')
        res = user_client.post(
            self.URL,
            {'id_front': bad, 'id_back': small_jpeg('back.jpg')},
            format='multipart',
        )
        assert res.status_code == 400

    def test_too_large_document_rejected(self, user_client):
        big = SimpleUploadedFile(
            'front.jpg',
            b'\xff\xd8\xff' + b'X' * (10 * 1024 * 1024 + 1),
            content_type='image/jpeg',
        )
        res = user_client.post(
            self.URL,
            {'id_front': big, 'id_back': small_jpeg('back.jpg')},
            format='multipart',
        )
        assert res.status_code == 400

    def test_cannot_resubmit_while_pending(self, user_client, regular_user):
        IdentityVerification.objects.create(
            user=regular_user,
            verification_status=IdentityVerification.PENDING,
        )
        res = user_client.post(
            self.URL,
            {'id_front': small_jpeg('f.jpg'), 'id_back': small_jpeg('b.jpg')},
            format='multipart',
        )
        assert res.status_code == 400

    def test_cannot_resubmit_if_verified(self, user_client, regular_user, admin_user):
        IdentityVerification.objects.create(
            user=regular_user,
            verification_status=IdentityVerification.VERIFIED,
            verified_by=admin_user,
        )
        res = user_client.post(
            self.URL,
            {'id_front': small_jpeg('f.jpg'), 'id_back': small_jpeg('b.jpg')},
            format='multipart',
        )
        assert res.status_code == 400

    def test_can_resubmit_after_rejection(self, user_client, regular_user, admin_user):
        IdentityVerification.objects.create(
            user=regular_user,
            verification_status=IdentityVerification.REJECTED,
            rejection_reason='Documents unclear.',
            verified_by=admin_user,
        )
        res = user_client.post(
            self.URL,
            {'id_front': small_jpeg('f.jpg'), 'id_back': small_jpeg('b.jpg')},
            format='multipart',
        )
        assert res.status_code == 200
        assert res.data['verification_status'] == 'pending'

    def test_get_status_before_submission(self, user_client):
        res = user_client.get(self.URL)
        assert res.status_code == 200
        assert res.data['verification_status'] == 'not_submitted'

    def test_unauthenticated_rejected(self):
        client = APIClient()
        res = client.post(
            self.URL,
            {'id_front': small_jpeg('f.jpg'), 'id_back': small_jpeg('b.jpg')},
            format='multipart',
        )
        assert res.status_code == 401


# ── Identity document serving ─────────────────────────────────────────────────

@pytest.mark.django_db
class TestIdentityDocumentServe:
    def _submit_docs(self, user):
        """Helper: create a verification record with real files."""
        iv, _ = IdentityVerification.objects.get_or_create(user=user)
        iv.id_front.save('front.jpg', io.BytesIO(small_jpeg().read()), save=False)
        iv.id_back.save('back.jpg', io.BytesIO(small_jpeg().read()), save=False)
        iv.verification_status = IdentityVerification.PENDING
        iv.save()
        return iv

    def test_owner_can_access_own_document(self, user_client, regular_user):
        self._submit_docs(regular_user)
        res = user_client.get('/api/v1/users/me/identity/document/front/')
        assert res.status_code == 200

    def test_owner_can_access_back_document(self, user_client, regular_user):
        self._submit_docs(regular_user)
        res = user_client.get('/api/v1/users/me/identity/document/back/')
        assert res.status_code == 200

    def test_no_document_returns_404(self, user_client):
        res = user_client.get('/api/v1/users/me/identity/document/front/')
        assert res.status_code == 404

    def test_invalid_side_returns_400(self, user_client):
        res = user_client.get('/api/v1/users/me/identity/document/top/')
        assert res.status_code == 400

    def test_unauthenticated_cannot_access(self):
        client = APIClient()
        res = client.get('/api/v1/users/me/identity/document/front/')
        assert res.status_code == 401


# ── Admin verification dashboard ──────────────────────────────────────────────

@pytest.mark.django_db
class TestVerificationDashboard:
    URL = '/api/v1/users/verification/pending/'

    def test_admin_sees_pending_requests(self, admin_client, regular_user):
        IdentityVerification.objects.create(
            user=regular_user,
            verification_status=IdentityVerification.PENDING,
        )
        res = admin_client.get(self.URL)
        assert res.status_code == 200
        assert len(res.data) == 1
        assert res.data[0]['user']['email'] == regular_user.email

    def test_admin_does_not_see_non_pending(self, admin_client, regular_user, admin_user):
        IdentityVerification.objects.create(
            user=regular_user,
            verification_status=IdentityVerification.VERIFIED,
            verified_by=admin_user,
        )
        res = admin_client.get(self.URL)
        assert res.status_code == 200
        assert len(res.data) == 0

    def test_regular_user_forbidden(self, user_client):
        res = user_client.get(self.URL)
        assert res.status_code == 403

    def test_unauthenticated_rejected(self):
        client = APIClient()
        res = client.get(self.URL)
        assert res.status_code == 401

    def test_other_superuser_forbidden(self, db):
        """A staff/superuser without the exact admin email is still denied."""
        staff = make_user('staff@example.com', full_name='Staff', is_staff=True, is_superuser=True)
        client = auth_client_for(staff)
        res = client.get(self.URL)
        assert res.status_code == 403


# ── Admin approve / reject ────────────────────────────────────────────────────

@pytest.mark.django_db
class TestVerificationAction:
    def _approve_url(self, user_id):
        return f'/api/v1/users/verification/{user_id}/approve/'

    def _reject_url(self, user_id):
        return f'/api/v1/users/verification/{user_id}/reject/'

    def test_admin_can_approve(self, admin_client, regular_user):
        iv = IdentityVerification.objects.create(
            user=regular_user,
            verification_status=IdentityVerification.PENDING,
        )
        res = admin_client.post(self._approve_url(regular_user.id))
        assert res.status_code == 200
        iv.refresh_from_db()
        assert iv.verification_status == IdentityVerification.VERIFIED
        assert iv.verified_by is not None
        assert iv.verified_at is not None

    def test_admin_can_reject_with_reason(self, admin_client, regular_user):
        IdentityVerification.objects.create(
            user=regular_user,
            verification_status=IdentityVerification.PENDING,
        )
        res = admin_client.post(
            self._reject_url(regular_user.id),
            {'rejection_reason': 'Documents are blurry.'},
            format='json',
        )
        assert res.status_code == 200
        iv = IdentityVerification.objects.get(user=regular_user)
        assert iv.verification_status == IdentityVerification.REJECTED
        assert iv.rejection_reason == 'Documents are blurry.'

    def test_reject_without_reason_fails(self, admin_client, regular_user):
        IdentityVerification.objects.create(
            user=regular_user,
            verification_status=IdentityVerification.PENDING,
        )
        res = admin_client.post(self._reject_url(regular_user.id), {}, format='json')
        assert res.status_code == 400
        assert 'rejection_reason' in res.data.get('field_errors', {})

    def test_regular_user_cannot_approve(self, user_client, other_user):
        IdentityVerification.objects.create(
            user=other_user,
            verification_status=IdentityVerification.PENDING,
        )
        res = user_client.post(self._approve_url(other_user.id))
        assert res.status_code == 403

    def test_cannot_approve_non_pending(self, admin_client, regular_user, admin_user):
        IdentityVerification.objects.create(
            user=regular_user,
            verification_status=IdentityVerification.VERIFIED,
            verified_by=admin_user,
        )
        res = admin_client.post(self._approve_url(regular_user.id))
        assert res.status_code == 400

    def test_approve_nonexistent_user_returns_404(self, admin_client):
        res = admin_client.post(self._approve_url('00000000-0000-0000-0000-000000000000'))
        assert res.status_code == 404

    def test_user_cannot_self_approve(self, user_client, regular_user):
        IdentityVerification.objects.create(
            user=regular_user,
            verification_status=IdentityVerification.PENDING,
        )
        res = user_client.post(self._approve_url(regular_user.id))
        assert res.status_code == 403

    def test_unauthenticated_cannot_approve(self, regular_user):
        IdentityVerification.objects.create(
            user=regular_user,
            verification_status=IdentityVerification.PENDING,
        )
        client = APIClient()
        res = client.post(self._approve_url(regular_user.id))
        assert res.status_code == 401

    def test_invalid_action_rejected(self, admin_client, regular_user):
        IdentityVerification.objects.create(
            user=regular_user,
            verification_status=IdentityVerification.PENDING,
        )
        res = admin_client.post(f'/api/v1/users/verification/{regular_user.id}/dance/')
        assert res.status_code == 400


# ── Admin document access ─────────────────────────────────────────────────────

@pytest.mark.django_db
class TestAdminDocumentAccess:
    def _submit_docs(self, user):
        iv, _ = IdentityVerification.objects.get_or_create(user=user)
        iv.id_front.save('front.jpg', io.BytesIO(small_jpeg().read()), save=False)
        iv.id_back.save('back.jpg', io.BytesIO(small_jpeg().read()), save=False)
        iv.verification_status = IdentityVerification.PENDING
        iv.save()
        return iv

    def test_admin_can_view_front(self, admin_client, regular_user):
        self._submit_docs(regular_user)
        res = admin_client.get(f'/api/v1/users/verification/{regular_user.id}/document/front/')
        assert res.status_code == 200

    def test_admin_can_view_back(self, admin_client, regular_user):
        self._submit_docs(regular_user)
        res = admin_client.get(f'/api/v1/users/verification/{regular_user.id}/document/back/')
        assert res.status_code == 200

    def test_regular_user_cannot_view_others_documents(self, user_client, other_user):
        self._submit_docs(other_user)
        res = user_client.get(f'/api/v1/users/verification/{other_user.id}/document/front/')
        assert res.status_code == 403

    def test_unauthenticated_cannot_view(self, regular_user):
        self._submit_docs(regular_user)
        client = APIClient()
        res = client.get(f'/api/v1/users/verification/{regular_user.id}/document/front/')
        assert res.status_code == 401

    def test_invalid_side_returns_400(self, admin_client, regular_user):
        self._submit_docs(regular_user)
        res = admin_client.get(f'/api/v1/users/verification/{regular_user.id}/document/diagonal/')
        assert res.status_code == 400


# ── Public profile identity_verified field ────────────────────────────────────

@pytest.mark.django_db
class TestPublicProfileVerifiedBadge:
    def test_verified_user_shows_true(self, admin_client, regular_user, admin_user):
        IdentityVerification.objects.create(
            user=regular_user,
            verification_status=IdentityVerification.VERIFIED,
            verified_by=admin_user,
        )
        res = admin_client.get(f'/api/v1/users/{regular_user.id}/')
        assert res.status_code == 200
        assert res.data['identity_verified'] is True

    def test_unverified_user_shows_false(self, admin_client, regular_user):
        res = admin_client.get(f'/api/v1/users/{regular_user.id}/')
        assert res.status_code == 200
        assert res.data['identity_verified'] is False

    def test_pending_user_shows_false(self, admin_client, regular_user):
        IdentityVerification.objects.create(
            user=regular_user,
            verification_status=IdentityVerification.PENDING,
        )
        res = admin_client.get(f'/api/v1/users/{regular_user.id}/')
        assert res.data['identity_verified'] is False
