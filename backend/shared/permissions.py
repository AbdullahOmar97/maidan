"""
MAIDAN — Shared Custom Permissions

Implements a clean, role-based and granular permission system with:
- Centralized ROLE_DEFAULT_PERMISSIONS baseline matrix
- Explicit per-user granular overrides via user.permissions JSONField
- Row-level location isolation for Branch Managers
- Composable DRF permission classes
"""

from rest_framework import permissions


class RoleChoices:
    PLATFORM_ADMIN = "platform_admin"
    TENANT_OWNER = "tenant_owner"
    MANAGER = "manager"
    BRANCH_MANAGER = "branch_manager"
    FRONT_DESK = "front_desk"
    INSTRUCTOR = "instructor"
    FINANCE = "finance"
    STAFF = "staff"
    PARENT = "parent"
    STUDENT = "student"
    READ_ONLY = "read_only"

    STAFF_ROLES = [
        PLATFORM_ADMIN,
        TENANT_OWNER,
        MANAGER,
        BRANCH_MANAGER,
        FRONT_DESK,
        INSTRUCTOR,
        FINANCE,
        STAFF,
    ]

    MANAGEMENT_ROLES = [PLATFORM_ADMIN, TENANT_OWNER, MANAGER]


ALL_PERMISSION_FLAGS = [
    "can_manage_students",
    "can_view_billing",
    "can_manage_billing",
    "can_create_invoice",
    "can_mark_invoice_paid",
    "can_apply_discount",
    "can_void_invoice",
    "can_renew_subscription",
    "can_change_subscription",
    "can_approve_subscription",
    "can_manage_schedules",
    "can_manage_locations",
    "can_view_reports",
    "can_manage_staff",
    "can_manage_academy",
    "can_manage_branding",
    "can_manage_belts",
    "can_manage_store",
    "can_manage_messaging",
]

ROLE_DEFAULT_PERMISSIONS: dict[str, dict[str, bool]] = {
    RoleChoices.PLATFORM_ADMIN: {flag: True for flag in ALL_PERMISSION_FLAGS},
    RoleChoices.TENANT_OWNER: {flag: True for flag in ALL_PERMISSION_FLAGS},
    RoleChoices.MANAGER: {
        "can_manage_students": True,
        "can_view_billing": True,
        "can_manage_billing": True,
        "can_create_invoice": True,
        "can_mark_invoice_paid": True,
        "can_apply_discount": True,
        "can_void_invoice": True,
        "can_renew_subscription": True,
        "can_change_subscription": True,
        "can_approve_subscription": True,
        "can_manage_schedules": True,
        "can_manage_locations": True,
        "can_view_reports": True,
        "can_manage_staff": True,
        "can_manage_academy": True,
        "can_manage_branding": True,
        "can_manage_belts": True,
        "can_manage_store": True,
        "can_manage_messaging": True,
    },
    RoleChoices.BRANCH_MANAGER: {
        "can_manage_students": True,
        "can_view_billing": True,
        "can_create_invoice": True,
        "can_mark_invoice_paid": True,
        "can_renew_subscription": True,
        "can_manage_schedules": True,
        "can_manage_locations": True,
        "can_view_reports": True,
        "can_manage_staff": True,
        "can_manage_belts": True,
        "can_manage_store": True,
        "can_manage_messaging": True,
    },
    RoleChoices.FINANCE: {
        "can_view_billing": True,
        "can_manage_billing": True,
        "can_create_invoice": True,
        "can_mark_invoice_paid": True,
        "can_apply_discount": True,
        "can_void_invoice": True,
        "can_renew_subscription": True,
        "can_change_subscription": True,
        "can_approve_subscription": True,
        "can_view_reports": True,
    },
    RoleChoices.FRONT_DESK: {
        "can_manage_students": True,
        "can_view_billing": True,
        "can_create_invoice": True,
        "can_mark_invoice_paid": True,
        "can_renew_subscription": True,
        "can_manage_schedules": True,
        "can_manage_store": True,
        "can_manage_messaging": True,
    },
    RoleChoices.INSTRUCTOR: {
        "can_manage_belts": True,
    },
    RoleChoices.STAFF: {},
    RoleChoices.READ_ONLY: {
        "can_view_billing": True,
        "can_view_reports": True,
    },
}


