"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell, LogOut, Moon, Sun, Search, Shield, Menu, X,
} from "lucide-react";
import { useTheme } from "next-themes";
import type { Session } from "next-auth";
import { UserRole } from "@/types";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/constants";

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
      className="h-[5rem] border-b border-white/[0.05] flex items-center justify-between px-4 sm:px-6 lg:px-8 bg-card/10 backdrop-blur-3xl shrink-0 relative z-20 gap-3"
      role="banner"
    >
      {/* ── Left: Hamburger (mobile only) ── */}
      <div className="flex items-center gap-3">
        <button
          id="mobile-menu-btn"
          onClick={onMenuToggle}
          className="lg:hidden touch-target w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/5 transition-all active:scale-90"
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
            <div className="hidden sm:flex items-center flex-1 max-w-xl">
              <div className="relative flex-1 group">
                <Search
                  className="absolute end-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-all group-focus-within:scale-110"
                  aria-hidden="true"
                />
                <input
                  id="global-search-desktop"
                  type="search"
                  placeholder="ابحث عن طلاب، فواتير، أو حصص..."
                  className="w-full ps-6 pe-11 py-2.5 text-sm rounded-2xl bg-white/[0.03] border border-white/[0.05] focus:bg-white/[0.05] focus:border-primary/40 focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all placeholder:text-muted-foreground/30 font-medium"
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
          <button
            id="notifications-btn"
            className="touch-target w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/5 transition-all relative active:scale-90"
            aria-label="الإشعارات"
          >
            <Bell className="w-4 h-4" aria-hidden="true" />
            <span
              className="absolute top-2 end-2 w-2 h-2 rounded-full bg-primary glow-primary border-2 border-[#0f172a]"
              aria-label="لديك إشعارات جديدة"
            />
          </button>
        </div>

        {/* Separator */}
        <div className="hidden sm:block h-8 w-px bg-white/5" aria-hidden="true" />

        {/* Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* User card — condensed on mobile (avatar only) */}
          <div className="flex items-center gap-3 px-2 sm:px-3 py-1.5 rounded-2xl bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-all group cursor-default">
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
          </div>

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
