"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import {
  TrendingUp, TrendingDown, ArrowDownLeft, ArrowUpRight,
  Receipt, Wallet, Users, Landmark, PiggyBank, Scale, AlertCircle,
  Building2, Percent, CheckCircle2, ShieldCheck, BarChart3
} from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { useTenant } from "@/lib/providers/tenant-provider";
import { PeriodFilterBar } from "@/components/dashboard/PeriodFilterBar";
import type { CashFlowSummary, Location } from "@/types";

interface CashFlowTabProps {
  locations?: Location[];
}

export function CashFlowTab({ locations = [] }: CashFlowTabProps) {
  const { tenant } = useTenant();
  const tenantCurrency = tenant?.default_currency || "JOD";

  const [period, setPeriod] = useState("this_month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [locationId, setLocationId] = useState("");

  const queryParams = {
    period: period || undefined,
    start_date: period === "custom" && startDate ? startDate : undefined,
    end_date: period === "custom" && endDate ? endDate : undefined,
    location_id: locationId ? Number(locationId) : undefined,
  };

  const { data: cashFlow, isLoading } = useQuery<CashFlowSummary>({
    queryKey: ["billing", "cash-flow", queryParams],
    queryFn: () => api.billing.expenses.cashFlow(queryParams).then((r: any) => r.data),
  });

  const totalInflows = cashFlow?.inflows?.total ?? 0;
  const totalOutflows = cashFlow?.outflows?.total ?? 0;
  const netCashFlow = cashFlow?.net_cash_flow ?? 0;
  const isSurplus = cashFlow?.is_surplus ?? netCashFlow >= 0;
  const profitMargin = cashFlow?.profit_margin_pct ?? 0;
  const expenseRatio = cashFlow?.operating_expense_ratio ?? 0;

  return (
    <div className="space-y-6">
      {/* Period & Cost Center Filter */}
      <PeriodFilterBar
        period={period}
        startDate={startDate}
        endDate={endDate}
        onPeriodChange={setPeriod}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        actions={
          locations.length > 0 && (
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-xs text-foreground font-bold focus:outline-none"
            >
              <option value="">كامل فروع الأكاديمية (مركز موحد)</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  فرع: {loc.name}
                </option>
              ))}
            </select>
          )
        }
      />

      {/* Net Financial Surplus/Deficit Banner */}
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl p-6 lg:p-8 border transition-all",
          isSurplus
            ? "bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/20"
            : "bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent border-rose-500/20"
        )}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-white/10 text-foreground border border-white/10">
              <Scale className="w-3.5 h-3.5 text-primary" />
              قائمة التدفقات النقدية والأرباح التشغيلية
            </div>
            <h1 className="text-2xl lg:text-3xl font-black text-foreground">
              {isSurplus ? "صافي فائض تشغيلي (أرباح نقدية)" : "صافي عجز تشغيلي (تدفق سلبي)"}
            </h1>
            <p className="text-xs text-muted-foreground max-w-xl">
              مقارنة محاسبية دقيقة بين المقبوضات المحصلة من الاشتراكات والخدمات مقابل جميع الالتزامات والمصروفات
              والرواتب المصروفة.
            </p>
          </div>

          <div className="text-start md:text-end space-y-1">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
              صافي الفارق المالي
            </span>
            <div
              className={cn(
                "text-3xl lg:text-4xl font-black tracking-tight",
                isSurplus ? "text-emerald-400" : "text-rose-400"
              )}
            >
              <bdi>{formatCurrency(netCashFlow, tenantCurrency)}</bdi>
            </div>
            <div className="flex items-center md:justify-end gap-3 text-xs font-bold text-muted-foreground pt-1">
              <span className="flex items-center gap-1">
                {isSurplus ? (
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                )}
                هامش الربح التشغيلي: <span className="text-foreground">{profitMargin}%</span>
              </span>
              <span>•</span>
              <span>
                معدل النفقات للإيراد: <span className="text-foreground">{expenseRatio}%</span>
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Cash Flow Bar */}
        <div className="mt-6 pt-6 border-t border-white/10 space-y-2">
          <div className="flex justify-between text-xs font-bold">
            <span className="text-emerald-400 flex items-center gap-1.5">
              <ArrowDownLeft className="w-4 h-4" />
              المدخلات (المقبوضات): {formatCurrency(totalInflows, tenantCurrency)}
            </span>
            <span className="text-rose-400 flex items-center gap-1.5">
              <ArrowUpRight className="w-4 h-4" />
              المخرجات (المدفوعات): {formatCurrency(totalOutflows, tenantCurrency)}
            </span>
          </div>

          <div className="h-3 w-full bg-secondary/50 rounded-full overflow-hidden flex">
            {totalInflows + totalOutflows > 0 ? (
              <>
                <div
                  className="bg-emerald-500 transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(0, (totalInflows / (totalInflows + totalOutflows)) * 100)
                    )}%`,
                  }}
                  title="نسبة المقبوضات"
                />
                <div
                  className="bg-rose-500 transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(0, (totalOutflows / (totalInflows + totalOutflows)) * 100)
                    )}%`,
                  }}
                  title="نسبة المدفوعات"
                />
              </>
            ) : (
              <div className="w-full bg-secondary/30" />
            )}
          </div>
        </div>
      </div>

      {/* Two Pillars Grid: Inflows vs Outflows */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pillar 1: Inflows */}
        <div className="glass-card p-6 space-y-5 border-emerald-500/20">
          <div className="flex items-center justify-between pb-4 border-b border-border/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <ArrowDownLeft className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-base text-foreground">المدخلات المالية (الإيرادات المحصلة)</h2>
                <p className="text-xs text-muted-foreground">كافة التدفقات النقدية الداخلة لصندوق وحساب النادي</p>
              </div>
            </div>
            <div className="text-end">
              <div className="text-lg font-black text-emerald-400">
                {formatCurrency(totalInflows, tenantCurrency)}
              </div>
              <div className="text-[10px] text-muted-foreground">{cashFlow?.inflows?.count ?? 0} عملية تحصيل</div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center gap-3">
                <Receipt className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-foreground">فواتير واشتراكات الطلاب المسددة</span>
              </div>
              <span className="text-xs font-bold text-foreground">
                {formatCurrency(totalInflows, tenantCurrency)}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-xs text-muted-foreground space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                قواعد الاعتراف المحاسبي بالإيرادات
              </div>
              <p>
                يتم احتساب المقبوضات الفعلية المدفوعة عبر الكاش أو التحويل البنكي أو بوابات الدفع الإلكترونية
                خلال الفترة الزمنية المحددة.
              </p>
            </div>
          </div>
        </div>

        {/* Pillar 2: Outflows */}
        <div className="glass-card p-6 space-y-5 border-rose-500/20">
          <div className="flex items-center justify-between pb-4 border-b border-border/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400">
                <ArrowUpRight className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-base text-foreground">المخرجات المالية (المصروفات والمدفوعات)</h2>
                <p className="text-xs text-muted-foreground">كافة التدفقات النقدية الخارجة والالتزامات المسددة</p>
              </div>
            </div>
            <div className="text-end">
              <div className="text-lg font-black text-rose-400">
                {formatCurrency(totalOutflows, tenantCurrency)}
              </div>
              <div className="text-[10px] text-muted-foreground">إجمالي النفقات الشاملة</div>
            </div>
          </div>

          <div className="space-y-2.5">
            {/* Operating Expenses */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center gap-3">
                <Building2 className="w-4 h-4 text-primary" />
                <div>
                  <div className="text-xs font-semibold text-foreground">المصروفات التشغيلية وفواتير الموردين</div>
                  <div className="text-[10px] text-muted-foreground">
                    {cashFlow?.outflows?.operating_expenses_count ?? 0} سند صرف (إيجار، كهرباء، صيانة...)
                  </div>
                </div>
              </div>
              <span className="text-xs font-bold text-foreground">
                {formatCurrency(cashFlow?.outflows?.operating_expenses ?? 0, tenantCurrency)}
              </span>
            </div>

            {/* Staff Payroll */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 text-blue-400" />
                <div>
                  <div className="text-xs font-semibold text-foreground">مسيرات رواتب الموظفين والمدربين</div>
                  <div className="text-[10px] text-muted-foreground">
                    {cashFlow?.outflows?.payroll_count ?? 0} قسائم رواتب مدفوعة ومعتمدة
                  </div>
                </div>
              </div>
              <span className="text-xs font-bold text-foreground">
                {formatCurrency(cashFlow?.outflows?.payroll ?? 0, tenantCurrency)}
              </span>
            </div>

            {/* Staff Advances Disbursed */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center gap-3">
                <Wallet className="w-4 h-4 text-amber-400" />
                <div>
                  <div className="text-xs font-semibold text-foreground">سلف الموظفين المصروفة خلال الفترة</div>
                  <div className="text-[10px] text-muted-foreground">
                    {cashFlow?.outflows?.advances_count ?? 0} سلف مالية ممنوحة
                  </div>
                </div>
              </div>
              <span className="text-xs font-bold text-foreground">
                {formatCurrency(cashFlow?.outflows?.advances ?? 0, tenantCurrency)}
              </span>
            </div>

            {/* VAT Breakdown */}
            {(cashFlow?.outflows?.tax_amount ?? 0) > 0 && (
              <div className="flex items-center justify-between px-3.5 py-2 text-xs text-muted-foreground">
                <span>منها ضرائب مبيعات وقيمة مضافة (VAT):</span>
                <span className="font-bold text-foreground">
                  {formatCurrency(cashFlow?.outflows?.tax_amount ?? 0, tenantCurrency)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expense Categories Breakdown Bar */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-foreground">تحليل بنود المصروفات التشغيلية حسب التصنيف</h3>
            <p className="text-xs text-muted-foreground">
              نسبة استهلاك كل بند من إجمالي المصروفات التشغيلية لتحديد فرص الترشيد وضبط الموازنة.
            </p>
          </div>
          <BarChart3 className="w-5 h-5 text-primary" />
        </div>

        {cashFlow?.categories_breakdown && cashFlow.categories_breakdown.length > 0 ? (
          <div className="space-y-3 pt-2">
            {cashFlow.categories_breakdown.map((item, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-foreground">{item.name}</span>
                  <span className="text-muted-foreground">
                    {formatCurrency(item.total, tenantCurrency)} ({item.pct}%)
                  </span>
                </div>
                <div className="h-2 w-full bg-secondary/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(2, item.pct))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-muted-foreground">
            لا توجد مصروفات تشغيلية مسجلة لهذه الفترة.
          </div>
        )}
      </div>
    </div>
  );
}