def resolve_user_permissions(user) -> dict[str, bool]:
    """
    Compute the effective permission map for a user by combining
    ROLE_DEFAULT_PERMISSIONS with explicit overrides in user.permissions.
    """
    if not user or not getattr(user, "is_authenticated", False):
        return {flag: False for flag in ALL_PERMISSION_FLAGS}

    role = getattr(user, "role", "")
    if role in [RoleChoices.PLATFORM_ADMIN, RoleChoices.TENANT_OWNER]:
        return {flag: True for flag in ALL_PERMISSION_FLAGS}

    defaults = ROLE_DEFAULT_PERMISSIONS.get(role, {})
    explicit = getattr(user, "permissions", None)
    if not isinstance(explicit, dict):
        explicit = {}

    effective: dict[str, bool] = {}
    for flag in ALL_PERMISSION_FLAGS:
        if flag in explicit and isinstance(explicit[flag], bool):
            effective[flag] = explicit[flag]
        else:
            effective[flag] = bool(defaults.get(flag, False))

    # Preserve any custom keys stored in explicit permissions
    for k, v in explicit.items():
        if k not in effective and isinstance(v, bool):
            effective[k] = v

    return effective


def has_effective_permission(user, permission_key: str) -> bool:
    """Check whether a user effectively holds `permission_key`."""
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if user.role in [RoleChoices.PLATFORM_ADMIN, RoleChoices.TENANT_OWNER]:
        return True
    explicit = getattr(user, "permissions", None)
    if isinstance(explicit, dict) and permission_key in explicit:
        return bool(explicit[permission_key])
    return bool(ROLE_DEFAULT_PERMISSIONS.get(user.role, {}).get(permission_key, False))


class IsPlatformAdmin(permissions.BasePermission):
    """Only platform-level administrators."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == RoleChoices.PLATFORM_ADMIN
        )


class IsTenantOwnerOrManager(permissions.BasePermission):
    """Tenant owner or manager level access."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role
            in [
                RoleChoices.PLATFORM_ADMIN,
                RoleChoices.TENANT_OWNER,
                RoleChoices.MANAGER,
            ]
        )


