"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import {
  Bell, LogOut, Moon, Sun, Search, Shield, Menu, X, Check, Inbox
} from "lucide-react";
import { useTheme } from "next-themes";
import type { Session } from "next-auth";
import { UserRole, PaginatedResponse, NotificationLog } from "@/types";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/constants";
import { api } from "@/lib/api/client";
import { toast } from "sonner";

interface TopBarProps {
  user: Session["user"];
  /** Called when the hamburger is pressed to open the mobile drawer */
  onMenuToggle: () => void;
}

export function TopBar({ user, onMenuToggle }: TopBarProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const queryClient = useQueryClient();
  const role = (user as any)?.role as UserRole;

  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Fetch in-app notifications
  const { data: notificationsData } = useQuery<PaginatedResponse<NotificationLog>>({
    queryKey: ["notifications", "in_app"],
    queryFn: () =>
      api.messaging
        .logs({ channel: "in_app", ordering: "-created_at" })
        .then((r: any) => r.data),
    refetchInterval: 15000, // Poll every 15 seconds
  });
  const notifications = notificationsData?.results || [];
  const unreadCount = notifications.filter((n) => n.status === "sent").length;

  // Mutations
  const markReadMutation = useMutation({
    mutationFn: (id: number) => api.messaging.read(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "in_app"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.messaging.readAll(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "in_app"] });
      toast.success("تم تحديد جميع الإشعارات كمقروءة.");
    },
  });

  // Close dropdown on click outside
  useEffect(() => {
    if (!notificationsOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (!(e.target as Element).closest("#notifications-container")) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [notificationsOpen]);

  // Relative time helper
  const formatRelativeTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const diffMs = new Date().getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "الآن";
    if (diffMins < 60) return `منذ ${diffMins} د`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `منذ ${diffHrs} س`;
    return d.toLocaleDateString("ar-EG", { month: "short", day: "numeric" });
  };

  // Avoid “missing navbar” after client-side navigation: mobile search overlay was left open.
  useEffect(() => {
    setSearchOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    if (typeof window !== "undefined") {
      const themePref = localStorage.getItem("theme");
      localStorage.clear();
      sessionStorage.clear();
      if (themePref) localStorage.setItem("theme", themePref);
    }
    queryClient.clear();
    await signOut({ callbackUrl: "/login" });
  };

  useEffect(() => { setMounted(true); }, []);

  // Close search on Escape
  useEffect(() => {
    if (!searchOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [searchOpen]);

  return (
    <header
      className="h-[var(--topbar-height,4.5rem)] border-b border-white/[0.05] flex items-center justify-between px-3 sm:px-6 lg:px-8 bg-card/10 backdrop-blur-3xl shrink-0 relative z-20 gap-2 sm:gap-3"
      role="banner"
    >
      {/* ── Left: Hamburger (mobile only) ── */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <button
          id="mobile-menu-btn"
          onClick={onMenuToggle}
          className="lg:hidden touch-target w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/5 transition-all active:scale-90 shrink-0"
          aria-label="فتح القائمة"
          aria-expanded={false}
        >
          <Menu className="w-5 h-5" aria-hidden="true" />
        </button>

        {/* ── Search: full bar on sm+, icon on xs ── */}
        {searchOpen ? (
          /* Expanded search on mobile — inset-e leaves room for profile/actions so bar doesn’t feel “gone” */
          <div className="absolute start-0 end-[7rem] top-0 z-30 flex h-[5rem] items-center gap-3 bg-card/95 px-4 backdrop-blur-3xl max-sm:end-[5.5rem] sm:static sm:z-auto sm:flex-1 sm:bg-transparent sm:backdrop-blur-none sm:px-0">
            <div className="relative flex-1 group">
              <Search
                className="absolute end-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-all"
                aria-hidden="true"
              />
              <input
                id="global-search"
                type="search"
                autoFocus
                placeholder="ابحث عن طلاب، فواتير، أو حصص..."
                className="w-full ps-6 pe-11 py-2.5 text-sm rounded-2xl bg-white/[0.05] border border-white/[0.08] focus:bg-white/[0.08] focus:border-primary/40 focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all placeholder:text-muted-foreground/30 font-medium"
                aria-label="البحث العام"
              />
            </div>
            <button
              onClick={() => setSearchOpen(false)}
              className="sm:hidden touch-target w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/5 transition-all"
              aria-label="إغلاق البحث"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <>
            {/* Icon-only search button on mobile */}
            <button
              onClick={() => setSearchOpen(true)}
              className="sm:hidden touch-target w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/5 transition-all active:scale-90"
              aria-label="فتح البحث"
            >
              <Search className="w-5 h-5" aria-hidden="true" />
            </button>

            {/* Full search bar on sm+ */}
            <div className="hidden sm:flex items-center flex-1 max-w-md">
              <div className="relative flex-1 group">
                <Search
                  className="absolute end-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-all group-focus-within:scale-110"
                  aria-hidden="true"
                />
                <input
                  id="global-search-desktop"
                  type="search"
                  placeholder="ابحث..."
                  className="w-full ps-5 pe-11 py-2 text-sm rounded-xl bg-white/[0.03] border border-white/[0.05] focus:bg-white/[0.05] focus:border-primary/40 focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all placeholder:text-muted-foreground/30 font-medium"
                  aria-label="البحث العام"
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Right Controls ── */}
      <div
        className={cn(
          "relative z-40 flex items-center gap-2 sm:gap-4 shrink-0",
          searchOpen && "max-sm:bg-card/95 max-sm:backdrop-blur-3xl max-sm:rounded-xl max-sm:px-1",
        )}
      >
        {/* Actions group */}
        <div className="flex items-center gap-1 sm:gap-2 px-1 sm:px-2 py-1.5 rounded-2xl bg-white/[0.02] border border-white/5">
          {/* Theme Toggle */}
          <button
            id="theme-toggle"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="touch-target w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/5 transition-all active:scale-90"
            aria-label={mounted ? (theme === "dark" ? "التبديل إلى الوضع الفاتح" : "التبديل إلى الوضع الداكن") : "تبديل وضع العرض"}
          >
            {mounted && theme === "dark"
              ? <Sun className="w-4 h-4" aria-hidden="true" />
              : <Moon className="w-4 h-4" aria-hidden="true" />}
          </button>

          {/* Notifications */}
          <div id="notifications-container" className="relative">
            <button
              id="notifications-btn"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className={cn(
                "touch-target w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/5 transition-all relative active:scale-90",
                notificationsOpen && "bg-white/10 text-white"
              )}
              aria-label="الإشعارات"
            >
              <Bell className="w-4 h-4" aria-hidden="true" />
              {unreadCount > 0 && (
                <span
                  className="absolute top-2.5 end-2.5 w-2 h-2 rounded-full bg-primary glow-primary border-2 border-[#0f172a]"
                  aria-label="لديك إشعارات جديدة"
                />
              )}
            </button>

            {/* Dropdown Menu */}
            {notificationsOpen && (
              <div className="absolute end-0 mt-2 w-80 glass-card border border-white/10 rounded-2xl shadow-2xl p-4 overflow-hidden z-50 text-right animate-in fade-in slide-in-from-top-2 duration-200" dir="rtl">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-white/5">
                  <h4 className="text-xs font-black text-white">الإشعارات الواردة</h4>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllReadMutation.mutate()}
                      className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" />
                      تحديد الكل كمقروء
                    </button>
                  )}
                </div>

                {/* Notification List */}
                <div className="max-h-72 overflow-y-auto py-2 space-y-2 divide-y divide-white/[0.03]">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-center">
                      <Inbox className="w-8 h-8 mb-2 opacity-25" />
                      <p className="text-xs">لا توجد إشعارات حالياً.</p>
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => notif.status === "sent" && markReadMutation.mutate(notif.id)}
                        className={cn(
                          "pt-2 flex gap-3 text-xs leading-normal transition-all cursor-pointer",
                          notif.status === "sent" ? "text-white font-bold" : "text-muted-foreground hover:text-white"
                        )}
                      >
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-black text-xs text-white truncate max-w-[150px]">
                              {notif.subject || "تنبيه النظام"}
                            </span>
                            <span className="text-[10px] text-muted-foreground shrink-0 font-medium">
                              {formatRelativeTime(notif.created_at)}
                            </span>
                          </div>
                          <p className="text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
                            {notif.content}
                          </p>
                        </div>
                        {notif.status === "sent" && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 self-center" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Separator */}
        <div className="hidden sm:block h-8 w-px bg-white/5" aria-hidden="true" />

        {/* Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* User card — condensed on mobile (avatar only) */}
          <Link
            href="/dashboard/settings?tab=profile"
            className="flex items-center gap-3 px-2 sm:px-3 py-1.5 rounded-2xl bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-all group cursor-pointer"
          >
            {/* Name + role (hidden on xs) */}
            <div className="hidden sm:flex text-start flex-col items-start">
              <p className="text-sm font-black text-white tracking-tight leading-none mb-1 group-hover:text-primary transition-colors whitespace-nowrap">
                {(user as any)?.first_name && (user as any)?.last_name
                  ? `${(user as any).first_name} ${(user as any).last_name}`
                  : (user?.name ?? "المستخدم")}
              </p>
              <div className="flex items-center gap-1.5">
                <Shield className="w-2.5 h-2.5 text-primary opacity-50" aria-hidden="true" />
                <p className="text-[10px] font-black text-primary uppercase tracking-widest leading-none">
                  {ROLE_LABELS[role] ?? role}
                </p>
              </div>
            </div>

            {/* Avatar */}
            <div
              className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center text-white text-sm font-black shadow-lg shadow-primary/20 group-hover:scale-105 group-hover:rotate-3 transition-all duration-300"
              aria-hidden="true"
            >
              {(user as any)?.first_name?.[0]?.toUpperCase() ?? user?.name?.[0]?.toUpperCase() ?? "U"}
            </div>
          </Link>

          {/* Logout */}
          <button
            id="logout-btn"
            onClick={handleLogout}
            className="touch-target w-11 h-11 rounded-2xl bg-red-500/5 border border-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500 hover:text-white hover:border-red-500 shadow-lg hover:shadow-red-500/20 transition-all active:scale-90 group/logout"
            aria-label="تسجيل الخروج"
          >
            <LogOut className="w-5 h-5 rtl:-scale-x-100 group-hover/logout:translate-x-0.5 rtl:group-hover/logout:-translate-x-0.5 transition-transform" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
