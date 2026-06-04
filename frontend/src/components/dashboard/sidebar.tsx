"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  Award,
  CreditCard,
  Calendar,
  MessageCircle,
  BarChart3,
  Settings,
  Shield,
  ChevronLeft,
  ChevronRight,
  Building2,
  UserCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Session } from "next-auth";
import { useTenant } from "@/lib/providers/tenant-provider";
import { ROLE_LABELS } from "@/lib/constants";
import { UserRole } from "@/types";

// ---------------------------------------------------------------------------
// Navigation config
// ---------------------------------------------------------------------------
const navItems = [
  { label: "لوحة التحكم", labelEn: "Dashboard",  href: "/dashboard",            icon: LayoutDashboard, exact: true },
  { label: "الطلاب",       labelEn: "Students",   href: "/dashboard/students",   icon: Users,           permission: "can_manage_students" },
  { label: "الحضور",       labelEn: "Attendance", href: "/dashboard/attendance", icon: CalendarCheck },
  { label: "الأحزمة",      labelEn: "Belts",      href: "/dashboard/belts",      icon: Award,           permission: "can_manage_belts" },
  { label: "الفواتير",     labelEn: "Billing",    href: "/dashboard/billing",    icon: CreditCard,      permission: "can_view_billing" },
  { label: "الجدول",       labelEn: "Schedule",   href: "/dashboard/scheduling", icon: Calendar,        permission: "can_manage_schedules" },
  { label: "الرسائل",      labelEn: "Messaging",  href: "/dashboard/messaging",  icon: MessageCircle },
  { label: "التقارير",     labelEn: "Reports",    href: "/dashboard/reporting",  icon: BarChart3,       permission: "can_view_reports" },
  { label: "الموظفون",     labelEn: "Staff",      href: "/dashboard/staff",      icon: UserCheck,       permission: "can_manage_staff" },
  { label: "الفروع",       labelEn: "Locations",  href: "/dashboard/locations",  icon: Building2,       permission: "can_manage_locations" },
  { label: "الإعدادات",    labelEn: "Settings",   href: "/dashboard/settings",   icon: Settings },
] as const;

/** Roles that bypass ALL permission checks (see backend RoleChoices). */
const GLOBALLY_PRIVILEGED_ROLES: UserRole[] = ["platform_admin", "tenant_owner"];

/**
 * Roles that are auto-granted can_view_reports access.
 * Must stay in sync with CanViewReports.AUTO_GRANTED_ROLES in shared/permissions.py.
 */
const REPORTS_PRIVILEGED_ROLES: UserRole[] = [...GLOBALLY_PRIVILEGED_ROLES, "manager"];

function isNavItemVisible(
  item: (typeof navItems)[number],
  role: UserRole,
  permissions: Record<string, boolean>
): boolean {
  if (GLOBALLY_PRIVILEGED_ROLES.includes(role)) return true;

  const itemAny = item as any;

  if (itemAny.role)  return itemAny.role  === role;
  if (itemAny.roles) return itemAny.roles.includes(role);

  if (itemAny.permission) {
    // Certain permissions have role-level auto-grants that mirror the backend.
    if (itemAny.permission === "can_view_reports") {
      return REPORTS_PRIVILEGED_ROLES.includes(role) || permissions["can_view_reports"] === true;
    }
    return permissions[itemAny.permission] === true;
  }

  return true;
}


// ---------------------------------------------------------------------------
// Shared nav list
// ---------------------------------------------------------------------------
interface NavListProps {
  user?: Session["user"];
  onLinkClick?: () => void;
}

