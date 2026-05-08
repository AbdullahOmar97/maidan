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
  Building2,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Session } from "next-auth";
import { useTenant } from "@/lib/providers/tenant-provider";
import { ROLE_LABELS } from "@/lib/constants";
import { UserRole } from "@/types";


const navItems = [
  {
    label: "لوحة التحكم",
    labelEn: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    label: "الطلاب",
    labelEn: "Students",
    href: "/dashboard/students",
    icon: Users,
    permission: "can_manage_students",
  },
  {
    label: "الحضور",
    labelEn: "Attendance",
    href: "/dashboard/attendance",
    icon: CalendarCheck,
  },
  {
    label: "الأحزمة",
    labelEn: "Belts",
    href: "/dashboard/belts",
    icon: Award,
    permission: "can_manage_belts",
  },
  {
    label: "الفواتير",
    labelEn: "Billing",
    href: "/dashboard/billing",
    icon: CreditCard,
    permission: "can_view_billing",
  },
  {
    label: "الجدول",
    labelEn: "Schedule",
    href: "/dashboard/scheduling",
    icon: Calendar,
    permission: "can_manage_schedules",
  },
  {
    label: "الرسائل",
    labelEn: "Messaging",
    href: "/dashboard/messaging",
    icon: MessageCircle,
  },
  {
    label: "التقارير",
    labelEn: "Reports",
    href: "/dashboard/reporting",
    icon: BarChart3,
    permission: "can_view_reports",
  },
  {
    label: "الموظفون",
    labelEn: "Staff",
    href: "/dashboard/staff",
    icon: UserCheck,
    permission: "can_manage_staff",
  },
  {
    label: "الفروع",
    labelEn: "Locations",
    href: "/dashboard/locations",
    icon: Building2,
    permission: "can_manage_locations",
  },
  {
    label: "الأكاديميات",
    labelEn: "Academies",
    href: "/dashboard/tenants",
    icon: Shield,
    role: "platform_admin",
  },
  {
    label: "الإعدادات",
    labelEn: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
];

interface SidebarProps {
  user?: Session["user"];
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const role = (user as any)?.role as UserRole;
  const { tenant } = useTenant();

  return (
    <aside className="w-64 h-full flex flex-col bg-card/30 border-l border-white/[0.05] backdrop-blur-2xl shrink-0 overflow-hidden relative">
      {/* Decorative Glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-[60px] -mr-16 -mt-16 pointer-events-none" />

      {/* Logo */}
      <div className="flex items-center gap-4 px-6 h-20 shrink-0 relative z-10">
        {tenant?.logo ? (
          <img src={tenant.logo} alt="Club Logo" className="w-10 h-10 rounded-xl object-cover shadow-lg group hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-10 h-10 rounded-2xl gradient-brand flex items-center justify-center shadow-lg shadow-primary/20 group hover:scale-105 transition-transform duration-500">
            <Shield className="w-5 h-5 text-white" />
          </div>
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

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-1 relative z-10">
        {navItems
          .filter(item => {
            const itemRole = (item as any).role;
            const itemRoles = (item as any).roles;
            const itemPermission = (item as any).permission;

            // Platform Admin and Tenant Owner see everything
            if (role === "platform_admin" || role === "tenant_owner") {
              return true;
            }

            if (itemRole) {
              return itemRole === role;
            }

            if (itemRoles && Array.isArray(itemRoles)) {
              return itemRoles.includes(role);
            }

            if (itemPermission) {
              const userPermissions = (user as any)?.permissions || {};
              return userPermissions[itemPermission] === true;
            }

            return true;
          })
          .map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "sidebar-item group",
                  isActive && "sidebar-item-active"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300",
                  isActive ? "bg-primary/20 text-primary" : "bg-white/[0.03] text-muted-foreground group-hover:bg-white/[0.08] group-hover:text-foreground"
                )}>
                  <item.icon className="w-4 h-4 shrink-0" />
                </div>
                <span className="flex-1 font-bold tracking-tight">{item.label}</span>
                {isActive && (
                  <div className="w-1.5 h-1.5 rounded-full bg-primary glow-primary" />
                )}
              </Link>
            );
          })}
      </nav>

      {/* Bottom Section */}
      <div className="mt-auto relative z-10 space-y-2 p-4">
        {/* Kiosk Mode Button */}
        <Link
          href="/kiosk"
          target="_blank"
          className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-all duration-300 text-xs font-bold group"
        >
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
            <CalendarCheck className="w-4 h-4" />
          </div>
          <span className="flex-1">وضع الكشك</span>
          <ChevronLeft className="w-4 h-4 rtl-flip opacity-30 group-hover:translate-x-1 transition-transform" />
        </Link>

        {/* User Profile Section */}
        {user && (
          <div className="pt-2">
            <div className="p-3 rounded-2xl bg-primary/5 border border-primary/10 flex items-center gap-3 group hover:bg-primary/10 transition-all">
              <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center text-white text-sm font-black shadow-lg shadow-primary/20 transition-transform group-hover:scale-105">
                {(user as any)?.first_name?.[0]?.toUpperCase() ?? user?.name?.[0]?.toUpperCase() ?? "U"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-white truncate leading-none mb-1.5">
                  {((user as any)?.first_name && (user as any)?.last_name)
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
    </aside>
  );
}
