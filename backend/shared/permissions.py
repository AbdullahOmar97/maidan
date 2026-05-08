"""
MAIDAN — Shared Custom Permissions

Implements a clean, role-based permission system with:
- Row-level location isolation for Branch Managers
- Tenant isolation enforced at the ORM level
- Composable permission classes
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
    ]

    MANAGEMENT_ROLES = [PLATFORM_ADMIN, TENANT_OWNER, MANAGER]


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
            and request.user.role in [
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
    Check for specific permissions in user.permissions JSON field.
    Tenant owners and platform admins always have full access.
    """

    def __init__(self, required_permission: str):
        self.required_permission = required_permission

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False

        # Owners and admins always have access
        if request.user.role in [RoleChoices.PLATFORM_ADMIN, RoleChoices.TENANT_OWNER]:
            return True

        # Check for specific granular permission
        user_perms = getattr(request.user, "permissions", {}) or {}
        if user_perms is None:
            user_perms = {}
        
        result = user_perms.get(self.required_permission, False)
        
        # Debug logging (visible in docker logs)
        print(f"[AUTH DEBUG] User: {request.user.email} | Required: {self.required_permission} | UserPerms: {user_perms} | Result: {result}")
        
        return result


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

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False

        # Keep management roles working by default for locations CRUD.
        if request.user.role in [
            RoleChoices.PLATFORM_ADMIN,
            RoleChoices.TENANT_OWNER,
            RoleChoices.MANAGER,
            RoleChoices.BRANCH_MANAGER,
        ]:
            return True

        return super().has_permission(request, view)


class CanManageAcademy(HasGranularPermission):
    def __init__(self):
        super().__init__("can_manage_academy")


class CanManageBranding(HasGranularPermission):
    def __init__(self):
        super().__init__("can_manage_branding")


class CanUpdateTenantSettings(permissions.BasePermission):
    """
    Combined permission for PATCH /academy/me/.
    Allows if user is Owner/Manager/Admin OR has can_manage_academy OR can_manage_branding.
    """

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False

        if request.user.role in [
            RoleChoices.PLATFORM_ADMIN,
            RoleChoices.TENANT_OWNER,
            RoleChoices.MANAGER,
        ]:
            return True

        user_perms = getattr(request.user, "permissions", {}) or {}
        return user_perms.get("can_manage_academy", False) or user_perms.get(
            "can_manage_branding", False
        )


class CanViewReports(HasGranularPermission):
    """
    Controls access to dashboard KPIs and analytics.

    Auto-granted to:
      - platform_admin, tenant_owner  (via HasGranularPermission base)
      - manager

    Configurable (toggleable) for all other staff roles via the
    'can_view_reports' flag in user.permissions.
    """

    # Roles that always pass without needing the explicit flag.
    AUTO_GRANTED_ROLES = [
        RoleChoices.PLATFORM_ADMIN,
        RoleChoices.TENANT_OWNER,
        RoleChoices.MANAGER,
    ]

    def __init__(self):
        super().__init__("can_view_reports")

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False

        if request.user.role in self.AUTO_GRANTED_ROLES:
            return True

        # All other staff: honour the granular flag.
        return super().has_permission(request, view)


class IsOwnerOrStaff(permissions.BasePermission):
    """Allow staff to access all records, or users to access their own."""

    def has_object_permission(self, request, view, obj):
        if not (request.user and request.user.is_authenticated):
            return False

        # Staff can access all
        if request.user.role in RoleChoices.STAFF_ROLES:
            return True

        # Students can access their own data
        if hasattr(obj, "user"):
            return obj.user == request.user

        if hasattr(obj, "student") and hasattr(obj.student, "user"):
            return obj.student.user == request.user

        return False


class LocationFilterMixin:
    """
    Mixin for viewsets to scope querysets by the requesting user's assigned branch.

    Rules:
    - tenant_owner / platform_admin / manager → see ALL locations (no restriction).
    - Any staff member with primary_location_id set → restricted to that branch only.
    - Staff with no primary_location_id → unrestricted (e.g. a shared role not tied to one branch).

    The queryset field to filter on must be specified in `location_field` (default: "location_id").
    """

    location_field: str = "location_id"

    def _get_user_location_id(self):
        """Return the location pk that this user is restricted to, or None."""
        user = self.request.user
        if not user or not user.is_authenticated:
            return None
        # Admins / owners / general managers see everything
        if user.role in [
            RoleChoices.PLATFORM_ADMIN,
            RoleChoices.TENANT_OWNER,
            RoleChoices.MANAGER,
        ]:
            return None
        return getattr(user, "primary_location_id", None)

    def get_location_filtered_queryset(self, queryset):
        location_id = self._get_user_location_id()
        if location_id:
            return queryset.filter(**{self.location_field: location_id})
        return queryset


class BranchScopedMixin(LocationFilterMixin):
    """
    Variant of LocationFilterMixin for models that reach location through a
    related Student (e.g. Invoice, Membership, AttendanceRecord).
    Override `location_field` to point to the correct traversal path.
    """

    location_field: str = "student__location_id"
