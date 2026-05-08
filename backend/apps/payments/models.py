"""
MAIDAN — Payment Provider Factory + Payment Models
"""

from decimal import Decimal
from typing import Optional

from django.conf import settings
from django.db import models

from apps.billing.models import Invoice
from apps.students.models import Student
from .providers.base import PaymentProvider, PaymentStatus


def get_payment_provider(provider_name: str) -> PaymentProvider:
    """
    Factory function — returns the correct provider instance by name.
    This is the single entry point for all payment operations.
    """
    from .providers.paytabs import PayTabsProvider
    from .providers.stripe_provider import StripeProvider
    from .providers.cash import CashProvider, ManualTransferProvider

    providers = {
        "paytabs": PayTabsProvider,
        "stripe": StripeProvider,
        "cash": CashProvider,
        "manual": ManualTransferProvider,
    }

    provider_class = providers.get(provider_name.lower())
    if not provider_class:
        raise ValueError(f"Unknown payment provider: {provider_name}. Choose from: {list(providers.keys())}")

    return provider_class()


class Payment(models.Model):
    """Record of a payment transaction."""

    class Provider(models.TextChoices):
        PAYTABS = "paytabs", "PayTabs"
        HYPERPAY = "hyperpay", "HyperPay"
        STRIPE = "stripe", "Stripe"
        CASH = "cash", "Cash"
        MANUAL = "manual", "Manual Transfer"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SUCCESS = "success", "Success"
        FAILED = "failed", "Failed"
        CANCELLED = "cancelled", "Cancelled"
        REFUNDED = "refunded", "Refunded"
        PARTIALLY_REFUNDED = "partially_refunded", "Partially Refunded"

    invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name="payments")
    student = models.ForeignKey(Student, on_delete=models.PROTECT, related_name="payments")

    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default="SAR")

    provider = models.CharField(max_length=20, choices=Provider.choices)
    provider_transaction_id = models.CharField(max_length=200, blank=True)
    provider_response = models.JSONField(default=dict, blank=True)

    status = models.CharField(max_length=30, choices=Status.choices, default=Status.PENDING)

    paid_at = models.DateTimeField(null=True, blank=True)
    receipt_url = models.URLField(blank=True)

    notes = models.TextField(blank=True)
    processed_by_id = models.UUIDField(null=True, blank=True)

    # Refund tracking
    refund_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    refunded_at = models.DateTimeField(null=True, blank=True)
    refund_reason = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["student", "status"]),
            models.Index(fields=["provider_transaction_id"]),
        ]

    def __str__(self):
        return f"Payment {self.provider_transaction_id} — {self.amount} {self.currency} ({self.status})"

    def mark_successful(self, transaction_id: str, receipt_url: str = ""):
        from django.utils import timezone
        self.status = self.Status.SUCCESS
        self.provider_transaction_id = transaction_id
        self.paid_at = timezone.now()
        self.receipt_url = receipt_url
        self.save(update_fields=["status", "provider_transaction_id", "paid_at", "receipt_url"])

        # Update invoice
        self.invoice.amount_paid += self.amount
        if self.invoice.amount_paid >= self.invoice.total_amount:
            self.invoice.status = Invoice.Status.PAID
            self.invoice.paid_at = timezone.now()
        else:
            self.invoice.status = Invoice.Status.PARTIALLY_PAID
        self.invoice.save(update_fields=["amount_paid", "status", "paid_at"])
