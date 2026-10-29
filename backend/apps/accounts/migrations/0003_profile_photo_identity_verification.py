import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
import apps.accounts.models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_email_auth'),
    ]

    operations = [
        # Add profile_photo to UserProfile
        migrations.AddField(
            model_name='userprofile',
            name='profile_photo',
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to=apps.accounts.models.profile_photo_path,
            ),
        ),

        # Create IdentityVerification model
        migrations.CreateModel(
            name='IdentityVerification',
            fields=[
                ('id', models.UUIDField(
                    default=uuid.uuid4, editable=False,
                    primary_key=True, serialize=False,
                )),
                ('id_front', models.FileField(
                    blank=True, null=True,
                    upload_to=apps.accounts.models.id_front_path,
                )),
                ('id_back', models.FileField(
                    blank=True, null=True,
                    upload_to=apps.accounts.models.id_back_path,
                )),
                ('verification_status', models.CharField(
                    choices=[
                        ('not_submitted', 'Not Submitted'),
                        ('pending', 'Pending'),
                        ('verified', 'Verified'),
                        ('rejected', 'Rejected'),
                    ],
                    default='not_submitted',
                    max_length=20,
                )),
                ('rejection_reason', models.TextField(blank=True, default='')),
                ('verified_at', models.DateTimeField(blank=True, null=True)),
                ('submitted_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='identity_verification',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('verified_by', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='verifications_reviewed',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={'db_table': 'identity_verifications'},
        ),
    ]
