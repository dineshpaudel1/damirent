import uuid
from django.db import models
from django.conf import settings


BOOKING_STATUS_CHOICES = [
    ('pending_approval', 'Pending Approval'),
    ('approved', 'Approved'),
    ('payment_pending', 'Payment Pending'),
    ('confirmed', 'Confirmed'),
    ('active', 'Active'),
    ('completed', 'Completed'),
    ('cancelled_by_renter', 'Cancelled by Renter'),
    ('cancelled_by_owner', 'Cancelled by Owner'),
    ('expired', 'Expired'),
    ('disputed', 'Disputed'),
]

ALLOWED_TRANSITIONS = {
    'pending_approval': ['approved', 'cancelled_by_owner', 'expired'],
    'approved': ['payment_pending', 'cancelled_by_renter', 'expired'],
    'payment_pending': ['confirmed', 'approved'],
    'confirmed': ['active', 'cancelled_by_renter', 'cancelled_by_owner'],
    'active': ['completed', 'disputed'],
    'completed': ['disputed'],
    'cancelled_by_renter': [],
    'cancelled_by_owner': [],
    'expired': [],
    'disputed': [],
}


class Booking(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(
        'products.Product', on_delete=models.PROTECT, related_name='bookings'
    )
    renter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='bookings_as_renter',
    )
    # Denormalised for query performance — always matches product.owner at booking time
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='bookings_as_owner',
    )
    start_date = models.DateField()
    end_date = models.DateField()
    total_days = models.PositiveSmallIntegerField()
    rental_total = models.PositiveIntegerField(help_text='NPR')
    security_deposit = models.PositiveIntegerField(help_text='NPR snapshot at booking time')
    platform_fee = models.PositiveIntegerField(help_text='NPR')
    total_charged = models.PositiveIntegerField(help_text='NPR — rental_total + deposit + fee')
    status = models.CharField(
        max_length=30,
        choices=BOOKING_STATUS_CHOICES,
        default='pending_approval',
        db_index=True,
    )
    renter_message = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'bookings'
        indexes = [
            models.Index(fields=['renter', 'status']),
            models.Index(fields=['owner', 'status']),
            models.Index(fields=['product', 'status']),
        ]

    def __str__(self):
        return f'Booking({self.id.hex[:8]}, {self.product.title}, {self.status})'

    def can_transition_to(self, new_status: str) -> bool:
        return new_status in ALLOWED_TRANSITIONS.get(self.status, [])


class BookingStatusHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name='status_history')
    from_status = models.CharField(max_length=30, null=True, blank=True)
    status = models.CharField(max_length=30)  # to_status
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
    )
    note = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'booking_status_history'
        ordering = ['created_at']

    def __str__(self):
        return f'History({self.booking_id}, {self.status})'
