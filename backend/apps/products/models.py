import uuid
from django.db import models
from django.conf import settings


class Category(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100, unique=True)
    icon_name = models.CharField(max_length=100, blank=True, default='')
    parent = models.ForeignKey(
        'self', null=True, blank=True, on_delete=models.SET_NULL, related_name='children'
    )
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = 'categories'
        ordering = ['sort_order', 'name']
        verbose_name_plural = 'categories'

    def __str__(self):
        return self.name


class Product(models.Model):
    CONDITION_CHOICES = [
        ('excellent', 'Excellent'),
        ('good', 'Good'),
        ('fair', 'Fair'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='products'
    )
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name='products')
    title = models.CharField(max_length=255)
    description = models.TextField()
    condition = models.CharField(max_length=20, choices=CONDITION_CHOICES)
    price_per_day = models.PositiveIntegerField(help_text='NPR, integer only')
    security_deposit = models.PositiveIntegerField(help_text='NPR, integer only')
    min_rental_days = models.PositiveSmallIntegerField(default=1)
    max_rental_days = models.PositiveSmallIntegerField(null=True, blank=True)
    pickup_location = models.CharField(max_length=255)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'products'
        indexes = [
            models.Index(fields=['category', 'is_active']),
            models.Index(fields=['owner']),
            models.Index(fields=['-created_at']),
        ]

    def __str__(self):
        return self.title


class ProductImage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='images')
    image_url = models.URLField(max_length=500)
    is_primary = models.BooleanField(default=False)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = 'product_images'
        ordering = ['sort_order']

    def __str__(self):
        return f'Image({self.product.title})'


class AvailabilityBlock(models.Model):
    BLOCK_TYPE_CHOICES = [
        ('owner_blocked', 'Owner Blocked'),
        ('booking_hold', 'Booking Hold'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name='availability_blocks'
    )
    start_date = models.DateField()
    end_date = models.DateField()
    block_type = models.CharField(max_length=20, choices=BLOCK_TYPE_CHOICES)
    booking = models.ForeignKey(
        'bookings.Booking',
        null=True, blank=True,
        on_delete=models.CASCADE,
        related_name='availability_blocks',
    )

    class Meta:
        db_table = 'availability_blocks'
        indexes = [
            models.Index(fields=['product', 'start_date', 'end_date']),
        ]

    def __str__(self):
        return f'Block({self.product.title}, {self.start_date}–{self.end_date})'
