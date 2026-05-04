# MAIDAN — Scheduling App URLs
from django.urls import path, include
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
# TODO: Add ClassTypeViewSet, ClassScheduleViewSet, ClassSessionViewSet from attendance app here
urlpatterns = [path("", include("apps.attendance.urls"))]
