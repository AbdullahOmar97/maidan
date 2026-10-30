import { useSession } from "next-auth/react";
import type { StaffPermissions, UserRole } from "@/types";

/** Roles that bypass ALL granular permission checks. */
export const PRIVILEGED_ROLES: UserRole[] = ["platform_admin", "tenant_owner"];

/**
 * Default permissions per role — mirrors backend `ROLE_DEFAULT_PERMISSIONS`
 * in `backend/shared/permissions.py`.
 */
export const ROLE_DEFAULT_PERMISSIONS: Record<string, Record<string, boolean>> = {
  platform_admin: {
    can_manage_students: true,
    can_view_billing: true,
    can_manage_billing: true,
    can_create_invoice: true,
    can_mark_invoice_paid: true,
    can_apply_discount: true,
    can_void_invoice: true,
    can_renew_subscription: true,
    can_change_subscription: true,
    can_approve_subscription: true,
    can_manage_schedules: true,
    can_manage_locations: true,
    can_view_reports: true,
    can_manage_staff: true,
    can_manage_academy: true,
    can_manage_branding: true,
    can_manage_belts: true,
    can_manage_store: true,
    can_manage_messaging: true,
  },
  tenant_owner: {
    can_manage_students: true,
    can_view_billing: true,
    can_manage_billing: true,
    can_create_invoice: true,
    can_mark_invoice_paid: true,
    can_apply_discount: true,
    can_void_invoice: true,
    can_renew_subscription: true,
    can_change_subscription: true,
    can_approve_subscription: true,
    can_manage_schedules: true,
    can_manage_locations: true,
    can_view_reports: true,
    can_manage_staff: true,
    can_manage_academy: true,
    can_manage_branding: true,
    can_manage_belts: true,
    can_manage_store: true,
    can_manage_messaging: true,
  },
  manager: {
    can_manage_students: true,
    can_view_billing: true,
    can_manage_billing: true,
    can_create_invoice: true,
    can_mark_invoice_paid: true,
    can_apply_discount: true,
    can_void_invoice: true,
    can_renew_subscription: true,
    can_change_subscription: true,
    can_approve_subscription: true,
    can_manage_schedules: true,
    can_manage_locations: true,
    can_view_reports: true,
    can_manage_staff: true,
    can_manage_academy: true,
    can_manage_branding: true,
    can_manage_belts: true,
    can_manage_store: true,
    can_manage_messaging: true,
  },
  branch_manager: {
    can_manage_students: true,
    can_view_billing: true,
    can_create_invoice: true,
    can_mark_invoice_paid: true,
    can_renew_subscription: true,
    can_manage_schedules: true,
    can_manage_locations: true,
    can_view_reports: true,
    can_manage_staff: true,
    can_manage_belts: true,
    can_manage_store: true,
    can_manage_messaging: true,
  },
  finance: {
    can_view_billing: true,
    can_manage_billing: true,
    can_create_invoice: true,
    can_mark_invoice_paid: true,
    can_apply_discount: true,
    can_void_invoice: true,
    can_renew_subscription: true,
    can_change_subscription: true,
    can_approve_subscription: true,
    can_view_reports: true,
  },
  front_desk: {
    can_manage_students: true,
    can_view_billing: true,
    can_create_invoice: true,
    can_mark_invoice_paid: true,
    can_renew_subscription: true,
    can_manage_schedules: true,
    can_manage_store: true,
    can_manage_messaging: true,
  },
  instructor: {
    can_manage_belts: true,
  },
  staff: {},
  read_only: {
    can_view_billing: true,
    can_view_reports: true,
  },
};

export function hasEffectivePermission(
  role: string | undefined,
  permissions: StaffPermissions | undefined,
  permissionKey: string
): boolean {
  if (!role) return false;
  if (PRIVILEGED_ROLES.includes(role as UserRole)) return true;

  if (permissions && typeof permissions[permissionKey] === "boolean") {
    return Boolean(permissions[permissionKey]);
  }

  return Boolean(ROLE_DEFAULT_PERMISSIONS[role]?.[permissionKey]);
}

/**
 * Returns whether the current user has a specific granular permission.
 * Platform admins and tenant owners always return true.
 */
export function usePermission(permission: string): boolean {
  const { data: session } = useSession();
  if (!session) return false;

  const user = session.user as any;
  return hasEffectivePermission(user?.role, user?.permissions, permission);
}

/**
 * Returns reporting/dashboard-specific permissions.
 */
export function useReportingPermissions() {
  const { data: session } = useSession();
  const user = session?.user as any;

  return {
    canViewReports: hasEffectivePermission(
      user?.role,
      user?.permissions,
      "can_view_reports"
    ),
  };
}

/**
 * Returns a map of common billing permissions for the current user.
 */
export function useBillingPermissions() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const check = (key: string) =>
    hasEffectivePermission(user?.role, user?.permissions, key);

  return {
    canViewBilling: check("can_view_billing"),
    canManageBilling: check("can_manage_billing"),
    canCreateInvoice: check("can_create_invoice"),
    canMarkInvoicePaid: check("can_mark_invoice_paid"),
    canVoidInvoice: check("can_void_invoice"),
    canApplyDiscount: check("can_apply_discount"),
    canRenewSubscription: check("can_renew_subscription"),
    canChangeSubscription: check("can_change_subscription"),
    canApproveSubscription: check("can_approve_subscription"),
  };
}

export function useStudentPermissions() {
  const { data: session } = useSession();
  const user = session?.user as any;

  return {
    canManageStudents: hasEffectivePermission(
      user?.role,
      user?.permissions,
      "can_manage_students"
    ),
  };
}

export function useSettingsPermissions() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const check = (key: string) =>
    hasEffectivePermission(user?.role, user?.permissions, key);

  return {
    canManageAcademy: check("can_manage_academy"),
    canManageBranding: check("can_manage_branding"),
    canManageStaff: check("can_manage_staff"),
  };
}
