"""
MAIDAN — Root URL Configuration
This file handles PUBLIC schema routes (platform-level).
"""

from django.http import HttpResponse
from django.contrib import admin
from django.urls import include, path
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

from django.db import connection

urlpatterns = [
    # Admin (Diagnostic)
    path("admin/", admin.site.urls),

    # API Documentation
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),

    # Health check
    path("api/health/", include("shared.urls")),

    # Authentication (public — JWT tokens)
    path("api/v1/auth/", include("apps.accounts.urls")),
    # Public kiosk check-in needs attendance routes when resolving on public schema.
    path("api/v1/attendance/", include("apps.attendance.urls")),

    # Tenant management (platform admin only)
    path("api/v1/platform/", include("apps.tenants.urls")),
    # Fallback for academy routes on public schema
    path("api/v1/academy/", include("apps.tenants.urls")),
    # Fallback for other core tenant modules
    path("api/v1/students/", include("apps.students.urls")),
    path("api/v1/belts/", include("apps.belts.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
