"""
MAIDAN — Base Django Settings
All environments inherit from this file.
"""

import os
from datetime import timedelta
from pathlib import Path

import environ

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()
# Variables are passed directly by Docker/Environment

# ---------------------------------------------------------------------------
# Security
# ---------------------------------------------------------------------------
SECRET_KEY = env("DJANGO_SECRET_KEY")
DEBUG = env.bool("DJANGO_DEBUG", default=False)
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["*"])
CSRF_TRUSTED_ORIGINS = env.list(
    "DJANGO_CSRF_TRUSTED_ORIGINS",
    default=["http://localhost", "http://127.0.0.1"],
)

# Multi-tenancy settings
USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# ---------------------------------------------------------------------------
# Multi-Tenancy (django-tenants)
# ---------------------------------------------------------------------------
DATABASES = {
    "default": {
        "ENGINE": "django_tenants.postgresql_backend",
        "NAME": env("POSTGRES_DB", default="maidan"),
        "USER": env("POSTGRES_USER", default="maidan_user"),
        "PASSWORD": env("POSTGRES_PASSWORD", default="maidan_dev_password"),
        "HOST": env("POSTGRES_HOST", default="db"),
        "PORT": env("POSTGRES_PORT", default="5432"),
        "CONN_MAX_AGE": 60,
        "OPTIONS": {
            "connect_timeout": 10,
        },
    }
}

DATABASE_ROUTERS = ("django_tenants.routers.TenantSyncRouter",)

TENANT_MODEL = "tenants.Tenant"
TENANT_DOMAIN_MODEL = "tenants.Domain"
# Fall back to public schema when host does not match a tenant domain.
# This keeps platform auth/admin flows working before subdomains are configured.
SHOW_PUBLIC_IF_NO_TENANT_FOUND = True

# ---------------------------------------------------------------------------
# Application Definition
# ---------------------------------------------------------------------------
SHARED_APPS = [
    # django-tenants must be first
    "django_tenants",

    # Platform-wide apps (public schema) - MUST come before admin
    "apps.tenants.apps.TenantsConfig",
    "apps.accounts",

    # Django built-ins
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.admin",

    # Third-party
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_celery_beat",
    "django_celery_results",
    "django_filters",
    "drf_spectacular",
    "storages",
]

TENANT_APPS = [
    # Django built-ins (per tenant)
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.admin",

    # Tenant-scoped apps
    "apps.students",
    "apps.families",
    "apps.attendance",
    "apps.belts",
    "apps.billing",
    "apps.payments",
    "apps.scheduling",
    "apps.messaging",
    "apps.reporting",
    "apps.staff",
    "apps.audit",
]

INSTALLED_APPS = list(SHARED_APPS) + [app for app in TENANT_APPS if app not in SHARED_APPS]

# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------
MIDDLEWARE = [
    "apps.accounts.middleware.DebugHostMiddleware",
    "django_tenants.middleware.main.TenantMainMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "apps.tenants.middleware.TenantStatusMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.locale.LocaleMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.audit.utils.AuditLogMiddleware",
]

# ---------------------------------------------------------------------------
# URLs & WSGI
# ---------------------------------------------------------------------------
# django-tenants: ROOT_URLCONF is the tenant URLconf; when the host maps to the public
# schema (or SHOW_PUBLIC_IF_NO_TENANT_FOUND), TenantMainMiddleware sets
# request.urlconf to PUBLIC_SCHEMA_URLCONF instead.
ROOT_URLCONF = "config.urls_tenant"
PUBLIC_SCHEMA_URLCONF = "config.urls"
TENANT_LIMIT_SET_CALLS = True
TENANT_COLOR_ADMIN_CONSOLE = True



WSGI_APPLICATION = "config.wsgi.application"

# ---------------------------------------------------------------------------
# Templates
# ---------------------------------------------------------------------------
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

AUTHENTICATION_BACKENDS = [
    "shared.auth.CaseInsensitiveModelBackend",
    "django.contrib.auth.backends.ModelBackend",
]

# ---------------------------------------------------------------------------
# REST Framework
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "shared.pagination.StandardResultsPagination",
    "PAGE_SIZE": 25,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "100/hour",
        "user": "1000/hour",
    },
    "EXCEPTION_HANDLER": "shared.exceptions.custom_exception_handler",
}

# ---------------------------------------------------------------------------
# JWT Settings
# ---------------------------------------------------------------------------
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=env.int("JWT_ACCESS_TOKEN_LIFETIME_MINUTES", default=60)),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env.int("JWT_REFRESH_TOKEN_LIFETIME_DAYS", default=7)),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
CORS_ALLOW_CREDENTIALS = True

# ---------------------------------------------------------------------------
# Cache (Redis)
# ---------------------------------------------------------------------------
CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": env("REDIS_URL", default="redis://redis:6379/0"),
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        },
        "KEY_PREFIX": "maidan",
    }
}

SESSION_ENGINE = "django.contrib.sessions.backends.cache"
SESSION_CACHE_ALIAS = "default"

