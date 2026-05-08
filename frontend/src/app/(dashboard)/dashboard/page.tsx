"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  TrendingUp,
  CreditCard,
  CalendarCheck,
  Award,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { api } from "@/lib/api/client";
import { formatCurrency } from "@/lib/utils";
import type { DashboardKPIs } from "@/types";
import Link from "next/link";
import { useBillingPermissions } from "@/lib/hooks/use-permission";

// ---------------------------------------------------------------------------
// Shared chart tooltip style
// ---------------------------------------------------------------------------
const TOOLTIP_STYLE = {
  backgroundColor: "rgba(15, 23, 42, 0.92)",
  backdropFilter: "blur(8px)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "16px",
  color: "#fff",
  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.2)",
} as const;

// ---------------------------------------------------------------------------
// Metric row (retention panel)
// ---------------------------------------------------------------------------
function MetricRow({
  label,
  value,
  color,
  description,
}: {
  label: string;
  value: string | number;
  color: "emerald" | "primary" | "red" | "amber";
  description?: string;
}) {
  const colorMap = {
    emerald: "text-emerald-400 bg-emerald-500/5 border-emerald-500/10",
    primary: "text-primary bg-primary/5 border-primary/10",
    red:     "text-red-400 bg-red-500/5 border-red-500/10",
    amber:   "text-amber-400 bg-amber-500/5 border-amber-500/10",
  };

  return (
    <div
      className={`flex items-center justify-between p-3 md:p-4 rounded-2xl border ${colorMap[color]} group hover:bg-white/[0.02] transition-colors`}
    >
      <div>
        <span className="text-sm font-bold text-white block">{label}</span>
        {description && (
          <span className="text-[10px] font-medium text-muted-foreground/60">{description}</span>
        )}
      </div>
      <span className="text-lg font-black tracking-tight shrink-0 mr-4">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chart card wrapper
// ---------------------------------------------------------------------------
function ChartCard({
  title,
  subtitle,
  icon: Icon,
  iconColor,
  children,
  className,
}: {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  iconColor: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`glass-card p-5 md:p-8 group ${className ?? ""}`}>
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <div>
          <h2 className="text-lg md:text-xl font-black tracking-tight text-white">{title}</h2>
          <p className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">
            {subtitle}
          </p>
        </div>
        <div className={`p-2.5 md:p-3 rounded-2xl ${iconColor}`}>
          <Icon className="w-4 h-4 md:w-5 md:h-5" aria-hidden="true" />
        </div>
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard Page
// ---------------------------------------------------------------------------
export default function DashboardPage() {
  const { data: kpis, isLoading: kpisLoading, refetch } = useQuery<DashboardKPIs>({
    queryKey: ["dashboard", "kpi"],
    queryFn:  () => api.dashboard.kpi().then((r) => r.data),
    staleTime: 30_000,
  });

  const { data: revenueData }    = useQuery({ queryKey: ["dashboard", "revenue"],    queryFn: () => api.dashboard.revenue(6).then((r) => r.data) });
  const { data: beltData }       = useQuery({ queryKey: ["dashboard", "belts"],      queryFn: () => api.dashboard.belts().then((r) => r.data) });
  const { data: attendanceData } = useQuery({ queryKey: ["dashboard", "attendance"], queryFn: () => api.dashboard.attendance("weekly").then((r) => r.data) });
  const { data: retentionData }  = useQuery({ queryKey: ["dashboard", "retention"],  queryFn: () => api.dashboard.retention().then((r) => r.data) });

  const { canCreateInvoice } = useBillingPermissions();

  const quickActions = [
    { label: "إضافة طالب",   href: "/dashboard/students/new",  icon: Users,         color: "from-primary/20 to-primary/5 border-primary/20 text-primary shadow-primary/10",          show: true },
    { label: "تسجيل حضور",  href: "/dashboard/attendance",    icon: CalendarCheck,  color: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 text-emerald-400 shadow-emerald-500/10", show: true },
    { label: "إنشاء فاتورة", href: "/dashboard/billing/new",   icon: CreditCard,    color: "from-amber-500/20 to-amber-500/5 border-amber-500/20 text-amber-400 shadow-amber-500/10",   show: canCreateInvoice },
    { label: "إرسال تنبيه",  href: "/dashboard/messaging",     icon: Clock,         color: "from-purple-500/20 to-purple-500/5 border-purple-500/20 text-purple-400 shadow-purple-500/10", show: true },
  ].filter((a) => a.show);

  const emptyChart = (height: string) => (
    <div
      className={`${height} flex items-center justify-center text-muted-foreground text-sm font-medium border border-dashed border-white/5 rounded-2xl bg-white/[0.01]`}
    >
      لا توجد بيانات متاحة حالياً
    </div>
  );

  return (
    <div className="space-y-6 md:space-y-8 pb-12 page-enter">
      {/* Header */}
      <PageHeader
        title="نظرة عامة"
        description={`نظام ميدان متصل — ${new Date().toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`}
        icon={Sparkles}
      >
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.08] hover:border-primary/40 text-sm font-bold text-muted-foreground hover:text-white transition-all group active:scale-95"
          aria-label="تحديث البيانات"
        >
          <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-700" aria-hidden="true" />
          <span className="hidden xs:inline">تحديث البيانات</span>
        </button>
      </PageHeader>

      {/* KPI Grid — 1 col on mobile, 2 on sm, 4 on lg */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatsCard
          loading={kpisLoading}
          title="الطلاب النشطون"
          label="الطلاب النشطون"
          value={kpis?.students.active ?? 0}
          subtitle={`${kpis?.students.trial ?? 0} تجريبي هذا الشهر`}
          icon={Users}
          color="primary"
          trend={kpis?.students.new_this_month ? "up" : "neutral"}
          trendValue={`+${kpis?.students.new_this_month ?? 0} جديد`}
          href="/dashboard/students"
        />
        <StatsCard
          loading={kpisLoading}
          title="إيرادات الشهر"
          label="إيرادات الشهر"
          value={formatCurrency(kpis?.revenue.this_month ?? 0, kpis?.revenue.currency ?? "SAR")}
          subtitle={`مستهدف: ${formatCurrency((kpis?.revenue.this_month ?? 0) * 1.2)}`}
          icon={CreditCard}
          color="emerald"
          trend={(kpis?.revenue.change_pct ?? 0) >= 0 ? "up" : "down"}
          trendValue={`${Math.abs(kpis?.revenue.change_pct ?? 0)}%`}
          href="/dashboard/billing"
        />
        <StatsCard
          loading={kpisLoading}
          title="حضور اليوم"
          label="حضور اليوم"
          value={kpis?.attendance.today ?? 0}
          subtitle={`${kpis?.attendance.active_sessions ?? 0} حصص نشطة`}
          icon={CalendarCheck}
          color="primary"
          href="/dashboard/attendance"
        />
        <StatsCard
          loading={kpisLoading}
          title="مدفوعات متأخرة"
          label="مدفوعات متأخرة"
          value={formatCurrency(kpis?.revenue.overdue ?? 0, kpis?.revenue.currency ?? "SAR")}
          subtitle="تحتاج لمتابعة فورية"
          icon={AlertTriangle}
          color="amber"
          href="/dashboard/billing?status=overdue"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Revenue Chart */}
        <ChartCard
          className="lg:col-span-2"
          title="تحليل الإيرادات"
          subtitle="آخر 6 أشهر"
          icon={TrendingUp}
          iconColor="bg-emerald-500/10 text-emerald-400"
        >
          {revenueData && revenueData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} dy={10} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip cursor={{ stroke: "#6366f1", strokeWidth: 2, strokeDasharray: "5 5" }} contentStyle={TOOLTIP_STYLE} itemStyle={{ fontWeight: "bold" }} />
                <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={4} fill="url(#revenueGrad)" animationDuration={2000} />
              </AreaChart>
            </ResponsiveContainer>
          ) : emptyChart("h-[220px]")}
        </ChartCard>

        {/* Belt Distribution */}
        <ChartCard
          title="توزيع الأحزمة"
          subtitle="قاعدة الطلاب"
          icon={Award}
          iconColor="bg-amber-500/10 text-amber-400"
        >
          {beltData && beltData.length > 0 ? (
            <div className="relative">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={beltData}
                    cx="50%" cy="50%"
                    innerRadius={60} outerRadius={88}
                    paddingAngle={6}
                    dataKey="count"
                    nameKey="belt_name"
                    animationBegin={0}
                    animationDuration={1500}
                  >
                    {beltData.map((entry: any, index: number) => (
                      <Cell key={index} fill={entry.color} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">إجمالي</p>
                <p className="text-2xl font-black text-white mt-1">
                  {beltData.reduce((acc: number, curr: any) => acc + curr.count, 0)}
                </p>
              </div>
            </div>
          ) : emptyChart("h-[220px]")}
        </ChartCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Attendance Bar Chart */}
        <ChartCard
          className="lg:col-span-2"
          title="إحصائيات الحضور"
          subtitle="آخر 12 أسبوع"
          icon={CalendarCheck}
          iconColor="bg-primary/10 text-primary"
        >
          {attendanceData && attendanceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={attendanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis dataKey="week" tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "rgba(255,255,255,0.02)" }} contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          ) : emptyChart("h-[200px]")}
        </ChartCard>

        {/* Retention Metrics */}
        <div className="glass-card p-5 md:p-8 space-y-5 md:space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg md:text-xl font-black tracking-tight text-white">النمو والاحتفاظ</h2>
              <p className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">مؤشرات حيوية</p>
            </div>
            <div className="p-2.5 md:p-3 rounded-2xl bg-primary/10 text-primary animate-pulse">
              <Sparkles className="w-4 h-4 md:w-5 md:h-5" aria-hidden="true" />
            </div>
          </div>

          {retentionData ? (
            <div className="space-y-3">
              <MetricRow label="معدل الاحتفاظ"    value={`${retentionData.retention_rate}%`}         color="emerald" description="نسبة تجديد الاشتراكات" />
              <MetricRow label="تحويل التجارب"    value={`${retentionData.trial_conversion_rate}%`}  color="primary" description="تحول الطلاب التجريبيين" />
              <MetricRow label="مغادرون (30 يوم)" value={retentionData.churned_last_30d}              color="red"     description="طلاب توقفوا عن الحضور" />
              <MetricRow label="عضويات تنتهي"     value={retentionData.memberships_expiring_30d}     color="amber"   description="تحتاج تواصل خلال 30 يوم" />

              <Link
                href="/dashboard/reporting"
                className="flex items-center justify-center gap-2 w-full mt-4 py-3 rounded-2xl border border-white/10 text-white text-sm font-bold hover:bg-white/[0.05] hover:border-primary/40 transition-all active:scale-[0.98]"
              >
                عرض التقارير التفصيلية
                <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="shimmer h-14 rounded-2xl" />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="glass-card p-5 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[80px] -mr-32 -mt-32 pointer-events-none" aria-hidden="true" />
        <h2 className="text-lg md:text-xl font-black tracking-tight mb-5 md:mb-6 relative z-10">إجراءات سريعة</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 relative z-10">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={`flex flex-col items-center gap-3 md:gap-4 p-4 md:p-6 rounded-3xl bg-gradient-to-br border shadow-xl ${action.color} hover:-translate-y-1 hover:opacity-90 active:scale-95 transition-all text-center group`}
            >
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                <action.icon className="w-5 h-5 md:w-6 md:h-6" aria-hidden="true" />
              </div>
              <span className="text-xs md:text-sm font-black tracking-tight">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
