from .base import *  # noqa: F401, F403

DEBUG = True
ALLOWED_HOSTS = ['*']

OTP_DEV_MODE = True  # Include OTP in API response — avoids SMS gateway in dev

# Uses Gmail SMTP from base.py — OTP_DEV_MODE returns the code in the API response too

# Fallback to local memory cache if Redis is not running
import sys
if 'test' in sys.argv or 'pytest' in sys.modules:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        }
    }
