from django.db import migrations, models


class Migration(migrations.Migration):

    atomic = False  # Required: cannot ALTER TABLE in same txn as DELETE with triggers

    dependencies = [
        ('accounts', '0001_initial'),
    ]

    operations = [
        # Clear dev users that have no email before making email non-nullable.
        # Uses DELETE (not TRUNCATE) so the migration works on SQLite (tests) and PostgreSQL.
        migrations.RunSQL(
            sql=[
                "DELETE FROM otp_records;",
                "DELETE FROM push_tokens;",
                "DELETE FROM user_profiles;",
                "DELETE FROM users;",
            ],
            reverse_sql=migrations.RunSQL.noop,
        ),
        # User: make email required, phone optional
        migrations.AlterField(
            model_name='user',
            name='email',
            field=models.EmailField(max_length=255, unique=True),
        ),
        migrations.AlterField(
            model_name='user',
            name='phone',
            field=models.CharField(blank=True, max_length=20, null=True, unique=True),
        ),
        # OTPRecord: rename phone → email
        migrations.RenameField(
            model_name='otprecord',
            old_name='phone',
            new_name='email',
        ),
        migrations.AlterField(
            model_name='otprecord',
            name='email',
            field=models.EmailField(db_index=True),
        ),
    ]
