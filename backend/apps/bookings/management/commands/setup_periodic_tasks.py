from django.core.management.base import BaseCommand
from django_celery_beat.models import PeriodicTask, IntervalSchedule


class Command(BaseCommand):
    help = 'Register Celery Beat periodic tasks for booking lifecycle automation.'

    def handle(self, *args, **options):
        # Every 10 minutes — check for expired pending/approved bookings
        every_10min, _ = IntervalSchedule.objects.get_or_create(
            every=10,
            period=IntervalSchedule.MINUTES,
        )
        # Every 60 minutes — activate confirmed bookings whose start date has arrived
        every_60min, _ = IntervalSchedule.objects.get_or_create(
            every=60,
            period=IntervalSchedule.MINUTES,
        )

        tasks = [
            {
                'name': 'Auto-expire pending bookings (no owner response)',
                'task': 'tasks.expire_pending_bookings',
                'interval': every_10min,
            },
            {
                'name': 'Auto-expire approved bookings (no payment)',
                'task': 'tasks.expire_approved_bookings',
                'interval': every_10min,
            },
            {
                'name': 'Auto-activate confirmed bookings on start date',
                'task': 'tasks.activate_confirmed_bookings',
                'interval': every_60min,
            },
        ]

        for t in tasks:
            obj, created = PeriodicTask.objects.update_or_create(
                name=t['name'],
                defaults={
                    'task': t['task'],
                    'interval': t['interval'],
                    'enabled': True,
                },
            )
            status = 'Created' if created else 'Updated'
            self.stdout.write(self.style.SUCCESS(f'{status}: {obj.name}'))

        self.stdout.write(self.style.SUCCESS('\nAll periodic tasks registered. Start Celery Beat to activate them.'))
