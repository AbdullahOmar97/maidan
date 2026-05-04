"""MAIDAN — Families URLs"""
from django.urls import path, include
from apps.students.views import FamilyViewSet
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register(r"", FamilyViewSet, basename="family")
urlpatterns = [path("", include(router.urls))]
