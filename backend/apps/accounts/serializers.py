from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import User, UserProfile, IdentityVerification


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('email', 'full_name', 'password', 'confirm_password')

    def validate(self, data):
        if data['password'] != data.pop('confirm_password'):
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        return data

    def create(self, validated_data):
        user = User.objects.create_user(
            email=validated_data['email'],
            full_name=validated_data['full_name'],
            password=validated_data['password'],
        )
        UserProfile.objects.create(user=user)
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        user = authenticate(username=data['email'], password=data['password'])
        if not user:
            raise serializers.ValidationError(
                {'non_field_errors': ['Invalid email or password.']}
            )
        if not user.is_active:
            raise serializers.ValidationError(
                {'non_field_errors': ['This account has been disabled.']}
            )
        data['user'] = user
        return data


class UserProfileSerializer(serializers.ModelSerializer):
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = (
            'avatar', 'profile_photo_url', 'bio', 'city',
            'avg_rating_as_owner', 'avg_rating_as_renter',
            'total_rentals_as_owner', 'total_rentals_as_renter',
        )
        read_only_fields = (
            'avatar',
            'avg_rating_as_owner', 'avg_rating_as_renter',
            'total_rentals_as_owner', 'total_rentals_as_renter',
        )

    def get_avatar(self, obj):
        request = self.context.get('request')
        if obj.profile_photo and obj.profile_photo.name:
            url = obj.profile_photo.url
            if request:
                return request.build_absolute_uri(url)
            return url
        return obj.profile_photo_url


class IdentityVerificationStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = IdentityVerification
        fields = ('verification_status', 'rejection_reason', 'submitted_at', 'verified_at')
        read_only_fields = ('verification_status', 'rejection_reason', 'submitted_at', 'verified_at')


class MeSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer()
    identity_verification = IdentityVerificationStatusSerializer(read_only=True)

    class Meta:
        model = User
        fields = (
            'id', 'email', 'phone', 'full_name', 'is_verified',
            'date_joined', 'profile', 'identity_verification',
        )
        read_only_fields = ('id', 'email', 'is_verified', 'date_joined')

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Provide a default when the user has no identity_verification record yet
        if data.get('identity_verification') is None:
            data['identity_verification'] = {
                'verification_status': IdentityVerification.NOT_SUBMITTED,
                'rejection_reason': '',
                'submitted_at': None,
                'verified_at': None,
            }
        return data

    def update(self, instance, validated_data):
        profile_data = validated_data.pop('profile', {})
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if profile_data:
            profile = instance.profile
            for attr, value in profile_data.items():
                setattr(profile, attr, value)
            profile.save()
        return instance


class PublicUserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)
    identity_verified = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'full_name', 'is_verified', 'identity_verified', 'profile')

    def get_identity_verified(self, obj):
        try:
            return obj.identity_verification.verification_status == IdentityVerification.VERIFIED
        except IdentityVerification.DoesNotExist:
            return False


class SendOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()
    purpose = serializers.ChoiceField(choices=['registration', 'password_reset'], default='registration')


class VerifyOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(max_length=6, min_length=6)
    purpose = serializers.ChoiceField(choices=['registration', 'password_reset'], default='registration')


class PasswordResetConfirmSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(max_length=6)
    new_password = serializers.CharField(min_length=8)
    confirm_password = serializers.CharField()

    def validate(self, data):
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        return data


class PushTokenSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=255)
    platform = serializers.ChoiceField(choices=['ios', 'android'])


# ── Admin serializers ─────────────────────────────────────────────────────────

class VerificationAdminUserSerializer(serializers.ModelSerializer):
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'email', 'full_name', 'avatar')

    def get_avatar(self, obj):
        request = self.context.get('request')
        try:
            profile = obj.profile
            if profile.profile_photo and profile.profile_photo.name:
                url = profile.profile_photo.url
                if request:
                    return request.build_absolute_uri(url)
                return url
            return profile.profile_photo_url
        except Exception:
            return None


class VerificationAdminListSerializer(serializers.ModelSerializer):
    user = VerificationAdminUserSerializer(read_only=True)

    class Meta:
        model = IdentityVerification
        fields = ('id', 'user', 'verification_status', 'rejection_reason', 'submitted_at', 'verified_at')
        read_only_fields = fields
