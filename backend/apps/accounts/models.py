import uuid
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from .managers import UserManager


def profile_photo_path(instance, filename):
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else 'jpg'
    return f'profiles/{instance.user_id}/photo.{ext}'


def id_front_path(instance, filename):
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else 'jpg'
    return f'identities/{instance.user_id}/front.{ext}'


def id_back_path(instance, filename):
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else 'jpg'
    return f'identities/{instance.user_id}/back.{ext}'


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(max_length=255, unique=True)
    phone = models.CharField(max_length=20, unique=True, null=True, blank=True)
    full_name = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    is_verified = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['full_name']
    objects = UserManager()

    class Meta:
        db_table = 'users'

    def __str__(self):
        return self.email


class UserProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    profile_photo = models.ImageField(upload_to=profile_photo_path, null=True, blank=True)
    profile_photo_url = models.URLField(max_length=500, null=True, blank=True)
    bio = models.TextField(blank=True, default='')
    city = models.CharField(max_length=100, blank=True, default='')
    avg_rating_as_owner = models.DecimalField(max_digits=3, decimal_places=2, default=0.00)
    avg_rating_as_renter = models.DecimalField(max_digits=3, decimal_places=2, default=0.00)
    total_rentals_as_owner = models.PositiveIntegerField(default=0)
    total_rentals_as_renter = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'user_profiles'

    def __str__(self):
        return f'Profile({self.user.email})'


class IdentityVerification(models.Model):
    NOT_SUBMITTED = 'not_submitted'
    PENDING = 'pending'
    VERIFIED = 'verified'
    REJECTED = 'rejected'

    STATUS_CHOICES = [
        (NOT_SUBMITTED, 'Not Submitted'),
        (PENDING, 'Pending'),
        (VERIFIED, 'Verified'),
        (REJECTED, 'Rejected'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name='identity_verification',
    )
    id_front = models.FileField(upload_to=id_front_path, null=True, blank=True)
    id_back = models.FileField(upload_to=id_back_path, null=True, blank=True)
    verification_status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=NOT_SUBMITTED,
    )
    rejection_reason = models.TextField(blank=True, default='')
    verified_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='verifications_reviewed',
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'identity_verifications'

    def __str__(self):
        return f'IdentityVerification({self.user.email}, {self.verification_status})'


class OTPRecord(models.Model):
    """Dev fallback — production OTPs live in Redis cache with TTL."""
    email = models.EmailField(db_index=True)
    code = models.CharField(max_length=6)
    purpose = models.CharField(max_length=20)  # registration | password_reset
    created_at = models.DateTimeField(auto_now_add=True)
    is_used = models.BooleanField(default=False)
    attempts = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = 'otp_records'

    def __str__(self):
        return f'OTP({self.email}, {self.purpose})'


class PushToken(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='push_tokens')
    token = models.CharField(max_length=255, unique=True)
    platform = models.CharField(max_length=10)  # ios | android
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'push_tokens'

    def __str__(self):
        return f'PushToken({self.user.email}, {self.platform})'
