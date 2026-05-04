"""
Development settings — extends base.
"""
from .base import *  # noqa: F401, F403

DEBUG = True

ALLOWED_HOSTS = ["*"]

CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:80",
]

CORS_ALLOW_ALL_ORIGINS = True  # Dev only

# Email to console in development
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# Django debug toolbar
SHARED_APPS += ["debug_toolbar"]
TENANT_APPS += ["debug_toolbar"]
INSTALLED_APPS = list(SHARED_APPS) + [app for app in TENANT_APPS if app not in SHARED_APPS]

MIDDLEWARE = [
    "debug_toolbar.middleware.DebugToolbarMiddleware",
] + MIDDLEWARE

INTERNAL_IPS = ["127.0.0.1"]

# Relax password validation in dev
AUTH_PASSWORD_VALIDATORS = []

# Dummy throttle in dev
REST_FRAMEWORK = {  # noqa: F405
    **REST_FRAMEWORK,  # noqa: F405
    "DEFAULT_THROTTLE_CLASSES": [],
}

LOGGING["root"]["level"] = "DEBUG"  # noqa: F405
