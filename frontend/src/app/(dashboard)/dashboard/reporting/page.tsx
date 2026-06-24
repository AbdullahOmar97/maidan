"use client";
import { PageHeader } from "@/components/dashboard/page-header";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { BarChart3, TrendingUp, Users, CreditCard, Award, CalendarCheck } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { useTenant } from "@/lib/providers/tenant-provider";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { PermissionGuard } from "@/components/dashboard/permission-guard";

// Shared chart tooltip style (DRY — mirrors dashboard/page.tsx)
const TOOLTIP_STYLE = {
  backgroundColor: "rgba(15, 23, 42, 0.92)",
  backdropFilter: "blur(8px)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "16px",
  color: "#fff",
  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.2)",
} as const;

export default function ReportingPage() {
  const { tenant } = useTenant();
  const currency = tenant?.default_currency || "JOD";

  const { data: retention } = useQuery({
    queryKey: ["reporting", "retention"],
    queryFn: () => api.dashboard.retention().then((r) => r.data),
  });

  const { data: revenue } = useQuery({
    queryKey: ["reporting", "revenue"],
    queryFn: () => api.dashboard.revenue(12).then((r) => r.data),
  });

  const { data: belts } = useQuery({
    queryKey: ["reporting", "belts"],
    queryFn: () => api.dashboard.belts().then((r) => r.data),
  });

  return (
    <PermissionGuard permission="can_view_reports">
      <div className="space-y-6 sm:space-y-8 pb-6 page-enter">
        <PageHeader
          title="التقارير والتحليلات"
          description="رؤى شاملة عن أداء النادي، معدلات الاحتفاظ بالطلاب، نمو الإيرادات السنوية، وتوزيع الأحزمة."
          icon={BarChart3}
        />

        {/* Retention Metrics — 2 col on mobile, 4 on lg */}
        {retention && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
            <StatsCard
              label="معدل الاحتفاظ"
              value={`${retention.retention_rate}%`}
              icon={TrendingUp}
              color="emerald"
              description="نسبة تجديد الاشتراكات"
            />
            <StatsCard
              label="تحويل التجارب"
              value={`${retention.trial_conversion_rate}%`}
              icon={Users}
              color="primary"
              description="تحول الطلاب التجريبيين"
            />
            <StatsCard
              label="مغادرون (30 يوم)"
              value={retention.churned_last_30d.toString()}
              icon={CreditCard}
              color="red"
              description="طلاب توقفوا عن الحضور"
            />
            <StatsCard
              label="اشتراكات تنتهي قريباً"
              value={retention.memberships_expiring_30d.toString()}
              icon={CalendarCheck}
              color="amber"
              description="خلال 30 يوماً"
            />
          </div>
        )}

        {/* Revenue Chart */}
        <div className="glass-card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-5 sm:mb-7">
            <div>
              <h2 className="section-title">الإيرادات السنوية</h2>
              <p className="section-subtitle">آخر 12 شهر</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="w-5 h-5" aria-hidden="true" />
            </div>
          </div>
          {revenue && revenue.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={revenue}>
                <defs>
                  <linearGradient id="revGradReporting" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#dc2626" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} dy={8} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  cursor={{ stroke: "#dc2626", strokeWidth: 2, strokeDasharray: "5 5" }}
                  formatter={(v: number) => [formatCurrency(v, currency), "الإيراد"]}
                />
                <Area type="monotone" dataKey="revenue" stroke="#dc2626" strokeWidth={3} fill="url(#revGradReporting)" animationDuration={1500} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 sm:h-60 flex items-center justify-center text-muted-foreground text-sm font-medium border border-dashed border-white/5 rounded-2xl">
              لا توجد بيانات متاحة حالياً
            </div>
          )}
        </div>

        {/* Belt Distribution */}
        {belts && belts.length > 0 && (
          <div className="glass-card p-4 sm:p-6">
            <div className="flex items-center justify-between mb-5 sm:mb-7">
              <div>
                <h2 className="section-title">توزيع الأحزمة</h2>
                <p className="section-subtitle">قاعدة الطلاب</p>
              </div>
              <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400">
                <Award className="w-5 h-5" aria-hidden="true" />
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={belts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="belt_name" type="category" tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} width={70} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: number) => [v, "طلاب"]}
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={20}>
                  {belts.map((entry: Record<string, string | number>, index: number) => (
                    <Cell key={index} fill={entry.color as string} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </PermissionGuard>
  );
}
