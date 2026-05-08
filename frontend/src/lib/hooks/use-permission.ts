import { useSession } from "next-auth/react";

/** Roles that bypass ALL granular permission checks. */
const PRIVILEGED_ROLES = ["platform_admin", "tenant_owner"];

/** Roles that are auto-granted dashboard/reporting access (mirrors backend CanViewReports). */
const REPORTS_PRIVILEGED_ROLES = [...PRIVILEGED_ROLES, "manager"];

/**
 * Returns whether the current user has a specific granular permission.
 * Platform admins and tenant owners always return true.
 */
export function usePermission(permission: string): boolean {
  const { data: session } = useSession();
  if (!session) return false;

  const user = session.user as any;
  if (PRIVILEGED_ROLES.includes(user?.role)) return true;

  const perms: Record<string, boolean> = user?.permissions ?? {};
  return perms[permission] === true;
}

/**
 * Returns reporting/dashboard-specific permissions.
 * Managers are auto-granted access (no explicit flag needed).
 */
export function useReportingPermissions() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const isReportsPrivileged = REPORTS_PRIVILEGED_ROLES.includes(user?.role);
  const perms: Record<string, boolean> = user?.permissions ?? {};

  return {
    canViewReports: isReportsPrivileged || perms["can_view_reports"] === true,
  };
}

/**
 * Returns a map of common permissions for the current user.
 * Avoids calling usePermission multiple times in the same component.
 */
export function useBillingPermissions() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const isPrivileged = PRIVILEGED_ROLES.includes(user?.role);
  const perms: Record<string, boolean> = user?.permissions ?? {};

  const check = (key: string) => isPrivileged || perms[key] === true;

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
  const isPrivileged = PRIVILEGED_ROLES.includes(user?.role);
  const perms: Record<string, boolean> = user?.permissions ?? {};

  return {
    canManageStudents: isPrivileged || perms["can_manage_students"] === true,
  };
}

export function useSettingsPermissions() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const isPrivileged = PRIVILEGED_ROLES.includes(user?.role);
  const perms: Record<string, boolean> = user?.permissions ?? {};

  const check = (key: string) => isPrivileged || perms[key] === true;

  return {
    canManageAcademy: check("can_manage_academy"),
    canManageBranding: check("can_manage_branding"),
    canManageStaff: check("can_manage_staff"),
  };
}