# ---------------------------------------------------------------------------
# Celery
# ---------------------------------------------------------------------------
CELERY_BROKER_URL = env("CELERY_BROKER_URL", default="redis://redis:6379/1")
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", default="redis://redis:6379/2")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = "UTC"

# ---------------------------------------------------------------------------
# Internationalization
# ---------------------------------------------------------------------------
LANGUAGE_CODE = "en"
TIME_ZONE = "Asia/Amman"
USE_I18N = True
USE_L10N = True
USE_TZ = True

LANGUAGES = [
    ("ar", "Arabic"),
    ("en", "English"),
]

LOCALE_PATHS = [BASE_DIR / "locale"]

# ---------------------------------------------------------------------------
# Static & Media Files
# ---------------------------------------------------------------------------
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = env("MEDIA_URL", default="/media/")
MEDIA_ROOT = BASE_DIR / "media"

# ---------------------------------------------------------------------------
# Storage (S3)
# ---------------------------------------------------------------------------
USE_S3 = env.bool("USE_S3", default=False)
AWS_ACCESS_KEY_ID = env("AWS_ACCESS_KEY_ID", default=None)
AWS_SECRET_ACCESS_KEY = env("AWS_SECRET_ACCESS_KEY", default=None)
AWS_STORAGE_BUCKET_NAME = env("AWS_STORAGE_BUCKET_NAME", default=None)
AWS_S3_REGION_NAME = env("AWS_S3_REGION_NAME", default="me-south-1")
AWS_S3_ENDPOINT_URL = env("AWS_S3_ENDPOINT_URL", default=None)
AWS_DEFAULT_ACL = env("AWS_DEFAULT_ACL", default="private")
AWS_S3_FILE_OVERWRITE = env.bool("AWS_S3_FILE_OVERWRITE", default=False)
AWS_QUERYSTRING_AUTH = env.bool("AWS_QUERYSTRING_AUTH", default=True)
AWS_QUERYSTRING_EXPIRE = env.int("AWS_QUERYSTRING_EXPIRE", default=3600)

if USE_S3:
    DEFAULT_FILE_STORAGE = "storages.backends.s3boto3.S3Boto3Storage"
    STATICFILES_STORAGE = "storages.backends.s3boto3.S3StaticStorage"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------------------
# Email
# ---------------------------------------------------------------------------
EMAIL_BACKEND = env("EMAIL_BACKEND", default="django.core.mail.backends.console.EmailBackend")
EMAIL_HOST = env("EMAIL_HOST", default="")
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="noreply@maidan.app")

# ---------------------------------------------------------------------------
# Payment Providers
# ---------------------------------------------------------------------------
STRIPE_SECRET_KEY = env("STRIPE_SECRET_KEY", default="")
STRIPE_PUBLISHABLE_KEY = env("STRIPE_PUBLISHABLE_KEY", default="")
STRIPE_WEBHOOK_SECRET = env("STRIPE_WEBHOOK_SECRET", default="")

PAYTABS_PROFILE_ID = env("PAYTABS_PROFILE_ID", default="")
PAYTABS_SERVER_KEY = env("PAYTABS_SERVER_KEY", default="")
PAYTABS_REGION = env("PAYTABS_REGION", default="SAU")
PAYTABS_BASE_URL = env("PAYTABS_BASE_URL", default="https://secure.paytabs.sa")

HYPERPAY_ACCESS_TOKEN = env("HYPERPAY_ACCESS_TOKEN", default="")
HYPERPAY_BASE_URL = env("HYPERPAY_BASE_URL", default="https://eu-test.oppwa.com")

# ---------------------------------------------------------------------------
# Messaging
# ---------------------------------------------------------------------------
WHATSAPP_PROVIDER = env("WHATSAPP_PROVIDER", default="stub")
WHATSAPP_API_KEY = env("WHATSAPP_API_KEY", default="")
WHATSAPP_BASE_URL = env("WHATSAPP_BASE_URL", default="")

# ---------------------------------------------------------------------------
# Platform Settings
# ---------------------------------------------------------------------------
PLATFORM_NAME = env("PLATFORM_NAME", default="MAIDAN")
PLATFORM_DOMAIN = env("PLATFORM_DOMAIN", default="localhost")
DEFAULT_CURRENCY = env("DEFAULT_CURRENCY", default="JOD")
SUPPORTED_CURRENCIES = env.list("SUPPORTED_CURRENCIES", default=["JOD", "SAR", "AED", "USD", "EUR"])
DEFAULT_LANGUAGE = env("DEFAULT_LANGUAGE", default="ar")

# ---------------------------------------------------------------------------
# API Documentation
# ---------------------------------------------------------------------------
SPECTACULAR_SETTINGS = {
    "TITLE": "MAIDAN Dojo Management API",
    "DESCRIPTION": "Multi-tenant SaaS platform for martial arts academies.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "SCHEMA_PATH_PREFIX": r"/api/v1/",
}

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {process:d} {thread:d} {message}",
            "style": "{",
        },
        "simple": {
            "format": "{levelname} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "maidan": {
            "handlers": ["console"],
            "level": "DEBUG",
            "propagate": False,
        },
    },
}
