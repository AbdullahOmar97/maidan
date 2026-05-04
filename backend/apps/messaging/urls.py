"""MAIDAN — Messaging URLs"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r"templates", views.MessageTemplateViewSet, basename="message-template")
router.register(r"logs", views.NotificationLogViewSet, basename="notification-log")
router.register(r"campaigns", views.BroadcastCampaignViewSet, basename="broadcast-campaign")

urlpatterns = [path("", include(router.urls))]
