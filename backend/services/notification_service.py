import logging
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from apps.notifications.models import Notification

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'


def _send_push_notification(user, title: str, body: str, data: dict) -> None:
    """Send Expo push notifications to all registered devices for this user."""
    from apps.accounts.models import PushToken
    import urllib.request
    import json

    tokens = list(PushToken.objects.filter(user=user).values_list('token', flat=True))
    if not tokens:
        return

    messages = [
        {'to': token, 'title': title, 'body': body, 'data': data, 'sound': 'default'}
        for token in tokens
    ]

    payload = json.dumps(messages).encode('utf-8')
    req = urllib.request.Request(
        EXPO_PUSH_URL,
        data=payload,
        headers={
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            result = json.loads(resp.read())
            for item in result.get('data', []):
                if item.get('status') == 'error':
                    logger.warning(f'Expo push error for user {user.id}: {item.get("message")}')
    except Exception as exc:
        logger.warning(f'Expo push request failed for user {user.id}: {exc}')


def create_notification(user, notif_type: str, title: str, body: str, data: dict = None) -> Notification:
    notif = Notification.objects.create(
        user=user,
        type=notif_type,
        title=title,
        body=body,
        data=data or {},
    )

    # 1. Push to connected WebSocket clients (instant, in-app)
    channel_layer = get_channel_layer()
    if channel_layer is not None:
        try:
            async_to_sync(channel_layer.group_send)(
                f'user_{user.id}_notifications',
                {
                    'type': 'notification.push',
                    'notification': {
                        'id': str(notif.id),
                        'notification_type': notif_type,
                        'title': title,
                        'body': body,
                        'data': data or {},
                        'is_read': False,
                        'created_at': notif.created_at.isoformat(),
                    },
                },
            )
        except Exception:
            pass

    # 2. Send Expo push notification (background, for when app is closed)
    try:
        _send_push_notification(user, title, body, data or {})
    except Exception:
        pass

    return notif


# ─── Booking lifecycle ────────────────────────────────────────────────────────

def notify_booking_request(booking) -> None:
    create_notification(
        user=booking.owner,
        notif_type='booking_request',
        title='New Booking Request',
        body=f'{booking.renter.full_name} wants to rent your "{booking.product.title}".',
        data={'booking_id': str(booking.id), 'screen': 'booking_detail'},
    )


def notify_booking_approved(booking) -> None:
    create_notification(
        user=booking.renter,
        notif_type='booking_approved',
        title='Booking Approved!',
        body=f'Your request for "{booking.product.title}" was approved. Complete payment to confirm.',
        data={'booking_id': str(booking.id), 'screen': 'checkout'},
    )


def notify_booking_rejected(booking) -> None:
    create_notification(
        user=booking.renter,
        notif_type='booking_cancelled',
        title='Booking Not Approved',
        body=f'Your request for "{booking.product.title}" was not approved by the owner.',
        data={'booking_id': str(booking.id), 'screen': 'booking_detail'},
    )


def notify_booking_cancelled_to_owner(booking) -> None:
    create_notification(
        user=booking.owner,
        notif_type='booking_cancelled',
        title='Booking Cancelled',
        body=f'{booking.renter.full_name} cancelled their booking for "{booking.product.title}".',
        data={'booking_id': str(booking.id), 'screen': 'booking_detail'},
    )


def notify_booking_cancelled_to_renter(booking) -> None:
    create_notification(
        user=booking.renter,
        notif_type='booking_cancelled',
        title='Booking Cancelled',
        body=f'Your booking for "{booking.product.title}" was cancelled by the owner.',
        data={'booking_id': str(booking.id), 'screen': 'booking_detail'},
    )


def notify_payment_confirmed(booking) -> None:
    create_notification(
        user=booking.renter,
        notif_type='booking_confirmed',
        title='Booking Confirmed!',
        body=f'Payment received. Your rental of "{booking.product.title}" is confirmed.',
        data={'booking_id': str(booking.id), 'screen': 'booking_detail'},
    )
    create_notification(
        user=booking.owner,
        notif_type='payment_received',
        title='Payment Received',
        body=f'{booking.renter.full_name} paid for "{booking.product.title}". Booking is now confirmed.',
        data={'booking_id': str(booking.id), 'screen': 'booking_detail'},
    )


def notify_booking_active(booking) -> None:
    create_notification(
        user=booking.renter,
        notif_type='booking_active',
        title='Rental Started!',
        body=f'The owner handed over "{booking.product.title}". Enjoy your rental!',
        data={'booking_id': str(booking.id), 'screen': 'booking_detail'},
    )


def notify_booking_completed(booking) -> None:
    create_notification(
        user=booking.renter,
        notif_type='booking_completed',
        title='Rental Completed',
        body=f'Your rental of "{booking.product.title}" is complete. Your deposit will be refunded.',
        data={'booking_id': str(booking.id), 'screen': 'booking_detail'},
    )


def notify_booking_disputed(booking, filed_by) -> None:
    other = booking.owner if filed_by == booking.renter else booking.renter
    create_notification(
        user=other,
        notif_type='system',
        title='Dispute Filed',
        body=f'A dispute has been opened for the booking of "{booking.product.title}". Our team will review it.',
        data={'booking_id': str(booking.id), 'screen': 'booking_detail'},
    )
