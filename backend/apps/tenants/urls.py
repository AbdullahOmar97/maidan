"""MAIDAN — Tenants App URLs"""
from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import PlanViewSet, TenantViewSet

router = DefaultRouter()
router.register(r"plans", PlanViewSet, basename="plan")
router.register(r"tenants", TenantViewSet, basename="tenant")

urlpatterns = [
    path("me/", TenantViewSet.as_view({"get": "me", "patch": "me"})),
    path("", include(router.urls)),
]
