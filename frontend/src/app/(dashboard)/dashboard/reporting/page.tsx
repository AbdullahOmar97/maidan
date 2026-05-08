"use client";
import { PageHeader } from "@/components/dashboard/page-header";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { BarChart3, TrendingUp, Users, CreditCard, Award, CalendarCheck } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { PermissionGuard } from "@/components/dashboard/permission-guard";


export default function ReportingPage() {
  const { data: kpis } = useQuery({
    queryKey: ["dashboard", "kpi"],
    queryFn: () => api.dashboard.kpi().then((r) => r.data),
  });

  const { data: revenue } = useQuery({
    queryKey: ["reporting", "revenue"],
    queryFn: () => api.dashboard.revenue(12).then((r) => r.data),
  });

  const { data: retention } = useQuery({
    queryKey: ["reporting", "retention"],
    queryFn: () => api.dashboard.retention().then((r) => r.data),
  });

  const { data: belts } = useQuery({
    queryKey: ["reporting", "belts"],
    queryFn: () => api.dashboard.belts().then((r) => r.data),
  });

  return (
    <PermissionGuard permission="can_view_reports">
    <div className="space-y-8 pb-12">
      <PageHeader
        title="التقارير والتحليلات"
        description="رؤى شاملة عن أداء النادي، معدلات الاحتفاظ بالطلاب، نمو الإيرادات السنوية، وتوزيع الأحزمة."
        icon={BarChart3}
      />

      {/* Retention Metrics */}
      {retention && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            label="معدل الاحتفاظ"
            value={`${retention.retention_rate}%`}
            icon={TrendingUp}
            className="shadow-emerald-500/10"
          />
          <StatsCard
            label="تحويل التجارب"
            value={`${retention.trial_conversion_rate}%`}
            icon={Users}
            className="shadow-blue-500/10"
          />
          <StatsCard
            label="مغادرون (30 يوم)"
            value={retention.churned_last_30d.toString()}
            icon={CreditCard}
            className="shadow-red-500/10"
          />
          <StatsCard
            label="اشتراكات تنتهي قريباً"
            value={retention.memberships_expiring_30d.toString()}
            icon={CalendarCheck}
            className="shadow-amber-500/10"
          />
        </div>
      )}

      {/* Revenue Chart */}
      <div className="glass-card p-6">
        <h2 className="font-semibold mb-6">الإيرادات السنوية</h2>
        {revenue && revenue.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={revenue}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(224, 71%, 6%)", border: "1px solid hsl(215, 27%, 17%)", borderRadius: "8px", color: "#fff" }}
                formatter={(v: number) => [formatCurrency(v), "الإيراد"]}
              />
              <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fill="url(#revGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center text-muted-foreground">لا توجد بيانات</div>
        )}
      </div>

      {/* Belt Distribution */}
      {belts && belts.length > 0 && (
        <div className="glass-card p-6">
          <h2 className="font-semibold mb-6">توزيع الأحزمة</h2>
          <div className="flex flex-col lg:flex-row items-center gap-8">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={belts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="belt_name" type="category" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(224, 71%, 6%)", border: "1px solid hsl(215, 27%, 17%)", borderRadius: "8px", color: "#fff" }}
                  formatter={(v: number) => [v, "طلاب"]}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {belts.map((entry: Record<string, string | number>, index: number) => (
                    <Cell key={index} fill={entry.color as string} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
    </PermissionGuard>
  );
}
