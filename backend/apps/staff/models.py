from django.db import models
from django.conf import settings
from apps.tenants.models import CURRENCY_CHOICES


class StaffMember(models.Model):
    """
    Links a global User to a specific tenant schema.
    Since the 'staff' app is in TENANT_APPS, this model lives in the tenant schema.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="staff_memberships"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Staff Member"
        verbose_name_plural = "Staff Members"
        # Ensure a user is only listed once per tenant
        unique_together = ("user",)

    def __str__(self):
        return f"{self.user.get_full_name()} in current tenant"


class StaffSalaryConfig(models.Model):
    """Configuration for employee salaries and hourly/session rates."""
    
    class EmploymentType(models.TextChoices):
        FULL_TIME = "full_time", "Monthly Fixed (راتب شهري ثابت)"
        PART_TIME = "part_time", "Hourly Rate (أجر بالساعة)"
        SESSION_BASED = "session_based", "Session Rate (أجر بالحصة)"

    staff_member = models.OneToOneField(
        StaffMember,
        on_delete=models.CASCADE,
        related_name="salary_config"
    )
    employment_type = models.CharField(
        max_length=20,
        choices=EmploymentType.choices,
        default=EmploymentType.FULL_TIME
    )
    basic_salary = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        help_text="الراتب الأساسي الشهري"
    )
    hourly_rate = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        help_text="سعر ساعة العمل للموظفين بالساعة"
    )
    session_rate = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        help_text="سعر الحصة/الكلاس للمدربين بالحصة"
    )
    currency = models.CharField(
        max_length=3,
        choices=CURRENCY_CHOICES,
        default="JOD"
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Staff Salary Configuration"
        verbose_name_plural = "Staff Salary Configurations"

    def __str__(self):
        return f"Salary Config for {self.staff_member.user.get_full_name()}"


class PayrollRun(models.Model):
    """Represents a monthly payroll execution run."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft (مسودة)"
        APPROVED = "approved", "Approved (معتمد)"
        PAID = "paid", "Paid (مدفوع)"

    year = models.PositiveIntegerField()
    month = models.PositiveSmallIntegerField()
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Payroll Run"
        verbose_name_plural = "Payroll Runs"
        unique_together = ("year", "month")
        ordering = ["-year", "-month"]

    def __str__(self):
        return f"Payroll Run — {self.year}/{self.month:02d} ({self.get_status_display()})"


class StaffPayslip(models.Model):
    """Individual payout record for a staff member during a payroll run."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending (معلق)"
        PAID = "paid", "Paid (مدفوع)"

    class PaymentMethod(models.TextChoices):
        CASH = "cash", "Cash (نقداً)"
        BANK_TRANSFER = "bank_transfer", "Bank Transfer (تحويل بنكي)"
        CHECK = "check", "Check (شيك)"
        OTHER = "other", "Other (أخرى)"

    payroll_run = models.ForeignKey(
        PayrollRun,
        on_delete=models.CASCADE,
        related_name="payslips"
    )
    staff_member = models.ForeignKey(
        StaffMember,
        on_delete=models.PROTECT,
        related_name="payslips"
    )
    employment_type = models.CharField(
        max_length=20,
        choices=StaffSalaryConfig.EmploymentType.choices
    )
    basic_salary = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0
    )
    calculated_units = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        help_text="عدد الساعات أو الحصص المنجزة"
    )
    unit_rate = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        help_text="أجر الساعة أو الحصة"
    )
    allowances = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        help_text="علاوات وإضافات"
    )
    deductions = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        help_text="خصومات واستقطاعات"
    )
    net_salary = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING
    )
    payment_date = models.DateField(null=True, blank=True)
    payment_method = models.CharField(
        max_length=20,
        choices=PaymentMethod.choices,
        default=PaymentMethod.CASH
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Staff Payslip"
        verbose_name_plural = "Staff Payslips"
        unique_together = ("payroll_run", "staff_member")

    def __str__(self):
        return f"Payslip for {self.staff_member.user.get_full_name()} — {self.payroll_run.year}/{self.payroll_run.month}"

    def save(self, *args, **kwargs):
        # Auto calculate net salary before save
        self.net_salary = (
            self.basic_salary
            + (self.calculated_units * self.unit_rate)
            + self.allowances
            - self.deductions
        )
        super().save(*args, **kwargs)


class StaffDocument(models.Model):
    """Official files/documents associated with staff members (e.g. contracts, IDs)."""

    staff_member = models.ForeignKey(
        StaffMember,
        on_delete=models.CASCADE,
        related_name="documents"
    )
    name = models.CharField(max_length=255)
    file = models.FileField(upload_to="staff_documents/%Y/%m/")
    notes = models.TextField(blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Staff Document"
        verbose_name_plural = "Staff Documents"
        ordering = ["-uploaded_at"]

    def __str__(self):
        return f"{self.name} for {self.staff_member.user.get_full_name()}"