class IsStaff(permissions.BasePermission):
    """Any staff role (not parent or student)."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in RoleChoices.STAFF_ROLES
        )


class CanCheckIn(permissions.BasePermission):
    """Staff roles that can check in students."""

    ALLOWED_ROLES = [
        RoleChoices.PLATFORM_ADMIN,
        RoleChoices.TENANT_OWNER,
        RoleChoices.MANAGER,
        RoleChoices.BRANCH_MANAGER,
        RoleChoices.FRONT_DESK,
        RoleChoices.INSTRUCTOR,
    ]

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in self.ALLOWED_ROLES
        )


class HasGranularPermission(permissions.BasePermission):
    """
    Check for specific permissions using resolve_user_permissions (explicit override -> role default).
    Tenant owners and platform admins always have full access.
    """

    def __init__(self, required_permission: str):
        self.required_permission = required_permission

    def has_permission(self, request, view):
        return has_effective_permission(request.user, self.required_permission)


class CanManageStudents(HasGranularPermission):
    def __init__(self):
        super().__init__("can_manage_students")


class CanViewBilling(HasGranularPermission):
    def __init__(self):
        super().__init__("can_view_billing")


class CanManageBilling(HasGranularPermission):
    def __init__(self):
        super().__init__("can_manage_billing")


class CanCreateInvoice(HasGranularPermission):
    """Who can manually create an invoice (e.g. for extra fees)."""

    def __init__(self):
        super().__init__("can_create_invoice")


class CanRenewSubscription(HasGranularPermission):
    """Who can create a new membership / renew an existing one."""

    def __init__(self):
        super().__init__("can_renew_subscription")


class CanChangeSubscription(HasGranularPermission):
    """Who can switch a student from one plan to another."""

    def __init__(self):
        super().__init__("can_change_subscription")


class CanApproveSubscription(HasGranularPermission):
    """Who can approve pending-approval membership requests."""

    def __init__(self):
        super().__init__("can_approve_subscription")


class CanVoidInvoice(HasGranularPermission):
    """Who can void (cancel) an existing invoice."""

    def __init__(self):
        super().__init__("can_void_invoice")


class CanApplyDiscount(HasGranularPermission):
    """Who can apply a discount to an invoice."""

    def __init__(self):
        super().__init__("can_apply_discount")


class CanMarkInvoicePaid(HasGranularPermission):
    """Who can manually mark an invoice as fully paid (cash / offline confirmation)."""

    def __init__(self):
        super().__init__("can_mark_invoice_paid")


class CanManageSchedules(HasGranularPermission):
    def __init__(self):
        super().__init__("can_manage_schedules")


class CanManageStaff(HasGranularPermission):
    def __init__(self):
        super().__init__("can_manage_staff")


class CanManageLocations(HasGranularPermission):
    def __init__(self):
        super().__init__("can_manage_locations")


class CanManageAcademy(HasGranularPermission):
    def __init__(self):
        super().__init__("can_manage_academy")


class CanManageBranding(HasGranularPermission):
    def __init__(self):
        super().__init__("can_manage_branding")


class CanManageBelts(HasGranularPermission):
    def __init__(self):
        super().__init__("can_manage_belts")


class CanManageStore(HasGranularPermission):
    def __init__(self):
        super().__init__("can_manage_store")


class CanManageMessaging(HasGranularPermission):
    def __init__(self):
        super().__init__("can_manage_messaging")


class CanUpdateTenantSettings(permissions.BasePermission):
    """
    Combined permission for PATCH /academy/me/.
    Allows if user has can_manage_academy OR can_manage_branding.
    """

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False

        return (
            has_effective_permission(request.user, "can_manage_academy")
            or has_effective_permission(request.user, "can_manage_branding")
        )


class CanViewReports(HasGranularPermission):
    """Controls access to dashboard KPIs and analytics."""

    AUTO_GRANTED_ROLES = [
        RoleChoices.PLATFORM_ADMIN,
        RoleChoices.TENANT_OWNER,
        RoleChoices.MANAGER,
    ]

    def __init__(self):
        super().__init__("can_view_reports")


class IsOwnerOrStaff(permissions.BasePermission):
    """Allow staff to access all records, or users to access their own."""

    def has_object_permission(self, request, view, obj):
        if not (request.user and request.user.is_authenticated):
            return False

        if request.user.role in RoleChoices.STAFF_ROLES:
            return True

        if hasattr(obj, "user"):
            return obj.user == request.user

        if hasattr(obj, "student") and hasattr(obj.student, "user"):
            return obj.student.user == request.user

        return False


class LocationFilterMixin:
    """
    Mixin for viewsets to scope querysets by the requesting user's assigned branch.
    """

    location_field: str = "location_id"

    def _get_user_location_ids(self):
        """Return the list of location pks that this user is restricted to, or None."""
        user = self.request.user
        if not user or not user.is_authenticated:
            return None
        if user.role in [
            RoleChoices.PLATFORM_ADMIN,
            RoleChoices.TENANT_OWNER,
            RoleChoices.MANAGER,
        ]:
            return None
        return getattr(user, "assigned_location_ids", [])

    def get_location_filtered_queryset(self, queryset):
        location_ids = self._get_user_location_ids()
        if location_ids:
            return queryset.filter(**{f"{self.location_field}__in": location_ids})
        return queryset


class BranchScopedMixin(LocationFilterMixin):
    """
    Variant of LocationFilterMixin for models that reach location through a
    related Student (e.g. Invoice, Membership, AttendanceRecord).
    """

    location_field: str = "student__location_id"
