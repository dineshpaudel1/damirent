from apps.notifications.models import Notification


def create_notification(user, notif_type: str, title: str, body: str, data: dict = None) -> Notification:
    notif = Notification.objects.create(
        user=user,
        type=notif_type,
        title=title,
        body=body,
        data=data or {},
    )
    # TODO: Send FCM push notification via Expo push API
    # POST https://exp.host/--/api/v2/push/send
    # Body: {"to": push_token, "title": title, "body": body, "data": data}
    return notif


def notify_booking_request(booking) -> None:
    create_notification(
        user=booking.owner,
        notif_type='booking_request',
        title='New Booking Request',
        body=f'{booking.renter.full_name} wants to rent your {booking.product.title}.',
        data={'booking_id': str(booking.id), 'screen': 'booking_detail'},
    )


def notify_booking_approved(booking) -> None:
    create_notification(
        user=booking.renter,
        notif_type='booking_approved',
        title='Booking Approved!',
        body=f'Your request for {booking.product.title} was approved. Complete payment to confirm.',
        data={'booking_id': str(booking.id), 'screen': 'checkout'},
    )


def notify_booking_rejected(booking) -> None:
    create_notification(
        user=booking.renter,
        notif_type='booking_rejected',
        title='Booking Not Approved',
        body=f'Your request for {booking.product.title} was not approved by the owner.',
        data={'booking_id': str(booking.id), 'screen': 'booking_detail'},
    )


def notify_payment_confirmed(booking) -> None:
    for user in [booking.renter, booking.owner]:
        create_notification(
            user=user,
            notif_type='payment_confirmed',
            title='Payment Confirmed',
            body=f'Your booking for {booking.product.title} is confirmed.',
            data={'booking_id': str(booking.id), 'screen': 'booking_detail'},
        )


def notify_return_confirmed(booking) -> None:
    create_notification(
        user=booking.renter,
        notif_type='return_confirmed',
        title='Return Confirmed',
        body=f'The owner confirmed the return of {booking.product.title}. Your deposit will be refunded.',
        data={'booking_id': str(booking.id), 'screen': 'booking_detail'},
    )
