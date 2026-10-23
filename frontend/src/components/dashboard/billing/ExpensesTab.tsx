"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import {
  DollarSign, Plus, Loader2, CheckCircle2, XCircle, ArrowUpRight,
  Receipt, Building2, Calendar, FileText, Check, Trash2, Eye,
  AlertCircle, Tag, WalletCards
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { useTenant } from "@/lib/providers/tenant-provider";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { PeriodFilterBar } from "@/components/dashboard/PeriodFilterBar";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { FormField, Input, ErrorBanner } from "@/components/ui/form-field";
import type { Expense, ExpenseCategory, ExpenseSummary, PaginatedResponse, Location } from "@/types";

function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full px-4 py-3 rounded-xl text-sm font-medium bg-background/50 border border-border/80 text-foreground focus:outline-none focus:ring-4 focus:ring-primary/15 focus:border-primary hover:border-primary/30 transition-all duration-300 disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

const EXPENSE_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "مسودة", color: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  pending: { label: "قيد الاعتماد", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  approved: { label: "معتمد (غير مدفوع)", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  paid: { label: "مدفوع ومصروف", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  cancelled: { label: "ملغي", color: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "نقداً (صندوق الكاش)",
  bank_transfer: "تحويل بنكي",
  card: "بطاقة دفع / مدى",
  check: "شيك مصرفي",
  other: "طريقة أخرى",
};

interface ExpensesTabProps {
  locations?: Location[];
}

export function ExpensesTab({ locations = [] }: ExpensesTabProps) {
  const queryClient = useQueryClient();
  const { tenant } = useTenant();
  const tenantCurrency = tenant?.default_currency || "JOD";

  // Filter States
  const [period, setPeriod] = useState("this_month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedExpenseForView, setSelectedExpenseForView] = useState<Expense | null>(null);
  const [payingExpense, setPayingExpense] = useState<Expense | null>(null);
  const [payForm, setPayForm] = useState({ payment_method: "bank_transfer", payment_reference: "" });

  // Create Form State
  const initialForm = {
    title: "",
    category: "",
    location: "",
    vendor_name: "",
    vendor_tax_number: "",
    invoice_reference: "",
    amount: "",
    tax_rate: "0",
    tax_amount: "0.00",
    total_amount: "0.00",
    currency: tenantCurrency,
    payment_method: "bank_transfer",
    payment_reference: "",
    expense_date: new Date().toISOString().split("T")[0],
    status: "paid",
    receipt_url: "",
    notes: "",
  };
  const [createForm, setCreateForm] = useState(initialForm);

  // Queries
  const { data: categories } = useQuery<ExpenseCategory[]>({
    queryKey: ["billing", "expense-categories"],
    queryFn: () => api.billing.expenseCategories.list().then((r: any) => r.data.results || r.data),
  });

  const queryParams = {
    period: period || undefined,
    start_date: period === "custom" && startDate ? startDate : undefined,
    end_date: period === "custom" && endDate ? endDate : undefined,
    category_id: categoryId ? Number(categoryId) : undefined,
    location_id: locationId ? Number(locationId) : undefined,
    status: statusFilter || undefined,
    search: search || undefined,
    page,
  };

  const { data: expensesData, isLoading } = useQuery<PaginatedResponse<Expense>>({
    queryKey: ["billing", "expenses", queryParams],
    queryFn: () => api.billing.expenses.list(queryParams).then((r: any) => r.data),
  });

  const summaryParams = {
    period: period || undefined,
    start_date: period === "custom" && startDate ? startDate : undefined,
    end_date: period === "custom" && endDate ? endDate : undefined,
    location_id: locationId ? Number(locationId) : undefined,
    category_id: categoryId ? Number(categoryId) : undefined,
  };

  const { data: summary } = useQuery<ExpenseSummary>({
    queryKey: ["billing", "expenses-summary", summaryParams],
    queryFn: () => api.billing.expenses.summary(summaryParams).then((r: any) => r.data),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => api.billing.expenses.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "expenses"] });
      queryClient.invalidateQueries({ queryKey: ["billing", "expenses-summary"] });
      queryClient.invalidateQueries({ queryKey: ["billing", "cash-flow"] });
      setShowCreateModal(false);
      setCreateForm(initialForm);
      toast.success("تم تسجيل المصروف بنجاح ✓");
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || "فشل تسجيل المصروف";
      toast.error(msg);
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => api.billing.expenses.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "expenses"] });
      queryClient.invalidateQueries({ queryKey: ["billing", "expenses-summary"] });
      toast.success("تم اعتماد المصروف بنجاح");
    },
    onError: () => toast.error("تعذر اعتماد المصروف"),
  });

  const markPaidMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.billing.expenses.markPaid(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "expenses"] });
      queryClient.invalidateQueries({ queryKey: ["billing", "expenses-summary"] });
      queryClient.invalidateQueries({ queryKey: ["billing", "cash-flow"] });
      setPayingExpense(null);
      toast.success("تم تأكيد دفع وصرف المصروف بنجاح ✓");
    },
    onError: () => toast.error("تعذر تسجيل الدفع"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.billing.expenses.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "expenses"] });
      queryClient.invalidateQueries({ queryKey: ["billing", "expenses-summary"] });
      queryClient.invalidateQueries({ queryKey: ["billing", "cash-flow"] });
      toast.success("تم حذف المصروف بنجاح");
    },
    onError: () => toast.error("تعذر حذف المصروف"),
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.title || !createForm.category || !createForm.amount) {
      toast.error("يرجى ملء جميع الحقول الإلزامية");
      return;
    }

    createMutation.mutate({
      ...createForm,
      category: Number(createForm.category),
      location: createForm.location ? Number(createForm.location) : null,
      amount: parseFloat(createForm.amount),
      tax_rate: parseFloat(createForm.tax_rate) || 0,
      tax_amount: parseFloat(createForm.tax_amount) || 0,
      total_amount: parseFloat(createForm.total_amount) || parseFloat(createForm.amount),
    });
  };

  const handleAmountChange = (amtStr: string, taxRateStr: string) => {
    const amt = parseFloat(amtStr) || 0;
    const rate = parseFloat(taxRateStr) || 0;
    const tax = amt * (rate / 100);
    const total = amt + tax;
    setCreateForm((prev) => ({
      ...prev,
      amount: amtStr,
      tax_rate: taxRateStr,
      tax_amount: tax.toFixed(2),
      total_amount: total.toFixed(2),
    }));
  };

  const topCategory = summary?.category_breakdown?.[0];
  const expensesList = expensesData?.results || [];

  return (
    <div className="space-y-6">
      {/* KPI Header Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          label="إجمالي المصروفات المدفوعة"
          value={formatCurrency(summary?.total_paid ?? 0, tenantCurrency)}
          subtitle={`${summary?.count_paid ?? 0} عملية دفع معتمدة`}
          icon={ArrowUpRight}
          color="emerald"
        />
        <StatsCard
          label="ضريبة القيمة المضافة (VAT)"
          value={formatCurrency(summary?.total_tax_paid ?? 0, tenantCurrency)}
          subtitle="ضرائب مسددة مستردة للمصروفات"
          icon={Receipt}
          color="blue"
        />
        <StatsCard
          label="قيد الاعتماد والمراجعة"
          value={formatCurrency(summary?.total_pending ?? 0, tenantCurrency)}
          subtitle={`${summary?.count_pending ?? 0} مصروفات معلقة`}
          icon={AlertCircle}
          color="amber"
        />
        <StatsCard
          label="أكبر بنود الصرف"
          value={topCategory ? topCategory.category_name : "—"}
          subtitle={
            topCategory
              ? `${formatCurrency(topCategory.total, tenantCurrency)} (${topCategory.pct}%)`
              : "لا توجد مصروفات مسجلة"
          }
          icon={Tag}
          color="primary"
        />
      </div>

      {/* Period & Filter Control Bar */}
      <PeriodFilterBar
        period={period}
        startDate={startDate}
        endDate={endDate}
        onPeriodChange={(p) => {
          setPeriod(p);
          setPage(1);
        }}
        onStartDateChange={(d) => {
          setStartDate(d);
          setPage(1);
        }}
        onEndDateChange={(d) => {
          setEndDate(d);
          setPage(1);
        }}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Category Filter */}
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-xs text-foreground font-bold focus:outline-none"
            >
              <option value="">جميع التصنيفات</option>
              {(categories || []).map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>

            {/* Location / Branch Filter */}
            {locations.length > 0 && (
              <select
                value={locationId}
                onChange={(e) => {
                  setLocationId(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-xs text-foreground font-bold focus:outline-none"
              >
                <option value="">جميع الفروع (مراكز التكلفة)</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            )}

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-xs text-foreground font-bold focus:outline-none"
            >
              <option value="">جميع الحالات</option>
              <option value="paid">مدفوع</option>
              <option value="pending">قيد الاعتماد</option>
              <option value="approved">معتمد (غير مدفوع)</option>
              <option value="draft">مسودة</option>
            </select>

            {/* New Expense Button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-brand text-white text-xs font-black uppercase tracking-wider hover:scale-[1.03] transition-all shadow-lg shadow-primary/20"
            >
              <Plus className="w-4 h-4" />
              تسجيل مصروف
            </button>
          </div>
        }
      />

      {/* Expenses Table */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-lg text-foreground">سجل المصروفات والمخرجات المالية</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              متابعة جميع نفقات الأكاديمية وفواتير الموردين والمرافق وتوزيعها حسب مراكز التكلفة.
            </p>
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-secondary/50">
              <tr>
                <th className="px-4 py-3 rounded-s-lg text-start">رقم المصروف / البيان</th>
                <th className="px-4 py-3 text-start">التصنيف</th>
                <th className="px-4 py-3 text-start">الفرع (مركز التكلفة)</th>
                <th className="px-4 py-3 text-start">المورد / الجهة المستلمة</th>
                <th className="px-4 py-3 text-start">تاريخ الصرف</th>
                <th className="px-4 py-3 text-start">طريقة الدفع</th>
                <th className="px-4 py-3 text-start">الحالة</th>
                <th className="px-4 py-3 text-start">المبلغ الإجمالي</th>
                <th className="px-4 py-3 rounded-e-lg text-end">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {isLoading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={9} className="py-4 px-4">
                      <div className="h-6 bg-secondary/40 rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : expensesList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                    لا توجد مصروفات مسجلة لهذه الفترة. اضغط على زر &quot;تسجيل مصروف&quot; لإضافة أول قيد!
                  </td>
                </tr>
              ) : (
                expensesList.map((exp) => (
                  <tr key={exp.id} className="hover:bg-secondary/10 transition-colors">
                    {/* Number & Title */}
                    <td className="px-4 py-4">
                      <div className="font-black text-foreground">{exp.title}</div>
                      <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        {exp.expense_number} {exp.invoice_reference && `• فاتورة: ${exp.invoice_reference}`}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/5 border border-white/10 text-foreground">
                        <Tag className="w-3 h-3 text-primary" />
                        {exp.category_name}
                      </span>
                    </td>

                    {/* Location */}
                    <td className="px-4 py-4 text-xs font-semibold text-muted-foreground">
                      {exp.location_name ? (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-primary" />
                          {exp.location_name}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>

                    {/* Vendor */}
                    <td className="px-4 py-4">
                      <div className="text-xs font-bold text-foreground">{exp.vendor_name || "—"}</div>
                      {exp.vendor_tax_number && (
                        <div className="text-[10px] text-muted-foreground">ض.ق.م: {exp.vendor_tax_number}</div>
                      )}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-4 text-xs font-bold text-muted-foreground whitespace-nowrap">
                      {formatDate(exp.expense_date)}
                    </td>

                    {/* Payment Method */}
                    <td className="px-4 py-4 text-xs font-semibold text-muted-foreground">
                      {PAYMENT_METHOD_LABELS[exp.payment_method] || exp.payment_method}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4">
                      <span
                        className={cn(
                          "px-2.5 py-1 rounded-full border text-[11px] font-black whitespace-nowrap",
                          EXPENSE_STATUS_LABELS[exp.status]?.color
                        )}
                      >
                        {EXPENSE_STATUS_LABELS[exp.status]?.label || exp.status}
                      </span>
                    </td>

                    {/* Total Amount */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="font-black text-foreground">
                        {formatCurrency(exp.total_amount, exp.currency)}
                      </div>
                      {Number(exp.tax_amount) > 0 && (
                        <div className="text-[10px] text-muted-foreground">
                          شامل ضريبة {formatCurrency(exp.tax_amount, exp.currency)}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-4 text-end">
                      <div className="flex items-center justify-end gap-1.5">
                        {exp.status === "pending" && (
                          <button
                            onClick={() => approveMutation.mutate(exp.id)}
                            disabled={approveMutation.isPending}
                            title="اعتماد المصروف"
                            className="p-1.5 rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {exp.status === "approved" && (
                          <button
                            onClick={() => {
                              setPayingExpense(exp);
                              setPayForm({
                                payment_method: exp.payment_method || "bank_transfer",
                                payment_reference: "",
                              });
                            }}
                            title="تسجيل الدفع والصرف"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white text-xs font-bold transition-all"
                          >
                            <WalletCards className="w-3 h-3" />
                            دفع
                          </button>
                        )}

                        {exp.receipt_url && (
                          <a
                            href={exp.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="عرض الإيصال / الفاتورة المرفقة"
                            className="p-1.5 rounded-lg border border-white/10 hover:bg-white/10 text-muted-foreground transition-all"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </a>
                        )}

                        <button
                          onClick={() => {
                            if (confirm(`هل أنت متأكد من حذف المصروف (${exp.title})؟`)) {
                              deleteMutation.mutate(exp.id);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          title="حذف"
                          className="p-1.5 rounded-lg border border-rose-500/20 bg-rose-500/5 text-rose-400 hover:bg-rose-500 hover:text-white transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="block md:hidden space-y-3">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>
          ) : expensesList.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">لا توجد مصروفات مسجلة لهذه الفترة.</div>
          ) : (
            expensesList.map((exp) => (
              <div key={exp.id} className="p-4 rounded-xl border border-white/10 bg-white/5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-foreground text-sm">{exp.title}</h3>
                    <div className="text-[10px] text-muted-foreground font-mono">{exp.expense_number}</div>
                  </div>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full border text-[10px] font-bold",
                      EXPENSE_STATUS_LABELS[exp.status]?.color
                    )}
                  >
                    {EXPENSE_STATUS_LABELS[exp.status]?.label}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-muted-foreground/60">التصنيف</span>
                    <span className="font-semibold text-foreground">{exp.category_name}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-muted-foreground/60">المبلغ الإجمالي</span>
                    <span className="font-black text-foreground">
                      {formatCurrency(exp.total_amount, exp.currency)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-muted-foreground/60">التاريخ</span>
                    <span>{formatDate(exp.expense_date)}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-muted-foreground/60">المورد</span>
                    <span>{exp.vendor_name || "—"}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                  {exp.status === "approved" && (
                    <button
                      onClick={() => setPayingExpense(exp)}
                      className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold"
                    >
                      تسجيل الدفع
                    </button>
                  )}
                  {exp.status === "pending" && (
                    <button
                      onClick={() => approveMutation.mutate(exp.id)}
                      className="px-3 py-1 rounded-lg bg-blue-600 text-white text-xs font-bold"
                    >
                      اعتماد
                    </button>
                  )}
                  {exp.receipt_url && (
                    <a
                      href={exp.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 rounded-lg border border-white/10 text-xs font-bold"
                    >
                      الإيصال
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Record New Expense Modal */}
      {showCreateModal && (
        <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} size="lg">
          <ModalHeader
            icon={<Receipt className="w-5 h-5 text-primary" />}
            title="تسجيل مصروف / سند صرف جديد"
            subtitle="توثيق مصروف تشغيلي أو فاتورة مورد مع إسناد مركز التكلفة والضريبة"
            onClose={() => setShowCreateModal(false)}
          />
          <form onSubmit={handleCreateSubmit} className="flex flex-col flex-1 min-h-0">
            <ModalBody className="space-y-4">
              <FormField label="بيان المصروف / الغرض" required>
                <Input
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  placeholder="مثال: فاتورة كهرباء شهر 10، شراء بساط تايكوندو، صيانة أجهزة التكييف"
                  required
                />
              </FormField>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField label="تصنيف المصروف" required>
                  <Select
                    value={createForm.category}
                    onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                    required
                  >
                    <option value="">اختر التصنيف المحاسبي...</option>
                    {(categories || []).map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField label="الفرع (مركز التكلفة)">
                  <Select
                    value={createForm.location}
                    onChange={(e) => setCreateForm({ ...createForm, location: e.target.value })}
                  >
                    <option value="">عام / كامل الأكاديمية</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>

              {/* Vendor & Invoice Ref */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <FormField label="اسم المورد / المستفيد">
                  <Input
                    value={createForm.vendor_name}
                    onChange={(e) => setCreateForm({ ...createForm, vendor_name: e.target.value })}
                    placeholder="مثال: شركة الكهرباء، المالك، متجر الرياضة"
                  />
                </FormField>

                <FormField label="الرقم الضريبي للمورد">
                  <Input
                    value={createForm.vendor_tax_number}
                    onChange={(e) => setCreateForm({ ...createForm, vendor_tax_number: e.target.value })}
                    placeholder="الرقم الضريبي VAT"
                  />
                </FormField>

                <FormField label="رقم فاتورة المورد">
                  <Input
                    value={createForm.invoice_reference}
                    onChange={(e) => setCreateForm({ ...createForm, invoice_reference: e.target.value })}
                    placeholder="رقم الفاتورة الأصلية"
                  />
                </FormField>
              </div>

              {/* Amounts & Taxes */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                <FormField label="المبلغ الصافي (قبل الضريبة)" required>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={createForm.amount}
                    onChange={(e) => handleAmountChange(e.target.value, createForm.tax_rate)}
                    placeholder="0.00"
                    required
                  />
                </FormField>

                <FormField label="نسبة الضريبة (%)">
                  <Select
                    value={createForm.tax_rate}
                    onChange={(e) => handleAmountChange(createForm.amount, e.target.value)}
                  >
                    <option value="0">0% (معفى من الضريبة)</option>
                    <option value="16">16% (ضريبة المبيعات الأردنية)</option>
                    <option value="15">15% (ضريبة القيمة المضافة السعودية)</option>
                    <option value="5">5% (ضريبة الإمارات)</option>
                  </Select>
                </FormField>

                <FormField label="قيمة الضريبة">
                  <Input value={createForm.tax_amount} readOnly className="bg-secondary/20 text-muted-foreground" />
                </FormField>

                <FormField label="المبلغ الإجمالي النهائي">
                  <Input
                    value={createForm.total_amount}
                    readOnly
                    className="bg-primary/10 border-primary/30 text-primary font-black"
                  />
                </FormField>
              </div>

              {/* Payment Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <FormField label="طريقة الدفع" required>
                  <Select
                    value={createForm.payment_method}
                    onChange={(e) => setCreateForm({ ...createForm, payment_method: e.target.value })}
                  >
                    <option value="bank_transfer">تحويل بنكي</option>
                    <option value="cash">نقداً (صندوق الكاش)</option>
                    <option value="card">بطاقة دفع / مدى</option>
                    <option value="check">شيك مصرفي</option>
                    <option value="other">أخرى</option>
                  </Select>
                </FormField>

                <FormField label="رقم السند / الشيك / الحوالة">
                  <Input
                    value={createForm.payment_reference}
                    onChange={(e) => setCreateForm({ ...createForm, payment_reference: e.target.value })}
                    placeholder="رقم مرجع التحويل أو الشيك"
                  />
                </FormField>

                <FormField label="تاريخ الصرف" required>
                  <Input
                    type="date"
                    value={createForm.expense_date}
                    onChange={(e) => setCreateForm({ ...createForm, expense_date: e.target.value })}
                    required
                  />
                </FormField>
              </div>

              {/* Status & Attachment */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField label="حالة المصروف">
                  <Select
                    value={createForm.status}
                    onChange={(e) => setCreateForm({ ...createForm, status: e.target.value })}
                  >
                    <option value="paid">مدفوع ومصروف فوراً</option>
                    <option value="pending">قيد الاعتماد والمراجعة</option>
                    <option value="approved">معتمد (بانتظار الصرف لاحقاً)</option>
                    <option value="draft">مسودة</option>
                  </Select>
                </FormField>

                <FormField label="رابط صورة الفاتورة / الإيصال">
                  <Input
                    value={createForm.receipt_url}
                    onChange={(e) => setCreateForm({ ...createForm, receipt_url: e.target.value })}
                    placeholder="https://... رابط المستند أو الإيصال المرفوع"
                  />
                </FormField>
              </div>

              <FormField label="ملاحظات محاسبية إضافية">
                <Input
                  value={createForm.notes}
                  onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                  placeholder="أي تفاصيل أو بنود مرتبطة بالصرف..."
                />
              </FormField>
            </ModalBody>
            <ModalFooter>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="px-5 py-2.5 rounded-xl gradient-brand text-white text-xs font-black uppercase tracking-wider hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                حفظ وتسجيل المصروف
              </button>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* Mark As Paid Modal */}
      {payingExpense && (
        <Modal open={!!payingExpense} onClose={() => setPayingExpense(null)} size="md">
          <ModalHeader
            icon={<WalletCards className="w-5 h-5 text-emerald-400" />}
            title="تسجيل دفع المصروف"
            subtitle={`تأكيد خروج مبلغ ${formatCurrency(payingExpense.total_amount, payingExpense.currency)} من الحساب`}
            onClose={() => setPayingExpense(null)}
          />
          <div className="p-6 space-y-4">
            <FormField label="طريقة الدفع" required>
              <Select
                value={payForm.payment_method}
                onChange={(e) => setPayForm({ ...payForm, payment_method: e.target.value })}
              >
                <option value="bank_transfer">تحويل بنكي</option>
                <option value="cash">نقداً (صندوق الكاش)</option>
                <option value="card">بطاقة دفع</option>
                <option value="check">شيك مصرفي</option>
              </Select>
            </FormField>

            <FormField label="رقم المرجع / الحوالة / الشيك">
              <Input
                value={payForm.payment_reference}
                onChange={(e) => setPayForm({ ...payForm, payment_reference: e.target.value })}
                placeholder="رقم العملية البنكية أو رقم الشيك..."
              />
            </FormField>

            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={() => setPayingExpense(null)}
                className="px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() =>
                  markPaidMutation.mutate({
                    id: payingExpense.id,
                    data: payForm,
                  })
                }
                disabled={markPaidMutation.isPending}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2"
              >
                {markPaidMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                تأكيد الصرف
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
