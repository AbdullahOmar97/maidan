"""MAIDAN — Belts App URLs"""
from rest_framework.routers import DefaultRouter
from django.urls import path, include
from . import views

router = DefaultRouter()
router.register(r"ranks", views.BeltRankViewSet, basename="belt-rank")
router.register(r"promotions", views.StudentBeltViewSet, basename="student-belt")
router.register(r"eligibility", views.PromotionEligibilityViewSet, basename="promotion-eligibility")
router.register(r"exams", views.BeltExamViewSet, basename="belt-exam")

urlpatterns = [path("", include(router.urls))]
