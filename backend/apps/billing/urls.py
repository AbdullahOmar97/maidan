"""MAIDAN — Billing URLs"""
from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import MembershipPlanViewSet, MembershipViewSet, InvoiceViewSet, PaymentViewSet

router = DefaultRouter()
router.register(r"plans", MembershipPlanViewSet, basename="membership-plan")
router.register(r"memberships", MembershipViewSet, basename="membership")
router.register(r"invoices", InvoiceViewSet, basename="invoice")
router.register(r"payments", PaymentViewSet, basename="payment")

urlpatterns = [path("", include(router.urls))]
