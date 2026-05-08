import { useSession } from "next-auth/react";

const PRIVILEGED_ROLES = ["platform_admin", "tenant_owner"];

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
