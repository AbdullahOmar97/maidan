"use client";

import { useState, useEffect, useRef } from "react";
import { Sidebar, MobileSidebarContent } from "@/components/dashboard/sidebar";
import { TopBar } from "@/components/dashboard/topbar";
import { DashboardFooter } from "@/components/dashboard/footer";
import { Drawer } from "@/components/ui/drawer";
import { useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import type { Session } from "next-auth";
import { useNetworkStatus } from "@/lib/hooks/use-network-status";
import { WifiOff } from "lucide-react";

interface DashboardShellProps {
  session: Session;
  children: React.ReactNode;
}

/**
 * Client-side shell that owns the mobile drawer state.
 * Kept separate from layout.tsx (a server component) so the
 * auth check stays on the server.
 */
export function DashboardShell({ session, children }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: clientSession, status } = useSession();
  const { setTheme } = useTheme();
  const { isOnline } = useNetworkStatus();
  const initialThemeSyncedRef = useRef(false);

  useEffect(() => {
    const error = (clientSession as any)?.error;
    if (status === "unauthenticated" || error === "RefreshAccessTokenError") {
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
  }, [status, clientSession]);

  const user = clientSession?.user || session.user;
  const uiPrefs = (user as any)?.ui_preferences;
  const langPref = (user as any)?.language_pref;

  useEffect(() => {
    if (typeof document === "undefined") return;
    const isCompact = Boolean(uiPrefs?.compact_tables);
    document.documentElement.classList.toggle("compact-tables", isCompact);

    if (langPref === "en" || langPref === "ar") {
      document.documentElement.lang = langPref;
      document.documentElement.dir = langPref === "ar" ? "rtl" : "ltr";
    }

    if (!initialThemeSyncedRef.current && uiPrefs?.theme) {
      initialThemeSyncedRef.current = true;
      setTheme(uiPrefs.theme);
    }
  }, [uiPrefs?.compact_tables, uiPrefs?.theme, langPref, setTheme]);

  return (
    <div className="flex h-[100dvh] bg-background overflow-hidden relative">
      {/* ── Accessible Skip to Main Content Link (WCAG 2.4.1) ── */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:start-4 focus:z-50 focus:px-4 focus:py-2.5 focus:bg-primary focus:text-white focus:font-black focus:rounded-xl focus:shadow-2xl focus:outline-none focus:ring-4 focus:ring-primary/40 text-xs uppercase tracking-wider"
      >
        تخطي إلى المحتوى الرئيسي / Skip to main content
      </a>

      {/* ── Offline Network Banner ── */}
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-0 inset-x-0 z-50 bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-center gap-2 shadow-lg animate-in slide-in-from-top-2"
        >
          <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>انقطع الاتصال بالإنترنت. يجري العمل في وضع عدم الاتصال (Offline Mode).</span>
        </div>
      )}

      {/* ── Decorative Background Blobs ── */}
      <div
        className="absolute top-[-8%] start-[-8%] w-[35%] h-[35%] bg-primary/8 blur-[130px] rounded-full pointer-events-none z-0"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-[-8%] end-[-8%] w-[28%] h-[28%] bg-primary/5 blur-[110px] rounded-full pointer-events-none z-0"
        aria-hidden="true"
      />
      <div
        className="absolute top-[25%] end-[8%] w-[18%] h-[18%] bg-blue-500/4 blur-[90px] rounded-full pointer-events-none z-0"
        aria-hidden="true"
      />

      {/* ── Desktop Sidebar ── */}
      <div className="relative z-20 shrink-0">
        <Sidebar user={user} />
      </div>

      {/* ── Mobile Drawer ── */}
      <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)}>
        <MobileSidebarContent
          user={user}
          onClose={() => setMobileOpen(false)}
        />
      </Drawer>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <TopBar
          user={user}
          onMenuToggle={() => setMobileOpen((prev) => !prev)}
          mobileOpen={mobileOpen}
        />
        <main
          id="main-content"
          className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar p-3 sm:p-5 lg:p-8 pb-safe"
          tabIndex={-1}
        >
          <div className="max-w-7xl mx-auto w-full flex flex-col min-h-full">
            <div className="flex-1 pb-4 sm:pb-6">{children}</div>
            <DashboardFooter />
          </div>
        </main>
      </div>
    </div>
  );
}
