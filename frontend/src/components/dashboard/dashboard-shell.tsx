"use client";

import { useState } from "react";
import { Sidebar, MobileSidebarContent } from "@/components/dashboard/sidebar";
import { TopBar } from "@/components/dashboard/topbar";
import { DashboardFooter } from "@/components/dashboard/footer";
import { Drawer } from "@/components/ui/drawer";
import type { Session } from "next-auth";

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

  return (
    <div className="flex h-screen bg-background overflow-hidden relative">
      {/* ── Decorative Background Elements ── */}
      <div className="absolute top-[-10%] start-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full pointer-events-none z-0" aria-hidden="true" />
      <div className="absolute bottom-[-10%] end-[-10%] w-[30%] h-[30%] bg-primary/5 blur-[100px] rounded-full pointer-events-none z-0" aria-hidden="true" />
      <div className="absolute top-[20%] end-[10%] w-[20%] h-[20%] bg-blue-500/5 blur-[80px] rounded-full pointer-events-none z-0" aria-hidden="true" />

      {/* ── Desktop Sidebar (hidden on mobile via CSS) ── */}
      <div className="relative z-20 shrink-0">
        <Sidebar user={session.user} />
      </div>

      {/* ── Mobile Drawer ── */}
      <Drawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
      >
        <MobileSidebarContent
          user={session.user}
          onClose={() => setMobileOpen(false)}
        />
      </Drawer>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        <TopBar
          user={session.user}
          onMenuToggle={() => setMobileOpen(true)}
        />
        <main
          id="main-content"
          className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 lg:p-8 pb-20 sm:pb-6 lg:pb-8 flex flex-col"
          tabIndex={-1}
        >
          <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col">
            <div className="flex-1">
              {children}
            </div>
            <DashboardFooter />
          </div>
        </main>
      </div>
    </div>
  );
}
