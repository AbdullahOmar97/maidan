"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ShieldAlert, Loader2 } from "lucide-react";
import { hasEffectivePermission, PRIVILEGED_ROLES } from "@/lib/hooks/use-permission";
import type { UserRole } from "@/types";

interface PermissionGuardProps {
  children: React.ReactNode;
  permission?: string;
  roles?: string[];
  role?: string;
}

export function PermissionGuard({
  children,
  permission,
  roles,
  role: requiredRole,
}: PermissionGuardProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.push("/login");
      return;
    }

    const user = session.user as any;
    const userRole = user.role as UserRole | undefined;
    const userPermissions = user.permissions || {};

    if (userRole && PRIVILEGED_ROLES.includes(userRole)) {
      setHasAccess(true);
      return;
    }

    let access = true;

    if (requiredRole && userRole !== requiredRole) {
      access = false;
    }

    if (roles && (!userRole || !roles.includes(userRole))) {
      access = false;
    }

    if (permission && !hasEffectivePermission(userRole, userPermissions, permission)) {
      access = false;
    }

    setHasAccess(access);
  }, [session, status, permission, roles, requiredRole, router]);

  if (status === "loading" || hasAccess === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-muted-foreground animate-pulse font-medium">جاري التحقق من الصلاحيات...</p>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6 glass-card border-destructive/20 bg-destructive/5">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6 ring-4 ring-destructive/5">
          <ShieldAlert className="w-8 h-8 text-destructive" />
        </div>
        <h2 className="text-2xl font-black text-foreground mb-2 tracking-tight">وصول غير مصرح به</h2>
        <p className="text-muted-foreground max-w-md leading-relaxed mb-8">
          عذراً، ليس لديك الصلاحيات الكافية للوصول إلى هذه الصفحة. يرجى التواصل مع مدير النظام إذا كنت تعتقد أن هذا خطأ.
        </p>
        <button
          onClick={() => router.push("/dashboard")}
          className="px-8 py-3 rounded-2xl bg-primary text-primary-foreground font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20 active:scale-95"
        >
          العودة للوحة التحكم
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
