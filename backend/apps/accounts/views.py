import mimetypes
import random
import string
from django.conf import settings
from django.core.cache import cache
from django.core.mail import send_mail
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils.timezone import now
from rest_framework import status, generics, permissions
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from .models import IdentityVerification, User, UserProfile, PushToken
from .serializers import (
    UserRegistrationSerializer, LoginSerializer, MeSerializer,
    SendOTPSerializer, VerifyOTPSerializer, PasswordResetConfirmSerializer,
    PushTokenSerializer, PublicUserSerializer,
    IdentityVerificationStatusSerializer, VerificationAdminListSerializer,
    UserAdminSerializer,
)

# ── File upload constraints ───────────────────────────────────────────────────

ALLOWED_PHOTO_TYPES = {'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'}
ALLOWED_DOC_TYPES = {'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'}
MAX_PHOTO_BYTES = 5 * 1024 * 1024   # 5 MB
MAX_DOC_BYTES = 10 * 1024 * 1024    # 10 MB


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {'refresh': str(refresh), 'access': str(refresh.access_token)}


def generate_otp() -> str:
    return ''.join(random.choices(string.digits, k=6))


def otp_cache_key(email: str, purpose: str) -> str:
    return f'otp:{purpose}:{email}'


def send_otp_email(email: str, otp: str, purpose: str) -> None:
    subject = 'Your DamiRent verification code'
    if purpose == 'password_reset':
        subject = 'Your DamiRent password reset code'
    message = (
        f'Your DamiRent verification code is: {otp}\n\n'
        f'This code expires in 5 minutes. Do not share it with anyone.'
    )
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )
    except Exception as exc:
        if not getattr(settings, 'OTP_DEV_MODE', False):
            raise exc


def is_verification_admin(user) -> bool:
    """Check whether `user` is a staff/superuser.

    Staff status is set via Django admin or management commands — never from
    client-supplied claims.
    """
    return bool(user and user.is_authenticated and (user.is_staff or user.is_superuser))


def _serve_document(doc_field):
    """Return a FileResponse for a document FileField, or None if unavailable."""
    if not doc_field or not doc_field.name:
        return None
    try:
        content_type, _ = mimetypes.guess_type(doc_field.name)
        return FileResponse(
            doc_field.open('rb'),
            content_type=content_type or 'application/octet-stream',
        )
    except Exception:
        return None


# ── Auth views ────────────────────────────────────────────────────────────────

class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        otp = generate_otp()
        key = otp_cache_key(user.email, 'registration')
        cache.set(key, {'code': otp, 'attempts': 0}, timeout=settings.OTP_EXPIRY_SECONDS)

        send_otp_email(user.email, otp, 'registration')

        response_data = {'message': f'OTP sent to {user.email}.'}
        if getattr(settings, 'OTP_DEV_MODE', False):
            response_data['otp'] = otp

        return Response(response_data, status=status.HTTP_201_CREATED)


class SendOTPView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = SendOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        purpose = serializer.validated_data['purpose']

        otp = generate_otp()
        key = otp_cache_key(email, purpose)
        cache.set(key, {'code': otp, 'attempts': 0}, timeout=settings.OTP_EXPIRY_SECONDS)

        send_otp_email(email, otp, purpose)

        response_data = {'message': f'OTP sent to {email}.'}
        if getattr(settings, 'OTP_DEV_MODE', False):
            response_data['otp'] = otp

        return Response(response_data)


