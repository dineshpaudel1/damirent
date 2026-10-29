from rest_framework import serializers
from .models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    booking = serializers.UUIDField(source='booking_id')

    class Meta:
        model = Payment
        fields = ['id', 'booking', 'payment_type', 'amount', 'status', 'gateway', 'gateway_txn_id', 'initiated_at']


class PaymentInitiateSerializer(serializers.Serializer):
    booking = serializers.UUIDField()
