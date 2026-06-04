"""
MAIDAN — Accounts Admin Configuration

Manages all platform users (staff, academy owners, students, etc.)
with a bulk action to force password reset on next login.
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import PasswordResetToken, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Admin panel for all registered users."""

    list_display = (
        "email",
        "first_name",
        "last_name",
        "role",
        "is_active",
        "force_password_reset",
        "is_staff",
        "last_login",
        "created_at",
    )
    list_filter = ("role", "is_active", "is_staff", "force_password_reset")
    search_fields = ("email", "first_name", "last_name", "phone")
    ordering = ("-created_at",)
    readonly_fields = ("id", "created_at", "updated_at", "last_login", "last_login_ip")
    actions = ["force_reset_password", "clear_force_reset_password"]

    fieldsets = (
        ("Identity (الهوية)", {
            "fields": ("id", "email", "first_name", "last_name", "phone", "avatar"),
        }),
        ("Role & Status (الدور والحالة)", {
            "fields": ("role", "is_active", "is_staff", "is_superuser"),
        }),
        ("Password & Security (كلمة المرور والأمان)", {
            "fields": ("force_password_reset", "is_initial_password_set"),
        }),
        ("Preferences (التفضيلات)", {
            "fields": ("language_pref", "assigned_location_ids", "permissions"),
        }),
        ("Consent (الموافقة)", {
            "fields": ("gdpr_consent", "gdpr_consent_at"),
        }),
        ("Audit (السجلات)", {
            "fields": ("created_at", "updated_at", "last_login", "last_login_ip"),
        }),
    )

    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": (
                "email", "first_name", "last_name", "phone",
                "role", "password1", "password2",
            ),
        }),
    )

    # ---------- Bulk actions ----------

    @admin.action(description="إعادة تعيين كلمة المرور عند تسجيل الدخول التالي")
    def force_reset_password(self, request, queryset):
        updated = queryset.update(force_password_reset=True)
        self.message_user(
            request,
            f"تم تفعيل إعادة تعيين كلمة المرور لـ {updated} مستخدم(ين).",
        )

    @admin.action(description="إلغاء إعادة تعيين كلمة المرور الإجبارية")
    def clear_force_reset_password(self, request, queryset):
        updated = queryset.update(force_password_reset=False)
        self.message_user(
            request,
            f"تم إلغاء إعادة تعيين كلمة المرور الإجبارية لـ {updated} مستخدم(ين).",
        )


@admin.register(PasswordResetToken)
class PasswordResetTokenAdmin(admin.ModelAdmin):
    list_display = ("user", "is_used", "expires_at", "created_at")
    list_filter = ("is_used",)
    search_fields = ("user__email",)
    readonly_fields = ("token", "created_at")
