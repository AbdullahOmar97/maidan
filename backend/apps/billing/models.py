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

    @staticmethod
    def compute_end_date(start_date, billing_cycle: str):
        if not start_date or billing_cycle == MembershipPlan.BillingCycle.ONE_TIME:
            return None
        from datetime import timedelta
        import calendar

        def add_months(d, months: int):
            month = d.month - 1 + months
            year = d.year + month // 12
            month = month % 12 + 1
            day = min(d.day, calendar.monthrange(year, month)[1])
            return d.replace(year=year, month=month, day=day)

        if billing_cycle == MembershipPlan.BillingCycle.WEEKLY:
            return start_date + timedelta(days=7)
        if billing_cycle == MembershipPlan.BillingCycle.MONTHLY:
            return add_months(start_date, 1)
        if billing_cycle == MembershipPlan.BillingCycle.QUARTERLY:
            return add_months(start_date, 3)
        if billing_cycle == MembershipPlan.BillingCycle.SEMI_ANNUAL:
            return add_months(start_date, 6)
        if billing_cycle == MembershipPlan.BillingCycle.ANNUAL:
            return add_months(start_date, 12)
        return add_months(start_date, 1)

    def save(self, *args, **kwargs):
        if not self.end_date and self.start_date and self.plan_id:
            self.end_date = self.compute_end_date(self.start_date, self.plan.billing_cycle)
        super().save(*args, **kwargs)


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
# Expense & Outflow Accounting Models
# ---------------------------------------------------------------------------

class ExpenseCategory(models.Model):
    """
    Standardized Chart of Expense Accounts for Sports Academies.
    Enables managerial categorization of all operational and capital outflows.
    """
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=50, blank=True)
    description = models.TextField(blank=True)
    is_system = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "name"]
        verbose_name_plural = "Expense Categories"

    def __str__(self):
        return self.name


class Expense(models.Model):
    """
    Accounting Outflow / Disbursement Record (المصروفات والمدفوعات).
    Tracks all operational, facility, and administrative expenses.
    """
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PENDING = "pending", "Pending Approval"
        APPROVED = "approved", "Approved"
        PAID = "paid", "Paid"
        CANCELLED = "cancelled", "Cancelled"

    class PaymentMethod(models.TextChoices):
        CASH = "cash", "Cash"
        BANK_TRANSFER = "bank_transfer", "Bank Transfer"
        CARD = "card", "Credit/Debit Card"
        CHECK = "check", "Check"
        OTHER = "other", "Other"

    expense_number = models.CharField(max_length=30, unique=True, blank=True)
    title = models.CharField(max_length=255)
    category = models.ForeignKey(ExpenseCategory, on_delete=models.PROTECT, related_name="expenses")
    location = models.ForeignKey(Location, on_delete=models.SET_NULL, null=True, blank=True, related_name="expenses")

    vendor_name = models.CharField(max_length=200, blank=True)
    vendor_tax_number = models.CharField(max_length=100, blank=True)
    invoice_reference = models.CharField(max_length=100, blank=True)

    # Financial Breakdown
    amount = models.DecimalField(max_digits=10, decimal_places=2)  # Net amount before tax
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)  # Gross total paid
    currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default="JOD")

    # Payment info
    payment_method = models.CharField(max_length=20, choices=PaymentMethod.choices, default=PaymentMethod.BANK_TRANSFER)
    payment_reference = models.CharField(max_length=100, blank=True)

    # Accounting Dates
    expense_date = models.DateField()
    payment_date = models.DateField(null=True, blank=True)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PAID)
    receipt_url = models.CharField(max_length=500, blank=True)
    is_recurring = models.BooleanField(default=False)
    notes = models.TextField(blank=True)

    # Audit & Approval Workflow
    created_by_id = models.UUIDField(null=True, blank=True)
    approved_by_id = models.UUIDField(null=True, blank=True)
    paid_by_id = models.UUIDField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-expense_date", "-created_at"]
        indexes = [
            models.Index(fields=["status", "expense_date"]),
            models.Index(fields=["category", "status"]),
            models.Index(fields=["location", "expense_date"]),
        ]

    def __str__(self):
        return f"{self.expense_number} — {self.title} ({self.total_amount} {self.currency})"

    def save(self, *args, **kwargs):
        if not self.expense_number:
            self._generate_expense_number()
        if not self.tax_amount and self.tax_rate > 0:
            self.tax_amount = round(self.amount * (self.tax_rate / 100), 2)
        if not self.total_amount:
            self.total_amount = self.amount + (self.tax_amount or 0)
        if self.status == self.Status.PAID and not self.payment_date:
            self.payment_date = self.expense_date
        super().save(*args, **kwargs)

    def _generate_expense_number(self):
        from django.db import connection, transaction
        from django.utils import timezone

        year = timezone.now().year
        prefix = f"EXP-{year}-"
        lock_token = f"maidan:expense_seq:{year}"
        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", [lock_token])
            last = (
                Expense.objects.filter(expense_number__startswith=prefix)
                .order_by("-expense_number")
                .values_list("expense_number", flat=True)
                .first()
            )
            if last:
                try:
                    seq = int(last.rsplit("-", 1)[-1]) + 1
                except (ValueError, IndexError):
                    seq = 1
            else:
                seq = 1
            self.expense_number = f"{prefix}{seq:05d}"


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
