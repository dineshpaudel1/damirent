from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    # The mobile app expects "notification_type"; the model column is "type"
    notification_type = serializers.CharField(source='type')

    class Meta:
        model = Notification
        fields = ['id', 'notification_type', 'title', 'body', 'data', 'is_read', 'created_at']
        read_only_fields = fields
