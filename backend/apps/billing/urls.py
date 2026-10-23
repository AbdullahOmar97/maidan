"""MAIDAN — Billing URLs"""
from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import (
    MembershipPlanViewSet, MembershipViewSet, InvoiceViewSet, PaymentViewSet,
    ExpenseCategoryViewSet, ExpenseViewSet, CreditNoteViewSet,
)

router = DefaultRouter()
router.register(r"plans", MembershipPlanViewSet, basename="membership-plan")
router.register(r"memberships", MembershipViewSet, basename="membership")
router.register(r"invoices", InvoiceViewSet, basename="invoice")
router.register(r"payments", PaymentViewSet, basename="payment")
router.register(r"expense-categories", ExpenseCategoryViewSet, basename="expense-category")
router.register(r"expenses", ExpenseViewSet, basename="expense")
router.register(r"credit-notes", CreditNoteViewSet, basename="credit-note")

urlpatterns = [path("", include(router.urls))]

