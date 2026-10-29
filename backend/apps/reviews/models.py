import uuid
from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator


class Review(models.Model):
    REVIEW_TYPE_CHOICES = [
        ('renter_reviewing_owner', 'Renter Reviewing Owner'),
        ('owner_reviewing_renter', 'Owner Reviewing Renter'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking = models.ForeignKey(
        'bookings.Booking', on_delete=models.PROTECT, related_name='reviews'
    )
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='reviews_given'
    )
    reviewee = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='reviews_received'
    )
    product = models.ForeignKey(
        'products.Product', on_delete=models.PROTECT, related_name='reviews'
    )
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    comment = models.TextField(blank=True, default='')
    review_type = models.CharField(max_length=30, choices=REVIEW_TYPE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'reviews'
        # One review per party per booking
        unique_together = [('booking', 'reviewer')]

    def __str__(self):
        return f'Review({self.reviewer}, {self.rating}★)'
