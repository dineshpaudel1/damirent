import uuid
from django.db import models
from django.conf import settings


class Payment(models.Model):
    PAYMENT_TYPE_CHOICES = [
        ('rental', 'Rental'),
        ('security_deposit', 'Security Deposit'),
    ]
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('refunded', 'Refunded'),
        ('partially_refunded', 'Partially Refunded'),
    ]
    GATEWAY_CHOICES = [('khalti', 'Khalti'), ('esewa', 'eSewa')]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking = models.ForeignKey(
        'bookings.Booking', on_delete=models.PROTECT, related_name='payments'
    )
    payment_type = models.CharField(max_length=20, choices=PAYMENT_TYPE_CHOICES)
    amount = models.PositiveIntegerField(help_text='NPR')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    gateway = models.CharField(max_length=20, choices=GATEWAY_CHOICES, default='khalti')
    # Unique index enforces idempotency — duplicate callbacks on same txn_id are ignored
    gateway_txn_id = models.CharField(max_length=255, unique=True, null=True, blank=True)
    gateway_ref = models.CharField(max_length=255, blank=True, default='', db_index=True)
    initiated_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    raw_callback = models.JSONField(null=True, blank=True, help_text='Full gateway callback stored for audit')

    class Meta:
        db_table = 'payments'

    def __str__(self):
        return f'Payment({self.id.hex[:8]}, {self.payment_type}, {self.status})'


class Refund(models.Model):
    REASON_CHOICES = [
        ('deposit_return', 'Deposit Return'),
        ('cancellation', 'Cancellation'),
        ('partial_damage', 'Partial Damage Deduction'),
    ]
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payment = models.ForeignKey(Payment, on_delete=models.PROTECT, related_name='refunds')
    amount = models.PositiveIntegerField(help_text='NPR')
    reason = models.CharField(max_length=30, choices=REASON_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    initiated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    initiated_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'refunds'

    def __str__(self):
        return f'Refund({self.id.hex[:8]}, {self.reason}, {self.status})'
