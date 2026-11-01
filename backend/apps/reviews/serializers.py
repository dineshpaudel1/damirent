from rest_framework import serializers
from apps.accounts.serializers import PublicUserSerializer
from .models import Review


class ReviewSerializer(serializers.ModelSerializer):
    reviewer = PublicUserSerializer(read_only=True)
    reviewer_role = serializers.SerializerMethodField()
    booking = serializers.UUIDField(source='booking_id')

    class Meta:
        model = Review
        fields = ['id', 'booking', 'reviewer', 'reviewer_role', 'rating', 'comment', 'created_at']

    def get_reviewer_role(self, obj):
        return 'renter' if obj.review_type == 'renter_reviewing_owner' else 'owner'


class ReviewCreateSerializer(serializers.Serializer):
    booking = serializers.UUIDField()
    rating = serializers.IntegerField(min_value=1, max_value=5)
    comment = serializers.CharField(allow_blank=True, default='')
