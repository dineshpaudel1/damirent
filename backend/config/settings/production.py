from .base import *  # noqa: F401, F403

# Validate critical secrets are supplied — fail fast at startup rather than at runtime
import sys
_required_vars = ['SECRET_KEY', 'DB_PASSWORD', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_STORAGE_BUCKET_NAME']
_missing = [v for v in _required_vars if not config(v, default='')]  # noqa: F405
if _missing:
    print(f'[STARTUP ERROR] Missing required environment variables: {", ".join(_missing)}', file=sys.stderr)
    sys.exit(1)

DEBUG = False

SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_HTTPONLY = True
X_FRAME_OPTIONS = 'DENY'

# S3 media storage
DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
AWS_ACCESS_KEY_ID = config('AWS_ACCESS_KEY_ID')          # noqa: F405
AWS_SECRET_ACCESS_KEY = config('AWS_SECRET_ACCESS_KEY')  # noqa: F405
AWS_STORAGE_BUCKET_NAME = config('AWS_STORAGE_BUCKET_NAME')  # noqa: F405
AWS_S3_REGION_NAME = config('AWS_S3_REGION_NAME', default='ap-south-1')  # noqa: F405

# IMPORTANT: Never use 'public-read' — identity documents would be globally accessible.
# Product images are served via pre-signed URLs instead.
AWS_DEFAULT_ACL = None           # Objects inherit bucket policy (private by default)
AWS_S3_FILE_OVERWRITE = False
AWS_QUERYSTRING_AUTH = True      # Generate signed URLs (expires in 1 hour by default)
AWS_QUERYSTRING_EXPIRE = 3600
AWS_S3_CUSTOM_DOMAIN = None      # Use signed URLs, not public CDN domain
MEDIA_URL = f'https://{config("AWS_STORAGE_BUCKET_NAME")}.s3.{config("AWS_S3_REGION_NAME", default="ap-south-1")}.amazonaws.com/'  # noqa: F405

# Sentry
import sentry_sdk
sentry_sdk.init(
    dsn=config('SENTRY_DSN', default=''),  # noqa: F405
    traces_sample_rate=0.1,
    send_default_pii=False,
)
