"""
MAIDAN — Health check URL
"""

from django.urls import path
from django.http import JsonResponse
from django.db import connection
from django.core.cache import cache
import django


def health_check(request):
    """Returns platform health status."""
    checks = {}

    # DB check
    try:
        connection.ensure_connection()
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {e}"

    # Cache/Redis check
    try:
        cache.set("health_check", "ok", 10)
        val = cache.get("health_check")
        checks["cache"] = "ok" if val == "ok" else "error"
    except Exception as e:
        checks["cache"] = f"error: {e}"

    checks["django_version"] = django.get_version()

    all_ok = all(v == "ok" for v in checks.values() if isinstance(v, str) and v != django.get_version())

    return JsonResponse(
        {"status": "healthy" if all_ok else "degraded", "checks": checks},
        status=200 if all_ok else 503,
    )


urlpatterns = [
    path("", health_check, name="health_check"),
]
