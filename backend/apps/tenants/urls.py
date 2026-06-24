"""MAIDAN — Tenants App URLs"""
from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import PlanViewSet, TenantViewSet, SubscriptionChangeRequestViewSet

router = DefaultRouter()
router.register(r"plans", PlanViewSet, basename="plan")
router.register(r"tenants", TenantViewSet, basename="tenant")
router.register(r"subscription-requests", SubscriptionChangeRequestViewSet, basename="subscription-request")

urlpatterns = [
    path("me/", TenantViewSet.as_view({"get": "me", "patch": "me"})),
    path("public-info/", TenantViewSet.as_view({"get": "public_info"}), name="tenant-public-info"),
    path("", include(router.urls)),
]

