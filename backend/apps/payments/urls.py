"""MAIDAN — Payments URLs"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r"", views.PaymentViewSet, basename="payment")

urlpatterns = [
    path("webhook/paytabs/", views.PayTabsWebhookView.as_view(), name="paytabs-webhook"),
    path("webhook/stripe/", views.StripeWebhookView.as_view(), name="stripe-webhook"),
    path("", include(router.urls)),
]