function NavList({ user, onLinkClick }: NavListProps) {
  const pathname  = usePathname();
  const role      = (user as any)?.role as UserRole;
  const perms     = (user as any)?.permissions ?? {};

  return (
    <nav
      role="navigation"
      aria-label="القائمة الرئيسية"
      className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-1 relative z-10"
    >
      {navItems
        .filter((item) => isNavItemVisible(item, role, perms))
        .map((item) => {
          const isActive = (item as any).exact
            ? pathname === item.href
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onLinkClick}
              className={cn("sidebar-item group", isActive && "sidebar-item-active")}
              aria-current={isActive ? "page" : undefined}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300",
                  isActive
                    ? "bg-primary/20 text-primary"
                    : "bg-white/[0.03] text-muted-foreground group-hover:bg-white/[0.08] group-hover:text-foreground"
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              </div>
              <span className="flex-1 font-bold tracking-tight">{item.label}</span>
              {isActive && (
                <div className="w-1.5 h-1.5 rounded-full bg-primary glow-primary" />
              )}
            </Link>
          );
        })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Bottom section (kiosk + user profile)
// ---------------------------------------------------------------------------
interface BottomSectionProps {
  user?: Session["user"];
  onLinkClick?: () => void;
}

function BottomSection({ user, onLinkClick }: BottomSectionProps) {
  const role = (user as any)?.role as UserRole;
  const { tenant } = useTenant();

  return (
    <div className="mt-auto relative z-10 space-y-2 p-4 pb-safe">
      <Link
        href="/kiosk"
        target="_blank"
        onClick={onLinkClick}
        className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-all duration-300 text-xs font-bold group"
        aria-label="فتح وضع الكشك في نافذة جديدة"
      >
        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform" aria-hidden="true">
          <CalendarCheck className="w-4 h-4" />
        </div>
        <span className="flex-1">وضع الكشك</span>
        <ChevronRight className="w-4 h-4 rtl-flip opacity-30 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform" aria-hidden="true" />
      </Link>

      {user && (
        <div className="pt-2">
          <div className="p-3 rounded-2xl bg-primary/5 border border-primary/10 flex items-center gap-3 group hover:bg-primary/10 transition-all">
            <div
              className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center text-white text-sm font-black shadow-lg shadow-primary/20 transition-transform group-hover:scale-105"
              aria-hidden="true"
            >
              {(user as any)?.first_name?.[0]?.toUpperCase() ?? user?.name?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-white truncate leading-none mb-1.5">
                {(user as any)?.first_name && (user as any)?.last_name
                  ? `${(user as any).first_name} ${(user as any).last_name}`
                  : (user?.name ?? "المستخدم")}
              </p>
              <p className="text-[10px] font-black text-primary uppercase tracking-widest leading-none">
                {ROLE_LABELS[role] ?? role}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Logo header
// ---------------------------------------------------------------------------
function LogoHeader() {
  const { tenant } = useTenant();

  return (
    <div className="flex items-center gap-4 px-6 h-[5rem] shrink-0 relative z-10">
      {tenant?.logo ? (
        <img
          src={tenant.logo}
          alt={`${tenant?.name ?? "Club"} Logo`}
          className="w-10 h-10 rounded-xl object-cover shadow-lg hover:scale-105 transition-transform duration-500"
        />
      ) : (
        <img
          src="/logo.png"
          alt="MAIDAN Logo"
          className="w-10 h-10 rounded-xl object-cover shadow-lg hover:scale-105 transition-transform duration-500"
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-black text-lg tracking-tighter text-gradient leading-none truncate">
          {tenant?.name || "MAIDAN"}
        </p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70 mt-1 truncate">
          {tenant?.name ? "نظام الأكاديمية" : "نظام الدوجو"}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
interface SidebarProps {
  user?: Session["user"];
}

/**
 * Desktop-only sidebar (hidden on mobile — use MobileSidebar for mobile nav).
 */
export function Sidebar({ user }: SidebarProps) {
  return (
    <aside
      className="hidden lg:flex w-64 h-full flex-col bg-card/30 border-e border-white/[0.05] backdrop-blur-2xl shrink-0 overflow-hidden relative"
      aria-label="شريط التنقل"
    >
      {/* Decorative Glow */}
      <div className="absolute top-0 end-0 w-32 h-32 bg-primary/5 blur-[60px] -me-16 -mt-16 pointer-events-none" aria-hidden="true" />

      <LogoHeader />
      <NavList user={user} />
      <BottomSection user={user} />
    </aside>
  );
}

/**
 * Mobile sidebar rendered inside the Drawer primitive.
 * Pass `onClose` so nav links dismiss the drawer automatically.
 */
export function MobileSidebarContent({
  user,
  onClose,
}: {
  user?: Session["user"];
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col h-full bg-card/95 backdrop-blur-2xl relative overflow-hidden">
      {/* Decorative Glow */}
      <div className="absolute top-0 end-0 w-32 h-32 bg-primary/5 blur-[60px] -me-16 -mt-16 pointer-events-none" aria-hidden="true" />
      <LogoHeader />
      <NavList user={user} onLinkClick={onClose} />
      <BottomSection user={user} onLinkClick={onClose} />
    </div>
  );
}
