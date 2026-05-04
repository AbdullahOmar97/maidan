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
        return user_perms.get(self.required_permission, False)


class CanManageStudents(HasGranularPermission):
    def __init__(self):
        super().__init__("can_manage_students")


class CanViewBilling(HasGranularPermission):
    def __init__(self):
        super().__init__("can_view_billing")


class CanManageBilling(HasGranularPermission):
    def __init__(self):
        super().__init__("can_manage_billing")


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


class CanViewReports(HasGranularPermission):
    def __init__(self):
        super().__init__("can_view_reports")


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
    Mixin for viewsets to filter queryset by user's location
    for Branch Manager role. Managers see all locations.
    """

    def get_location_filtered_queryset(self, queryset):
        user = self.request.user
        if user.role == RoleChoices.BRANCH_MANAGER and user.location:
            return queryset.filter(location=user.location)
        return queryset
