import { auth } from "@/lib/auth/auth";
import { isTenantHost } from "@/lib/auth/host";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { TenantProvider } from "@/lib/providers/tenant-provider";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const reqHeaders = await headers();
  const rawHost = reqHeaders.get("x-forwarded-host") || reqHeaders.get("host") || "";
  const currentHost = rawHost.split(",")[0].trim().split(":")[0].toLowerCase();
  const isCurrentTenant = isTenantHost(currentHost);

  const sessionTenant = ((session as any)?.tenant || "").toLowerCase();
  const hasValidToken = Boolean((session as any)?.accessToken) && !(session as any)?.error;
  const isSameTenant = isCurrentTenant ? sessionTenant === currentHost : !sessionTenant;

  if (!session?.user || !hasValidToken || !isSameTenant) {
    redirect("/login");
  }

  return (
    <TenantProvider>
      <DashboardShell session={session}>
        {children}
      </DashboardShell>
    </TenantProvider>
  );
}
