from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class OTPRateThrottle(AnonRateThrottle):
    """Limit OTP send/verify attempts to 5 per hour per IP."""
    rate = '5/hour'
    scope = 'otp'


class LoginRateThrottle(AnonRateThrottle):
    """Limit login attempts to 10 per minute per IP."""
    rate = '10/minute'
    scope = 'login'


class PaymentInitiateThrottle(UserRateThrottle):
    """Limit payment initiations to 10 per hour per user."""
    rate = '10/hour'
    scope = 'payment_initiate'