class VerifyOTPView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        code = serializer.validated_data['otp']
        purpose = serializer.validated_data['purpose']

        key = otp_cache_key(email, purpose)
        cached = cache.get(key)

        if not cached:
            return Response(
                {'error': 'OTP expired or not found. Please request a new one.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if cached['attempts'] >= settings.OTP_MAX_ATTEMPTS:
            cache.delete(key)
            return Response(
                {'error': 'Too many incorrect attempts. Please request a new OTP.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if cached['code'] != code:
            cached['attempts'] += 1
            cache.set(key, cached, timeout=settings.OTP_EXPIRY_SECONDS)
            remaining = settings.OTP_MAX_ATTEMPTS - cached['attempts']
            return Response(
                {'error': f'Invalid OTP. {remaining} attempt(s) remaining.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cache.delete(key)

        if purpose == 'registration':
            User.objects.filter(email=email).update(is_verified=True)

        return Response({'message': 'OTP verified successfully.'})


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        tokens = get_tokens_for_user(user)
        return Response({**tokens, 'user': MeSerializer(user, context={'request': request}).data})


class LogoutView(APIView):
    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response(
                {'error': 'Refresh token is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError:
            pass
        return Response({'message': 'Logged out successfully.'})


class TokenRefreshView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response(
                {'error': 'Refresh token is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            token = RefreshToken(refresh_token)
            return Response({'access': str(token.access_token)})
        except TokenError as e:
            return Response({'error': str(e)}, status=status.HTTP_401_UNAUTHORIZED)


class PasswordResetInitiateView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = SendOTPSerializer(data={**request.data, 'purpose': 'password_reset'})
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']

        generic_msg = {'message': 'If this email is registered, a reset code has been sent.'}

        if not User.objects.filter(email=email).exists():
            return Response(generic_msg)

        otp = generate_otp()
        key = otp_cache_key(email, 'password_reset')
        cache.set(key, {'code': otp, 'attempts': 0}, timeout=settings.OTP_EXPIRY_SECONDS)
        send_otp_email(email, otp, 'password_reset')

        if getattr(settings, 'OTP_DEV_MODE', False):
            generic_msg['otp'] = otp

        return Response(generic_msg)


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        code = serializer.validated_data['otp']
        new_password = serializer.validated_data['new_password']

        key = otp_cache_key(email, 'password_reset')
        cached = cache.get(key)

        if not cached or cached['code'] != code:
            return Response(
                {'error': 'Invalid or expired OTP.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cache.delete(key)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        user.set_password(new_password)
        user.save(update_fields=['password'])
        return Response({'message': 'Password reset successfully.'})


# ── User profile views ────────────────────────────────────────────────────────

class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = MeSerializer

    def get_object(self):
        return self.request.user

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx


class PublicProfileView(generics.RetrieveAPIView):
    serializer_class = PublicUserSerializer
    queryset = User.objects.select_related('profile', 'identity_verification').all()
    lookup_field = 'id'

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx


class PushTokenView(APIView):
    def post(self, request):
        serializer = PushTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        PushToken.objects.update_or_create(
            token=serializer.validated_data['token'],
            defaults={
                'user': request.user,
                'platform': serializer.validated_data['platform'],
            },
        )
        return Response({'message': 'Push token registered.'}, status=status.HTTP_201_CREATED)

    def delete(self, request):
        token = request.data.get('token')
        if token:
            PushToken.objects.filter(user=request.user, token=token).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Profile photo ─────────────────────────────────────────────────────────────

class ProfilePhotoView(APIView):
    parser_classes = [MultiPartParser]

    def post(self, request):
        photo = request.FILES.get('photo')
        if not photo:
            return Response(
                {'error': 'No photo provided.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if photo.content_type not in ALLOWED_PHOTO_TYPES:
            return Response(
                {'error': 'Invalid file type. Allowed: JPEG, PNG, WEBP, HEIC.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if photo.size > MAX_PHOTO_BYTES:
            return Response(
                {'error': 'Photo must be under 5 MB.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile, _ = UserProfile.objects.get_or_create(user=request.user)

        # Remove the previous photo file to prevent orphaned files
        if profile.profile_photo and profile.profile_photo.name:
            try:
                profile.profile_photo.delete(save=False)
            except Exception:
                pass  # Stale file reference — safe to ignore

        profile.profile_photo = photo
        profile.save(update_fields=['profile_photo'])

        avatar_url = request.build_absolute_uri(profile.profile_photo.url)
        return Response({'avatar': avatar_url}, status=status.HTTP_200_OK)

    def delete(self, request):
        try:
            profile = request.user.profile
        except UserProfile.RelatedObjectDoesNotExist:
            return Response(status=status.HTTP_204_NO_CONTENT)
        if profile.profile_photo and profile.profile_photo.name:
            try:
                profile.profile_photo.delete(save=False)
            except Exception:
                pass
            profile.profile_photo = None
            profile.save(update_fields=['profile_photo'])
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Identity verification ─────────────────────────────────────────────────────

class IdentityVerificationView(APIView):
    parser_classes = [MultiPartParser]

    def get(self, request):
        """Return the current user's verification status (no document URLs)."""
        try:
            verification = request.user.identity_verification
            return Response(IdentityVerificationStatusSerializer(verification).data)
        except IdentityVerification.DoesNotExist:
            return Response({
                'verification_status': IdentityVerification.NOT_SUBMITTED,
                'rejection_reason': '',
                'submitted_at': None,
                'verified_at': None,
            })

    def post(self, request):
        """Submit identity documents for verification."""
        id_front = request.FILES.get('id_front')
        id_back = request.FILES.get('id_back')

        errors = {}
        if not id_front:
            errors['id_front'] = ['Front side of the document is required.']
        if not id_back:
            errors['id_back'] = ['Back side of the document is required.']
        if errors:
            return Response(
                {'error': 'Validation failed.', 'field_errors': errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        for doc, label, key in [(id_front, 'Front', 'id_front'), (id_back, 'Back', 'id_back')]:
            if doc.content_type not in ALLOWED_DOC_TYPES:
                return Response(
                    {
                        'error': 'Validation failed.',
                        'field_errors': {key: [f'{label} document must be JPEG, PNG, HEIC, WebP, or PDF.']},
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if doc.size > MAX_DOC_BYTES:
                return Response(
                    {
                        'error': 'Validation failed.',
                        'field_errors': {key: [f'{label} document must be under 10 MB.']},
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        verification, _ = IdentityVerification.objects.get_or_create(user=request.user)

        if verification.verification_status == IdentityVerification.PENDING:
            return Response(
                {'error': 'Your documents are already under review. Please wait for the result.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if verification.verification_status == IdentityVerification.VERIFIED:
            return Response(
                {'error': 'Your identity is already verified.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Replace existing documents
        if verification.id_front and verification.id_front.name:
            verification.id_front.delete(save=False)
        if verification.id_back and verification.id_back.name:
            verification.id_back.delete(save=False)

        verification.id_front = id_front
        verification.id_back = id_back
        verification.verification_status = IdentityVerification.PENDING
        verification.rejection_reason = ''
        verification.submitted_at = now()
        verification.verified_by = None
        verification.verified_at = None
        verification.save()

        return Response(
            IdentityVerificationStatusSerializer(verification).data,
            status=status.HTTP_200_OK,
        )


class IdentityDocumentView(APIView):
    """Serve a user's own identity document. Documents are never exposed via public URLs."""

    def get(self, request, side):
        if side not in ('front', 'back'):
            return Response(
                {'error': 'Invalid document side. Use "front" or "back".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            verification = request.user.identity_verification
        except IdentityVerification.DoesNotExist:
            return Response(
                {'error': 'No verification record found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        doc_field = verification.id_front if side == 'front' else verification.id_back
        file_response = _serve_document(doc_field)

        if file_response is None:
            return Response(
                {'error': 'Document not yet uploaded.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        return file_response


# ── Admin: verification dashboard ─────────────────────────────────────────────

class VerificationDashboardView(APIView):
    """List pending identity verification requests. Restricted to the designated admin."""

    def get(self, request):
        if not is_verification_admin(request.user):
            return Response(
                {'error': 'You are not authorized to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        pending = (
            IdentityVerification.objects
            .filter(verification_status=IdentityVerification.PENDING)
            .select_related('user', 'user__profile')
            .order_by('submitted_at')
        )

        serializer = VerificationAdminListSerializer(
            pending, many=True, context={'request': request},
        )
        return Response(serializer.data)


class VerificationActionView(APIView):
    """Approve or reject a pending verification. Restricted to the designated admin."""

    def post(self, request, user_id, action):
        if not is_verification_admin(request.user):
            return Response(
                {'error': 'You are not authorized to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if action not in ('approve', 'reject'):
            return Response(
                {'error': 'Invalid action. Use "approve" or "reject".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        verification = get_object_or_404(IdentityVerification, user_id=user_id)

        if verification.verification_status != IdentityVerification.PENDING:
            return Response(
                {'error': 'This verification request is not in a pending state.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if action == 'approve':
            verification.verification_status = IdentityVerification.VERIFIED
            verification.rejection_reason = ''
        else:
            rejection_reason = request.data.get('rejection_reason', '').strip()
            if not rejection_reason:
                return Response(
                    {
                        'error': 'Validation failed.',
                        'field_errors': {'rejection_reason': ['A rejection reason is required.']},
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            verification.verification_status = IdentityVerification.REJECTED
            verification.rejection_reason = rejection_reason

        verification.verified_by = request.user
        verification.verified_at = now()
        verification.save()

        return Response({'message': f'Verification {action}d successfully.'})


class AdminDocumentView(APIView):
    """Serve any user's identity document. Restricted to the designated admin."""

    def get(self, request, user_id, side):
        if not is_verification_admin(request.user):
            return Response(
                {'error': 'You are not authorized to access this document.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if side not in ('front', 'back'):
            return Response(
                {'error': 'Invalid document side. Use "front" or "back".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        verification = get_object_or_404(IdentityVerification, user_id=user_id)
        doc_field = verification.id_front if side == 'front' else verification.id_back
        file_response = _serve_document(doc_field)

        if file_response is None:
            return Response(
                {'error': 'Document not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        return file_response


# ── Admin: user management ────────────────────────────────────────────────────

class UserAdminListView(APIView):
    """List all users with their verification status. Staff-only."""

    def get(self, request):
        if not is_verification_admin(request.user):
            return Response(
                {'error': 'You are not authorized to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        from django.db.models import Q
        qs = User.objects.select_related('profile', 'identity_verification').order_by('-date_joined')

        search = request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(Q(email__icontains=search) | Q(full_name__icontains=search))

        from rest_framework.pagination import PageNumberPagination
        paginator = PageNumberPagination()
        paginator.page_size = 20
        page = paginator.paginate_queryset(qs, request)
        serializer = UserAdminSerializer(page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)


class StaffToggleView(APIView):
    """Grant or revoke staff (superuser) status for a user. Staff-only."""

    def post(self, request, user_id):
        if not is_verification_admin(request.user):
            return Response(
                {'error': 'You are not authorized to perform this action.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        user = get_object_or_404(User, pk=user_id)

        if user == request.user:
            return Response(
                {'error': 'You cannot modify your own staff status.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.is_staff = not user.is_staff
        user.save(update_fields=['is_staff'])

        action = 'granted' if user.is_staff else 'revoked'
        return Response({'is_staff': user.is_staff, 'message': f'Staff access {action} for {user.email}.'})
