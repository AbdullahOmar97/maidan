import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/dashboard/sidebar";
import { TopBar } from "@/components/dashboard/topbar";
import { DashboardFooter } from "@/components/dashboard/footer";
import { TenantProvider } from "@/lib/providers/tenant-provider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="flex h-screen bg-background overflow-hidden relative">
      <TenantProvider>
        {/* Decorative Background Elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full pointer-events-none z-0" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-primary/5 blur-[100px] rounded-full pointer-events-none z-0" />
        <div className="absolute top-[20%] right-[10%] w-[20%] h-[20%] bg-blue-500/5 blur-[80px] rounded-full pointer-events-none z-0" />

        {/* Sidebar */}
        <div className="relative z-20 shrink-0">
          <Sidebar user={session.user} />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
          <TopBar user={session.user} />
          <main className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-8 flex flex-col">
            <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col">
              <div className="flex-1">
                {children}
              </div>
              <DashboardFooter />
            </div>
          </main>
        </div>
      </TenantProvider>
    </div>
  );
}

