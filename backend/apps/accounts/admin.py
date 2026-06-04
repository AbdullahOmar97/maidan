"""
MAIDAN — Accounts Admin Configuration

Manages all platform users (staff, academy owners, students, etc.)
with a bulk action to force password reset on next login.
"""

from datetime import timedelta
from django.conf import settings
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.shortcuts import get_object_or_404, render
from django.urls import path, reverse
from django.utils import timezone
from django.utils.html import format_html

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
    readonly_fields = ("id", "created_at", "updated_at", "last_login", "last_login_ip", "reset_password_link_button")
    actions = ["force_reset_password", "clear_force_reset_password", "generate_reset_links_action"]

    fieldsets = (
        ("Identity (الهوية)", {
            "fields": ("id", "email", "first_name", "last_name", "phone", "avatar"),
        }),
        ("Role & Status (الدور والحالة)", {
            "fields": ("role", "is_active", "is_staff", "is_superuser"),
        }),
        ("Password & Security (كلمة المرور والأمان)", {
            "fields": ("force_password_reset", "is_initial_password_set", "reset_password_link_button"),
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

    @admin.action(description="توليد روابط إعادة تعيين كلمة المرور للمستخدمين المحددين")
    def generate_reset_links_action(self, request, queryset):
        results = []
        for user in queryset:
            token_obj = PasswordResetToken.objects.create(
                user=user,
                expires_at=timezone.now() + timedelta(hours=24),
            )
            reset_url = self._get_reset_url(request, user, token_obj.token)
            results.append({
                "user": user,
                "reset_url": reset_url,
            })
            
        context = {
            **self.admin_site.each_context(request),
            "title": "روابط إعادة تعيين كلمة المرور",
            "results": results,
            "opts": self.model._meta,
        }
        return render(request, "accounts/admin_reset_links.html", context)

    # ---------- URL Routing & Custom Views ----------

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                "<uuid:user_id>/generate-reset-link/",
                self.admin_site.admin_view(self.generate_reset_link_view),
                name="generate-reset-link",
            ),
        ]
        return custom_urls + urls

    def generate_reset_link_view(self, request, user_id):
        user = get_object_or_404(User, pk=user_id)
        token_obj = PasswordResetToken.objects.create(
            user=user,
            expires_at=timezone.now() + timedelta(hours=24),
        )
        reset_url = self._get_reset_url(request, user, token_obj.token)
        
        context = {
            **self.admin_site.each_context(request),
            "title": "روابط إعادة تعيين كلمة المرور",
            "results": [
                {
                    "user": user,
                    "reset_url": reset_url,
                }
            ],
            "opts": self.model._meta,
        }
        return render(request, "accounts/admin_reset_links.html", context)

    def changeform_view(self, request, object_id=None, form_url='', extra_context=None):
        self._current_request = request
        try:
            return super().changeform_view(request, object_id, form_url, extra_context)
        finally:
            if hasattr(self, "_current_request"):
                del self._current_request

    def reset_password_link_button(self, obj):
        if not obj.pk:
            return "يجب حفظ المستخدم أولاً لتوليد الرابط."
        
        request = getattr(self, "_current_request", None)
        if not request:
            return "يجب فتح صفحة تعديل المستخدم مباشرة لتوليد الرابط."
            
        token_obj = PasswordResetToken.objects.create(
            user=obj,
            expires_at=timezone.now() + timedelta(hours=24),
        )
        reset_url = self._get_reset_url(request, obj, token_obj.token)
        
        return format_html(
            '<div class="reset-link-container" style="display: flex; align-items: center; gap: 8px; max-width: 600px;">'
            '    <input type="text" id="reset-url-input" value="{}" readonly class="vTextField" style="flex: 1; font-family: monospace; background: #f8fafc; font-size: 12px; padding: 6px 10px;" onclick="this.select();" />'
            '    <button type="button" id="copy-reset-btn" class="button" onclick="copyResetUrl()" style="margin: 0; background: #2563eb; color: white; padding: 6px 14px; font-weight: bold; border: none; border-radius: 4px; cursor: pointer;">نسخ الرابط</button>'
            '</div>'
            '<span class="help" style="display: block; margin-top: 6px; color: #64748b; font-size: 11px;">'
            '    تم توليد رابط جديد تلقائياً عند فتح هذه الصفحة. هذا الرابط صالح لمدة 24 ساعة.'
            '</span>'
            '<script>'
            'function copyResetUrl() {{'
            '    var copyText = document.getElementById("reset-url-input");'
            '    copyText.select();'
            '    navigator.clipboard.writeText(copyText.value).then(function() {{'
            '        var btn = document.getElementById("copy-reset-btn");'
            '        var originalText = btn.innerText;'
            '        btn.innerText = "تم النسخ!";'
            '        btn.style.background = "#10b981";'
            '        setTimeout(function() {{'
            '            btn.innerText = originalText;'
            '            btn.style.background = "#2563eb";'
            '        }}, 2000);'
            '    }}).catch(function(err) {{'
            '        alert("فشل نسخ الرابط: " + err);'
            '    }});'
            '}}'
            '</script>',
            reset_url
        )
    reset_password_link_button.short_description = "رابط إعادة تعيين كلمة المرور (جديد تلقائياً)"

    def _get_reset_url(self, request, user, token):
        from apps.tenants.models import Tenant
        from django_tenants.utils import schema_context
        
        tenant = None
        candidates = Tenant.objects.exclude(schema_name="public").order_by("id")
        for cand in candidates:
            try:
                with schema_context(cand.schema_name):
                    from apps.staff.models import StaffMember
                    if StaffMember.objects.filter(user_id=user.id).exists():
                        tenant = cand
                        break
            except Exception:
                pass
        
        if not tenant:
            tenant = candidates.filter(email__iexact=user.email).order_by("id").first()
            
        from apps.tenants.models import Domain
        if tenant:
            domain_obj = Domain.objects.filter(tenant=tenant).order_by("-is_primary", "id").first()
            host = domain_obj.domain if domain_obj else getattr(settings, "PLATFORM_DOMAIN", "localhost")
        else:
            host = getattr(settings, "PLATFORM_DOMAIN", "localhost")
            
        request_host = request.get_host().lower()
        is_local = "localhost" in request_host or "127.0.0.1" in request_host
        
        scheme = "http" if is_local else "https"
        host_clean = host.split(":")[0]
        
        if is_local:
            host_with_port = f"{host_clean}:3000"
        else:
            host_with_port = host_clean
            
        return f"{scheme}://{host_with_port}/reset-password?token={token}"



@admin.register(PasswordResetToken)
class PasswordResetTokenAdmin(admin.ModelAdmin):
    list_display = ("user", "is_used", "expires_at", "created_at")
    list_filter = ("is_used",)
    search_fields = ("user__email",)
    readonly_fields = ("token", "created_at")
