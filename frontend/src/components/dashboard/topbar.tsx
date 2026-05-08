"use client";

import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, LogOut, Moon, Sun, Search, Shield, ChevronDown } from "lucide-react";
import { useTheme } from "next-themes";
import type { Session } from "next-auth";
import { UserRole } from "@/types";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/constants";

interface TopBarProps {
  user: Session["user"];
}

export function TopBar({ user }: TopBarProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const queryClient = useQueryClient();
  const role = (user as any)?.role as UserRole;

  const handleLogout = async () => {
    // 1. Clear storage
    if (typeof window !== "undefined") {
      const themePref = localStorage.getItem("theme");
      localStorage.clear();
      sessionStorage.clear();
      
      // Preserve theme if it existed
      if (themePref) {
        localStorage.setItem("theme", themePref);
      }
    }

    // 2. Clear Query Cache
    queryClient.clear();

    // 3. Sign out
    await signOut({ callbackUrl: "/login" });
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="h-20 border-b border-white/[0.05] flex items-center justify-between px-8 bg-card/10 backdrop-blur-3xl shrink-0 relative z-20">
      {/* Search Section */}
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <div className="relative flex-1 group">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-all group-focus-within:scale-110" />
          <input
            type="text"
            placeholder="ابحث عن طلاب، فواتير، أو حصص..."
            className="w-full pl-6 pr-11 py-2.5 text-sm rounded-2xl bg-white/[0.03] border border-white/[0.05] focus:bg-white/[0.05] focus:border-primary/40 focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all placeholder:text-muted-foreground/30 font-medium"
          />
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Actions Group */}
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-2xl bg-white/[0.02] border border-white/5">
          {/* Theme Toggle */}
          <button
            id="theme-toggle"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/5 transition-all active:scale-90"
            aria-label="Toggle theme"
          >
            {mounted && theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Notifications */}
          <button
            id="notifications-btn"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/5 transition-all relative active:scale-90"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary glow-primary border-2 border-[#0f172a]" />
          </button>
        </div>

        {/* Separator */}
        <div className="h-8 w-px bg-white/5 mx-1" />

        {/* Profile & Logout Section */}
        <div className="flex items-center gap-3">
          {/* User Profile Card */}
          <div className="flex items-center gap-3 px-3 py-1.5 rounded-2xl bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-all group cursor-default">
            {/* User Info - Text */}
            <div className="text-right flex flex-col items-end">
              <p className="text-sm font-black text-white tracking-tight leading-none mb-1 group-hover:text-primary transition-colors whitespace-nowrap">
                {((user as any)?.first_name && (user as any)?.last_name) 
                  ? `${(user as any).first_name} ${(user as any).last_name}` 
                  : (user?.name ?? "المستخدم")}
              </p>
              <div className="flex items-center gap-1.5">
                <Shield className="w-2.5 h-2.5 text-primary opacity-50" />
                <p className="text-[10px] font-black text-primary uppercase tracking-widest leading-none">
                  {ROLE_LABELS[role] ?? role}
                </p>
              </div>
            </div>

            {/* Avatar */}
            <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center text-white text-sm font-black shadow-lg shadow-primary/20 group-hover:scale-105 group-hover:rotate-3 transition-all duration-300">
              {(user as any)?.first_name?.[0]?.toUpperCase() ?? user?.name?.[0]?.toUpperCase() ?? "U"}
            </div>
          </div>

          {/* Logout Button */}
          <button
            id="logout-btn"
            onClick={handleLogout}
            className="w-11 h-11 rounded-2xl bg-red-500/5 border border-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500 hover:text-white hover:border-red-500 shadow-lg hover:shadow-red-500/20 transition-all active:scale-90 group/logout"
            title="تسجيل الخروج"
          >
            <LogOut className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </header>
  );
}


