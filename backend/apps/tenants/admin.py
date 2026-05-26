from django import forms
from django.contrib import admin

from .models import Domain, Plan, Tenant, TenantSubscription, GlobalDefaultBelt, PlatformSettings


@admin.register(GlobalDefaultBelt)
class GlobalDefaultBeltAdmin(admin.ModelAdmin):
    list_display = ("name", "name_ar", "martial_art", "order_index", "min_attendance_sessions", "min_months_since_last", "is_active")
    list_filter = ("martial_art", "is_active")
    search_fields = ("name", "name_ar")
    ordering = ("martial_art", "order_index")

@admin.register(PlatformSettings)
class PlatformSettingsAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        if PlatformSettings.objects.exists():
            return False
        return super().has_add_permission(request)

FEATURE_CHOICES = (
    ("whatsapp", "WhatsApp Notifications (تنبيهات واتساب)"),
    ("kiosk", "Attendance Kiosk (جهاز الحضور والبحث)"),
    ("reports", "Advanced Reporting (التقارير المتقدمة)"),
    ("billing", "Billing & Invoices (الفواتير والاشتراكات)"),
    ("staff", "Staff Management (إدارة المدربين)"),
    ("documents", "Student Documents (وثائق الطلاب)"),
)


class PlanAdminForm(forms.ModelForm):
    feature_list = forms.MultipleChoiceField(
        choices=FEATURE_CHOICES,
        widget=forms.CheckboxSelectMultiple,
        required=False,
        label="المميزات الأساسية (Standard Features)",
        help_text="اختر المميزات الجاهزة لتفعيلها"
    )
    custom_features = forms.CharField(
        widget=forms.Textarea(attrs={"rows": 3}),
        required=False,
        label="مميزات إضافية (Custom Features)",
        help_text="أدخل مميزات إضافية (ميزة واحدة في كل سطر)"
    )

    class Meta:
        model = Plan
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.pk and self.instance.features:
            # Load standard features
            standard_keys = [c[0] for c in FEATURE_CHOICES]
            selected = [k for k, v in self.instance.features.items() if v and k in standard_keys]
            self.fields["feature_list"].initial = selected
            
            # Load custom features
            custom = [k for k, v in self.instance.features.items() if v and k not in standard_keys]
            self.fields["custom_features"].initial = "\n".join(custom)

    def save(self, commit=True):
        instance = super().save(commit=False)
        # 1. Get standard selected features
        selected = self.cleaned_data.get("feature_list", [])
        features_dict = {choice[0]: (choice[0] in selected) for choice in FEATURE_CHOICES}
        
        # 2. Add custom features from textarea
        custom_text = self.cleaned_data.get("custom_features", "")
        for line in custom_text.split("\n"):
            feature_name = line.strip().lower().replace(" ", "_")
            if feature_name:
                features_dict[feature_name] = True
                
        instance.features = features_dict
        if commit:
            instance.save()
        return instance


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    form = PlanAdminForm
    list_display = ("name", "slug", "price_monthly", "currency", "is_active", "is_free", "max_students", "max_staff", "max_locations")
    list_filter = ("is_active", "is_free", "currency")
    search_fields = ("name", "slug")
    
    fieldsets = (
        ("Basic Information (المعلومات الأساسية)", {
            "fields": ("name", "slug", "description", "is_active", "is_free")
        }),
        ("Pricing & Billing (الأسعار والفوترة)", {
            "fields": ("price_monthly", "price_yearly", "currency")
        }),
        ("Subscription Limits (حدود الاشتراك)", {
            "fields": ("max_students", "max_staff", "max_locations", "max_sms_per_month"),
            "description": "حدد الطاقة الاستيعابية والحدود المتاحة لهذا الاشتراك"
        }),
        ("Plan Features (مميزات الباقة)", {
            "fields": ("feature_list", "custom_features")
        }),
    )


class DomainInline(admin.TabularInline):
    model = Domain
    extra = 1
    fields = ("domain", "is_primary")


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = ("name", "schema_name", "status", "is_active", "subscription_end_date", "plan", "email")
    list_filter = ("status", "is_active", "plan", "default_language")
    search_fields = ("name", "slug", "schema_name", "email")
    actions = ["activate_tenants", "deactivate_tenants"]
    readonly_fields = ("created_at", "updated_at")
    inlines = [DomainInline]
    fieldsets = (
        ("Tenant Identity", {"fields": ("name", "business_name", "slug", "schema_name")}),
        ("Contact", {"fields": ("email", "phone")}),
        ("Subscription", {"fields": ("plan", "status", "is_active", "subscription_end_date", "on_trial", "trial_ends_at")}),
        ("Branding", {"fields": ("logo", "favicon")}),
        (
            "Locale",
            {"fields": ("default_language", "default_currency", "timezone", "country")},
        ),
        ("Audit", {"fields": ("created_at", "updated_at")}),
    )

    @admin.action(description="تفعيل وقبول الأكاديميات المختارة")
    def activate_tenants(self, request, queryset):
        queryset.update(status=Tenant.SubscriptionStatus.ACTIVE, is_active=True)
        self.message_user(request, "تم تفعيل الأكاديميات المختارة بنجاح.")

    @admin.action(description="تعطيل الأكاديميات المختارة")
    def deactivate_tenants(self, request, queryset):
        queryset.update(status=Tenant.SubscriptionStatus.INACTIVE, is_active=False)
        self.message_user(request, "تم تعطيل الأكاديميات المختارة.")


@admin.register(Domain)
class DomainAdmin(admin.ModelAdmin):
    list_display = ("domain", "tenant", "is_primary")
    list_filter = ("is_primary",)
    search_fields = ("domain", "tenant__name", "tenant__schema_name")


@admin.register(TenantSubscription)
class TenantSubscriptionAdmin(admin.ModelAdmin):
    list_display = (
        "tenant",
        "plan",
        "status",
        "billing_cycle",
        "current_period_start",
        "current_period_end",
    )
    list_filter = ("status", "billing_cycle", "plan")
    search_fields = ("tenant__name", "tenant__schema_name", "external_subscription_id")
