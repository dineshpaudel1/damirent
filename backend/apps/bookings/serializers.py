from rest_framework import serializers

from apps.products.serializers import ProductSerializer, PublicUserSerializer
from .models import Booking, BookingStatusHistory, CancellationPenalty


class CancellationPenaltySerializer(serializers.ModelSerializer):
    booking_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = CancellationPenalty
        fields = ['id', 'booking_id', 'amount', 'status', 'created_at', 'paid_at']


class BookingStatusHistorySerializer(serializers.ModelSerializer):
    to_status = serializers.CharField(source='status')
    changed_by = PublicUserSerializer(read_only=True)

    class Meta:
        model = BookingStatusHistory
        fields = ['id', 'from_status', 'to_status', 'changed_by', 'note', 'created_at']


class BookingSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    renter = PublicUserSerializer(read_only=True)
    message = serializers.CharField(source='renter_message')
    owner_note = serializers.SerializerMethodField()
    cancellation_penalty = CancellationPenaltySerializer(read_only=True)

    class Meta:
        model = Booking
        fields = [
            'id', 'product', 'renter',
            'start_date', 'end_date', 'total_days',
            'rental_total', 'platform_fee', 'security_deposit', 'total_charged',
            'status', 'message', 'owner_note',
            'cancellation_penalty',
            'created_at', 'updated_at',
        ]

    def get_owner_note(self, obj):
        return ''


class BookingCreateSerializer(serializers.Serializer):
    product = serializers.UUIDField()
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    message = serializers.CharField(required=False, allow_blank=True, default='')

    def validate(self, data):
        if data['start_date'] >= data['end_date']:
            raise serializers.ValidationError({'end_date': 'End date must be after start date.'})
        return data
