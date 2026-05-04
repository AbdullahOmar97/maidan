"""MAIDAN — Attendance URLs"""
from rest_framework.routers import DefaultRouter
from django.urls import path, include
from . import views

router = DefaultRouter()
router.register(r"class-types", views.ClassTypeViewSet, basename="class-type")
router.register(r"schedules", views.ClassScheduleViewSet, basename="class-schedule")
router.register(r"sessions", views.ClassSessionViewSet, basename="class-session")
router.register(r"records", views.AttendanceRecordViewSet, basename="attendance-record")

urlpatterns = [path("", include(router.urls))]
