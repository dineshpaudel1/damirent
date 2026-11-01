"""
Add a DB-level check that booking end_date > start_date.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('bookings', '0004_cancellation_penalty'),
    ]

    operations = [
        migrations.AddConstraint(
            model_name='booking',
            constraint=models.CheckConstraint(
                condition=models.Q(end_date__gt=models.F('start_date')),
                name='booking_end_after_start',
            ),
        ),
    ]
