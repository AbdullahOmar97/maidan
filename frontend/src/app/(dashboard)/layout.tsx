import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { TenantProvider } from "@/lib/providers/tenant-provider";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <TenantProvider>
      <DashboardShell session={session}>
        {children}
      </DashboardShell>
    </TenantProvider>
  );
}
