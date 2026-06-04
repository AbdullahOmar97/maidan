"""
MAIDAN — Accounts App Models

Custom User model with role-based access control.
Lives in the public schema (shared across all tenants).
"""

import uuid

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", User.Role.PLATFORM_ADMIN)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom User model — central identity for MAIDAN.
    A user can belong to multiple tenants (via UserTenantMembership).
    """

    class Role(models.TextChoices):
        PLATFORM_ADMIN = "platform_admin", "Platform Admin"
        TENANT_OWNER = "tenant_owner", "Tenant Owner"
        MANAGER = "manager", "Manager"
        BRANCH_MANAGER = "branch_manager", "Branch Manager"
        FRONT_DESK = "front_desk", "Front Desk"
        INSTRUCTOR = "instructor", "Instructor"
        FINANCE = "finance", "Finance"
        STAFF = "staff", "Staff"
        PARENT = "parent", "Parent"
        STUDENT = "student", "Student"
        READ_ONLY = "read_only", "Read Only Auditor"

    class Language(models.TextChoices):
        ARABIC = "ar", "Arabic"
        ENGLISH = "en", "English"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Identity
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=30, blank=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)

    # Role & Status
    role = models.CharField(max_length=30, choices=Role.choices, default=Role.STUDENT)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    # Profile
    avatar = models.ImageField(upload_to="avatars/%Y/%m/", null=True, blank=True)
    language_pref = models.CharField(max_length=5, choices=Language.choices, default=Language.ARABIC)

    # Location scoping (multi-select)
    assigned_location_ids = models.JSONField(default=list, blank=True)

    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_login_ip = models.GenericIPAddressField(null=True, blank=True)

    # Permissions (Granular control for staff)
    permissions = models.JSONField(default=dict, blank=True)

    # Consent
    gdpr_consent = models.BooleanField(default=False)
    gdpr_consent_at = models.DateTimeField(null=True, blank=True)
    is_initial_password_set = models.BooleanField(default=False)
    force_password_reset = models.BooleanField(
        default=False,
        help_text="When True, user must reset password on next login.",
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    objects = UserManager()

    class Meta:
        app_label = "accounts"
        verbose_name = "User"
        verbose_name_plural = "Users"

    def __str__(self):
        return f"{self.get_full_name()} <{self.email}>"

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip()


    @property
    def is_management(self):
        return self.role in [
            self.Role.PLATFORM_ADMIN,
            self.Role.TENANT_OWNER,
            self.Role.MANAGER,
        ]

    @property
    def is_instructor(self):
        return self.role == self.Role.INSTRUCTOR


class PasswordResetToken(models.Model):
    """Secure password reset tokens."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="reset_tokens")
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    is_used = models.BooleanField(default=False)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "accounts"

    def __str__(self):
        return f"Reset token for {self.user.email}"
