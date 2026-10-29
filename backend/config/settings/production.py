from .base import *  # noqa: F401, F403

DEBUG = False

SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# S3 media storage
DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
AWS_ACCESS_KEY_ID = config('AWS_ACCESS_KEY_ID')          # noqa: F405
AWS_SECRET_ACCESS_KEY = config('AWS_SECRET_ACCESS_KEY')  # noqa: F405
AWS_STORAGE_BUCKET_NAME = config('AWS_STORAGE_BUCKET_NAME')  # noqa: F405
AWS_S3_REGION_NAME = config('AWS_S3_REGION_NAME', default='ap-south-1')  # noqa: F405
AWS_DEFAULT_ACL = 'public-read'
AWS_S3_CUSTOM_DOMAIN = f"{AWS_STORAGE_BUCKET_NAME}.s3.amazonaws.com"
MEDIA_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/'

# Sentry
import sentry_sdk
sentry_sdk.init(
    dsn=config('SENTRY_DSN', default=''),  # noqa: F405
    traces_sample_rate=0.1,
)
