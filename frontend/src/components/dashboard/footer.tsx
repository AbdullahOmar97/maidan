"use client";

import { useTenant } from "@/lib/providers/tenant-provider";

export function DashboardFooter() {
  const { tenant } = useTenant();

  return (
    <footer className="mt-auto py-6 border-t border-white/[0.05] flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
      <div className="flex items-center gap-3">
        {tenant?.logo && (
          <img src={tenant.logo} alt="Club Logo" className="h-6 object-contain opacity-50 hover:opacity-100 transition-opacity" />
        )}
        <p>
          &copy; {new Date().getFullYear()} {tenant?.name || "النادي"}. جميع الحقوق محفوظة.
        </p>
      </div>
      <div className="flex items-center gap-2 opacity-50">
        <span>Powered by</span>
        <span className="font-bold tracking-widest text-primary">MAIDAN</span>
      </div>
    </footer>
  );
}
