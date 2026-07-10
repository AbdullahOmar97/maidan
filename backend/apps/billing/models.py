"""
MAIDAN — Billing App Models

Memberships, invoices, payments tracking.
"""

import uuid

from django.db import models
from apps.students.models import Student, Location
from apps.tenants.models import CURRENCY_CHOICES


class MembershipPlan(models.Model):
    """Sports Club-defined membership plan templates."""

    class BillingCycle(models.TextChoices):
        WEEKLY = "weekly", "Weekly"
        MONTHLY = "monthly", "Monthly"
        QUARTERLY = "quarterly", "Quarterly (3 months)"
        SEMI_ANNUAL = "semi_annual", "Semi-Annual (6 months)"
        ANNUAL = "annual", "Annual"
        ONE_TIME = "one_time", "One-Time"

    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)

    billing_cycle = models.CharField(max_length=20, choices=BillingCycle.choices, default=BillingCycle.MONTHLY)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default="JOD")
    setup_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=15.0)  # VAT 15% Saudi

    # Access control
    location = models.ForeignKey(Location, on_delete=models.SET_NULL, null=True, blank=True)
    max_classes_per_week = models.PositiveIntegerField(null=True, blank=True)
    is_unlimited = models.BooleanField(default=True)
    allowed_class_types = models.ManyToManyField("attendance.ClassType", blank=True)

    is_active = models.BooleanField(default=True)
    is_public = models.BooleanField(default=True)  # Show on registration page
    sort_order = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "price"]

    def __str__(self):
        return f"{self.name} — {self.price} {self.currency}/{self.billing_cycle}"


class Membership(models.Model):
    """Active/historical membership for a student."""

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        EXPIRED = "expired", "Expired"
        CANCELLED = "cancelled", "Cancelled"
        PAUSED = "paused", "Paused"
        PENDING = "pending", "Pending Payment"
        PENDING_APPROVAL = "pending_approval", "Pending Approval"

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="memberships")
    plan = models.ForeignKey(MembershipPlan, on_delete=models.PROTECT, related_name="subscriptions")

    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)

    auto_renew = models.BooleanField(default=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.TextField(blank=True)
    paused_at = models.DateTimeField(null=True, blank=True)
    pause_reason = models.TextField(blank=True)

    # Approval tracking
    approved_by_id = models.UUIDField(null=True, blank=True)  # FK to User who approved
    approved_at = models.DateTimeField(null=True, blank=True)

    notes = models.TextField(blank=True)
    created_by_id = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["student", "status"]),
            models.Index(fields=["end_date", "status"]),
        ]

    def __str__(self):
        return f"{self.student} — {self.plan.name} ({self.status})"

    @property
    def is_active(self):
        return self.status == self.Status.ACTIVE


class Invoice(models.Model):
    """Invoice issued to a student for a membership or service."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PENDING = "pending", "Pending"
        PAID = "paid", "Paid"
        OVERDUE = "overdue", "Overdue"
        VOID = "void", "Void"
        REFUNDED = "refunded", "Refunded"
        PARTIALLY_PAID = "partially_paid", "Partially Paid"

    invoice_number = models.CharField(max_length=30, unique=True, blank=True)
    student = models.ForeignKey(Student, on_delete=models.PROTECT, related_name="invoices")
    membership = models.ForeignKey(
        Membership, on_delete=models.SET_NULL, null=True, blank=True, related_name="invoices"
    )

    # Amounts
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=15.0)
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default="JOD")

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    due_date = models.DateField()
    paid_at = models.DateTimeField(null=True, blank=True)

    notes = models.TextField(blank=True)
    is_recurring = models.BooleanField(default=False)

    # Retry tracking
    retry_count = models.PositiveIntegerField(default=0)
    last_retry_at = models.DateTimeField(null=True, blank=True)
    next_retry_at = models.DateTimeField(null=True, blank=True)

    created_by_id = models.UUIDField(null=True, blank=True)  # Staff who created the invoice
    paid_by_id = models.UUIDField(null=True, blank=True)      # Staff who confirmed payment receipt
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "due_date"]),
            models.Index(fields=["student", "status"]),
        ]

    def __str__(self):
        return f"Invoice {self.invoice_number} — {self.student} ({self.status})"

    def save(self, *args, **kwargs):
        if not self.invoice_number:
            self._generate_invoice_number()
        if not self.tax_amount:
            self.tax_amount = self.subtotal * (self.tax_rate / 100)
        if not self.total_amount:
            self.total_amount = self.subtotal - self.discount_amount + self.tax_amount
        super().save(*args, **kwargs)

    def _generate_invoice_number(self):
        from django.db import connection, transaction
        from django.utils import timezone

        year = timezone.now().year
        prefix = f"INV-{year}-"
        lock_token = f"maidan:invoice_seq:{year}"
        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", [lock_token])
            last = (
                Invoice.objects.filter(invoice_number__startswith=prefix)
                .order_by("-invoice_number")
                .values_list("invoice_number", flat=True)
                .first()
            )
            if last:
                try:
                    seq = int(last.rsplit("-", 1)[-1]) + 1
                except (ValueError, IndexError):
                    seq = 1
            else:
                seq = 1
            self.invoice_number = f"{prefix}{seq:05d}"

    @property
    def amount_due(self):
        return self.total_amount - self.amount_paid


# ---------------------------------------------------------------------------
# Signals
# ---------------------------------------------------------------------------

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone as tz


@receiver(post_save, sender="billing.Membership")
def auto_create_invoice_for_membership(sender, instance, created, **kwargs):
    """
    Automatically generate a pending Invoice whenever a new Membership is
    created.  This ensures every subscription has a corresponding financial
    record without requiring manual invoice entry.

    Skipped when:
    - The membership was not just created (update path).
    - The membership is in PENDING_APPROVAL status (invoice created after approval).
    - An invoice already exists for this membership (safety guard).
    """
    if not created:
        return

    if instance.status == Membership.Status.PENDING_APPROVAL:
        return

    # Guard: skip if an invoice already exists (e.g. fixtures / data migration)
    if instance.invoices.exists():
        return

    plan = instance.plan
    subtotal = plan.price + plan.setup_fee
    tax_amount = subtotal * (plan.tax_rate / 100)
    total_amount = subtotal + tax_amount

    # due_date = today for one-time, or start_date for recurring
    due_date = instance.start_date or tz.now().date()

    Invoice.objects.create(
        student=instance.student,
        membership=instance,
        subtotal=subtotal,
        discount_amount=0,
        tax_rate=plan.tax_rate,
        tax_amount=tax_amount,
        total_amount=total_amount,
        amount_paid=0,
        currency=plan.currency,
        status=Invoice.Status.PENDING,
        due_date=due_date,
        is_recurring=(plan.billing_cycle != MembershipPlan.BillingCycle.ONE_TIME),
        created_by_id=instance.created_by_id,
    )


@receiver(post_save, sender=Invoice)
def reactivate_student_on_invoice_payment(sender, instance, **kwargs):
    """
    Check if a student whose status is SUSPENDED has paid off all overdue invoices.
    If so, automatically restore their status to ACTIVE.
    """
    student = instance.student
    if student.status == Student.Status.SUSPENDED:
        # Check if they have any remaining overdue invoices older than 7 days
        from datetime import timedelta
        seven_days_ago = tz.now().date() - timedelta(days=7)
        has_overdue = Invoice.objects.filter(
            student=student,
            status="overdue",
            due_date__lte=seven_days_ago
        ).exists()
        
        if not has_overdue:
            student.status = Student.Status.ACTIVE
            student.save(update_fields=["status"])
