"""MAIDAN — Staff App"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.accounts.views import StaffViewSet
from .views import (
    StaffSalaryConfigViewSet,
    PayrollRunViewSet,
    StaffPayslipViewSet,
    StaffDocumentViewSet
)

router = DefaultRouter()
router.register(r"salary-configs", StaffSalaryConfigViewSet, basename="salary-config")
router.register(r"payroll-runs", PayrollRunViewSet, basename="payroll-run")
router.register(r"payslips", StaffPayslipViewSet, basename="payslip")
router.register(r"documents", StaffDocumentViewSet, basename="staff-document")
router.register(r"", StaffViewSet, basename="staff")

urlpatterns = [
    path("", include(router.urls)),
]

