"""
Prevent the same booking from creating more than one AvailabilityBlock, and
add a database-level check that start_date < end_date.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0001_initial'),
    ]

    operations = [
        # A booking may only hold one date block at a time.
        migrations.AddConstraint(
            model_name='availabilityblock',
            constraint=models.UniqueConstraint(
                condition=models.Q(block_type='booking_hold'),
                fields=['booking'],
                name='unique_booking_hold_per_booking',
            ),
        ),
        # Date sanity: end_date must be after start_date.
        migrations.AddConstraint(
            model_name='availabilityblock',
            constraint=models.CheckConstraint(
                condition=models.Q(end_date__gt=models.F('start_date')),
                name='availabilityblock_end_after_start',
            ),
        ),
    ]
