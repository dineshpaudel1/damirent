from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='refund',
            name='gateway_refund_id',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Khalti refund_id returned on success — used for idempotency',
                max_length=255,
            ),
        ),
    ]
