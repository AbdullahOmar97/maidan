"""
MAIDAN — Tenants App Models

Manages multi-tenancy using django-tenants (schema-per-tenant strategy).
Public schema only.
"""

from django.db import models
from django_tenants.models import DomainMixin, TenantMixin


class Plan(models.Model):
    """SaaS subscription plan definition."""

    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)

    # Limits
    max_locations = models.PositiveIntegerField(default=1)
    max_students = models.PositiveIntegerField(default=100)
    max_staff = models.PositiveIntegerField(default=10)
    max_sms_per_month = models.PositiveIntegerField(default=500)

    # Pricing
    price_monthly = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    price_yearly = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    currency = models.CharField(max_length=3, default="SAR")

    # Feature flags as JSON
    features = models.JSONField(
        default=dict,
        help_text='يجب إدخال نص JSON صالح. مثال: {"whatsapp": true, "kiosk": true}',
    )

    is_active = models.BooleanField(default=True)
    is_free = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "tenants"
        ordering = ["price_monthly"]

    def __str__(self):
        return self.name


class Tenant(TenantMixin):
    """
    Core tenant model. Each tenant gets its own PostgreSQL schema.
    Extends TenantMixin from django-tenants.
    """

    # Business info
    name = models.CharField(max_length=200)
    business_name = models.CharField(max_length=200, blank=True)
    slug = models.SlugField(unique=True)
    email = models.EmailField()
    phone = models.CharField(max_length=30, blank=True)

    class SubscriptionStatus(models.TextChoices):
        PENDING = "pending", "Pending Approval"
        ACTIVE = "active", "Active"
        INACTIVE = "inactive", "Inactive"
        EXPIRED = "expired", "Expired"

    status = models.CharField(
        max_length=20, 
        choices=SubscriptionStatus.choices, 
        default=SubscriptionStatus.PENDING
    )
    subscription_end_date = models.DateTimeField(null=True, blank=True)

    # Plan & billing
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    trial_ends_at = models.DateTimeField(null=True, blank=True)

    # Branding
    logo = models.ImageField(upload_to="tenant_logos/", null=True, blank=True)
    primary_color = models.CharField(max_length=7, default="#1a1a2e")
    secondary_color = models.CharField(max_length=7, default="#e94560")
    favicon = models.ImageField(upload_to="tenant_favicons/", null=True, blank=True)

    # Locale settings
    default_language = models.CharField(max_length=5, default="ar")
    default_currency = models.CharField(max_length=3, default="SAR")
    timezone = models.CharField(max_length=50, default="Asia/Riyadh")
    country = models.CharField(max_length=2, default="SA")

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    on_trial = models.BooleanField(default=True)

    # Required by django-tenants
    auto_create_schema = True

    class Meta:
        app_label = "tenants"

    def __str__(self):
        return f"{self.name} ({self.schema_name})"


class Domain(DomainMixin):
    """
    Domain/subdomain mapping for each tenant.
    e.g., dojo1.maidan.app → dojo1 tenant
    """

    class Meta:
        app_label = "tenants"


class TenantSubscription(models.Model):
    """Tracks billing subscription state per tenant."""

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        TRIALING = "trialing", "Trialing"
        PAST_DUE = "past_due", "Past Due"
        CANCELED = "canceled", "Canceled"
        UNPAID = "unpaid", "Unpaid"

    class BillingCycle(models.TextChoices):
        MONTHLY = "monthly", "Monthly"
        YEARLY = "yearly", "Yearly"

    tenant = models.OneToOneField(Tenant, on_delete=models.CASCADE, related_name="subscription")
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.TRIALING)
    billing_cycle = models.CharField(max_length=10, choices=BillingCycle.choices, default=BillingCycle.MONTHLY)

    # Payment provider tracking
    payment_provider = models.CharField(max_length=30, blank=True)
    external_subscription_id = models.CharField(max_length=200, blank=True)

    current_period_start = models.DateTimeField(null=True, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)

    cancel_at_period_end = models.BooleanField(default=False)
    canceled_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "tenants"

    def __str__(self):
        return f"{self.tenant.name} — {self.plan.name} ({self.status})"

    @property
    def is_active(self):
        return self.status in [self.Status.ACTIVE, self.Status.TRIALING]

class GlobalDefaultBelt(models.Model):
    """Platform-wide default belts to be seeded into new tenants."""
    martial_art = models.CharField(max_length=100, default="BJJ")
    name = models.CharField(max_length=100)
    name_ar = models.CharField(max_length=100, blank=True)
    color_hex = models.CharField(max_length=7, default="#FFFFFF")
    order_index = models.PositiveIntegerField(default=0)
    
    # Default Requirements
    min_attendance_sessions = models.PositiveIntegerField(default=0)
    min_months_since_last = models.PositiveIntegerField(default=0)
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "tenants"
        ordering = ["martial_art", "order_index"]
        verbose_name = "Global Default Belt"
        verbose_name_plural = "Global Default Belts"

    def __str__(self):
        return f"[{self.martial_art}] {self.name} ({self.name_ar})"
