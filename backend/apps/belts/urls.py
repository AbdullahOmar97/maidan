"""MAIDAN — Belts App URLs"""
from rest_framework.routers import DefaultRouter
from django.urls import path, include
from . import views

router = DefaultRouter()
router.register(r"ranks", views.BeltRankViewSet, basename="belt-rank")
router.register(r"promotions", views.StudentBeltViewSet, basename="student-belt")
router.register(r"eligibility", views.PromotionEligibilityViewSet, basename="promotion-eligibility")
router.register(r"exams", views.BeltExamViewSet, basename="belt-exam")
router.register(r"syllabus", views.BeltSyllabusRequirementViewSet, basename="belt-syllabus")
router.register(r"certificates", views.PromotionCertificateViewSet, basename="promotion-certificate")

urlpatterns = [
    path("verify/<uuid:token>/", views.public_verify_certificate_cross_tenant, name="verify-cert-standalone"),
    path("", include(router.urls)),
]
