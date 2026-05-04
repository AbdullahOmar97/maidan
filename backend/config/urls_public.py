"""
MAIDAN — Tenant URL Configuration
Routes available within each tenant schema.
"""

from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

urlpatterns = [
    # API Documentation
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),

    # Auth (also available per-tenant)
    path("api/v1/auth/", include("apps.accounts.urls")),

    # Core modules
    path("api/v1/students/", include("apps.students.urls")),
    path("api/v1/families/", include("apps.families.urls")),
    path("api/v1/attendance/", include("apps.attendance.urls")),
    path("api/v1/belts/", include("apps.belts.urls")),
    path("api/v1/billing/", include("apps.billing.urls")),
    path("api/v1/payments/", include("apps.payments.urls")),
    path("api/v1/scheduling/", include("apps.scheduling.urls")),
    path("api/v1/messaging/", include("apps.messaging.urls")),
    path("api/v1/reporting/", include("apps.reporting.urls")),
    path("api/v1/staff/", include("apps.staff.urls")),
    path("api/v1/audit/", include("apps.audit.urls")),
    path("api/v1/academy/", include("apps.tenants.urls")),
]
