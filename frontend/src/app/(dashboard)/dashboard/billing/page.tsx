"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { PermissionGuard } from "@/components/dashboard/permission-guard";
import { InvoicesList } from "@/components/dashboard/billing/InvoicesList";
import { Select } from "@/components/ui/select";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { formatCurrency } from "@/lib/utils";
import {
  CreditCard, AlertTriangle, CheckCircle, Clock,
  TrendingUp, Search, Plus, Filter,
} from "lucide-react";
import type { Invoice, PaginatedResponse, BillingSummary, Location } from "@/types";
import { PeriodFilterBar } from "@/components/dashboard/PeriodFilterBar";
import { useDebounce } from "@/lib/hooks/use-debounce";
import Link from "next/link";
import { useBillingPermissions } from "@/lib/hooks/use-permission";
import { useTenant } from "@/lib/providers/tenant-provider";
import { ExpensesTab } from "@/components/dashboard/billing/ExpensesTab";
import { CashFlowTab } from "@/components/dashboard/billing/CashFlowTab";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DATE_BY_OPTIONS = [
  { value: "created_at", label: "تاريخ الإصدار" },
  { value: "due_date", label: "تاريخ الاستحقاق" },
  { value: "paid_at", label: "تاريخ السداد" },
];

const STATUS_OPTIONS = [
  { value: "pending", label: "معلق" },
  { value: "paid", label: "مدفوع" },
  { value: "overdue", label: "متأخر" },
  { value: "partially_paid", label: "مسدد جزئياً" },
  { value: "void", label: "ملغي" },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function BillingPage() {
  const { tenant } = useTenant();
  const tenantCurrency = tenant?.default_currency || "JOD";
  const [activeMainTab, setActiveMainTab] = useState<"invoices" | "expenses" | "cash-flow">("invoices");
  const [period, setPeriod] = useState("this_month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [locationId, setLocationId] = useState("");
  const [planId, setPlanId] = useState("");
  const [dateBy, setDateBy] = useState("created_at");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const debouncedSearch = useDebounce(search, 350);
  const { canMarkInvoicePaid, canManageBilling, canCreateInvoice } = useBillingPermissions();

  // Load locations and plans for contextual filtering
  const { data: locations } = useQuery<Location[]>({
    queryKey: ["locations"],
    queryFn: () => api.locations.list().then((r: any) => r.data.results || r.data),
  });

  const { data: plans } = useQuery<any[]>({
    queryKey: ["billing", "plans"],
    queryFn: () => api.billing.plans.list().then((r: any) => r.data.results || r.data),
  });

  const summaryParams = {
    period: period || undefined,
    start_date: period === "custom" && startDate ? startDate : undefined,
    end_date: period === "custom" && endDate ? endDate : undefined,
    location_id: locationId ? Number(locationId) : undefined,
    plan_id: planId ? Number(planId) : undefined,
    date_by: dateBy !== "created_at" ? dateBy : undefined,
  };

  const { data: summary, isLoading: isSummaryLoading } = useQuery<BillingSummary>({
    queryKey: ["billing", "summary", summaryParams],
    queryFn: () => api.billing.invoices.summary(summaryParams).then((r) => r.data),
  });

  const invoiceParams = {
    status: statusFilter || undefined,
    search: debouncedSearch || undefined,
    period: period || undefined,
    start_date: period === "custom" && startDate ? startDate : undefined,
    end_date: period === "custom" && endDate ? endDate : undefined,
    location_id: locationId ? Number(locationId) : undefined,
    plan_id: planId ? Number(planId) : undefined,
    date_by: dateBy !== "created_at" ? dateBy : undefined,
    page,
  };

  const { data: invoices, isLoading } = useQuery<PaginatedResponse<Invoice>>({
    queryKey: ["billing", "invoices", invoiceParams],
    queryFn: () => api.billing.invoices.list(invoiceParams).then((r) => r.data),
  });

  const isFiltered =
    period !== "this_month" ||
    !!startDate ||
    !!endDate ||
    !!locationId ||
    !!planId ||
    !!statusFilter ||
    dateBy !== "created_at" ||
    !!search;

  const handleReset = () => {
    setPeriod("this_month");
    setStartDate("");
    setEndDate("");
    setLocationId("");
    setPlanId("");
    setStatusFilter("");
    setDateBy("created_at");
    setSearch("");
    setPage(1);
  };

  const invoiceList = invoices?.results ?? [];

  return (
    <PermissionGuard permission="can_view_billing">
      <div className="space-y-6 md:space-y-8 pb-12">
        {/* Header */}
        <PageHeader
          title="الفواتير والمدفوعات"
          description="إدارة الشؤون المالية وتتبع الإيرادات بدقة."
          icon={CreditCard}
        >
          {canManageBilling && (
            <Link
              href="/dashboard/billing/plans"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/[0.08] transition-all active:scale-95 touch-target"
            >
              <Sparkles className="w-4 h-4 text-primary" aria-hidden="true" />
              <span className="hidden xs:inline">إدارة الباقات</span>
            </Link>
          )}
          <button
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/[0.08] transition-all active:scale-95 touch-target"
            aria-label="تصدير البيانات"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span className="hidden xs:inline">تصدير</span>
          </button>
          {canCreateInvoice && (
            <Link
              href="/dashboard/billing/new"
              className="flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl gradient-brand text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.05] active:scale-95 transition-all touch-target"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>فاتورة جديدة</span>
            </Link>
          )}
        </PageHeader>

        {/* Financial Section Navigation Tabs */}
        <div className="flex border-b border-border/40 gap-1 pb-px overflow-x-auto custom-scrollbar">
          {[
            { id: "invoices", label: "الفواتير والمقبوضات (المدخلات)" },
            { id: "expenses", label: "المصروفات والمدفوعات (المخرجات)" },
            { id: "cash-flow", label: "قائمة التدفقات والأرباح (P&L)" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveMainTab(tab.id as any)}
              className={cn(
                "px-5 py-3 text-xs font-black uppercase tracking-wider relative transition-all whitespace-nowrap border-b-2 border-transparent",
                activeMainTab === tab.id
                  ? "text-primary border-primary"
                  : "text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeMainTab === "invoices" && (
          <div className="space-y-6 md:space-y-8">
            {/* Period & Context Filter Bar */}
            <PeriodFilterBar
              period={period}
              onPeriodChange={(p) => { setPeriod(p); setPage(1); }}
          startDate={startDate}
          onStartDateChange={(d) => { setStartDate(d); setPage(1); }}
          endDate={endDate}
          onEndDateChange={(d) => { setEndDate(d); setPage(1); }}
          dateBy={dateBy}
          onDateByChange={(b) => { setDateBy(b); setPage(1); }}
          dateByOptions={DATE_BY_OPTIONS}
          locations={locations}
          selectedLocationId={locationId}
          onLocationChange={(loc) => { setLocationId(loc); setPage(1); }}
          plans={plans}
          selectedPlanId={planId}
          onPlanChange={(pl) => { setPlanId(pl); setPage(1); }}
          statuses={STATUS_OPTIONS}
          selectedStatus={statusFilter}
          onStatusChange={(st) => { setStatusFilter(st); setPage(1); }}
          resolvedStartDate={summary?.start_date}
          resolvedEndDate={summary?.end_date}
          isFiltered={isFiltered}
          onReset={handleReset}
        />

        {/* Summary KPI Cards (Responsive to Filters) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
          <StatsCard
            label="المحصل في الفترة"
            value={summary?.total_paid ?? 0}
            icon={CheckCircle}
            color="emerald"
            isCurrency
            currency={summary?.currency || tenantCurrency}
            subtitle={period === "this_month" ? "هذا الشهر" : period === "all" ? "إجمالي كلي" : "حسب الفترة المحددة"}
            loading={isSummaryLoading}
          />
          <StatsCard
            label="إجمالي معلق"
            value={summary?.total_pending ?? 0}
            icon={Clock}
            color="amber"
            isCurrency
            currency={summary?.currency || tenantCurrency}
            subtitle="بانتظار التحصيل"
            loading={isSummaryLoading}
          />
          <StatsCard
            label="متأخرات"
            value={summary?.total_overdue ?? 0}
            icon={AlertTriangle}
            color="red"
            badge={summary?.overdue_count}
            isCurrency
            currency={summary?.currency || tenantCurrency}
            subtitle="تجاوزت تاريخ الاستحقاق"
            loading={isSummaryLoading}
          />
          <StatsCard
            label="إجمالي المفوتر"
            value={summary?.total_invoiced ?? 0}
            icon={TrendingUp}
            color="primary"
            isCurrency
            currency={summary?.currency || tenantCurrency}
            subtitle={summary?.collection_rate !== undefined ? `نسبة التحصيل: ${summary.collection_rate}%` : undefined}
            loading={isSummaryLoading}
          />
        </div>

        {/* Search Bar */}
        <div className="relative group">
          <Search
            className="absolute end-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="البحث باسم الطالب، رقم الفاتورة، أو رقم الهاتف..."
            className="w-full pe-11 ps-4 py-3 rounded-xl bg-white/5 border border-white/5 focus:border-primary/50 focus:bg-white/10 focus:outline-none text-sm font-bold text-white transition-all placeholder:text-muted-foreground/50"
            aria-label="البحث في الفواتير"
          />
        </div>

        <InvoicesList
          invoices={invoices?.results ?? []}
          isLoading={isLoading}
          canMarkPaid={canMarkInvoicePaid}
          pagination={{
            page,
            totalPages: invoices?.total_pages ?? 1,
            totalCount: invoices?.count ?? 0,
            onPageChange: (newPage) => setPage(newPage),
          }}
        />
      </div>
      )}

      {activeMainTab === "expenses" && <ExpensesTab locations={locations || []} />}
      {activeMainTab === "cash-flow" && <CashFlowTab locations={locations || []} />}
    </div>
    </PermissionGuard>
  );
}
