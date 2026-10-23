"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import {
  Coins, Plus, Loader2, CheckCircle2, XCircle, HandCoins,
  History, DollarSign, Calendar, AlertCircle, Clock, Trash2, ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { useTenant } from "@/lib/providers/tenant-provider";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { PeriodFilterBar } from "@/components/dashboard/PeriodFilterBar";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { FormField, Input, ErrorBanner } from "@/components/ui/form-field";
import type { StaffAdvance, StaffAdvanceRepayment, StaffAdvanceSummary, PaginatedResponse } from "@/types";

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

const ADVANCE_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "قيد الانتظار", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  approved: { label: "معتمدة", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  disbursed: { label: "مصروفة (نشطة)", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  repaid: { label: "مسددة بالكامل", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  rejected: { label: "مرفوضة", color: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
  cancelled: { label: "ملغاة", color: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
};

const STATUS_FILTER_OPTIONS = [
  { value: "pending", label: "قيد الانتظار" },
  { value: "approved", label: "معتمدة" },
  { value: "disbursed", label: "مصروفة (نشطة)" },
  { value: "repaid", label: "مسددة بالكامل" },
  { value: "rejected", label: "مرفوضة" },
];

export function AdvancesTab() {
  const queryClient = useQueryClient();
  const { tenant } = useTenant();
  const tenantCurrency = tenant?.default_currency || "JOD";

  // Filter states
  const [period, setPeriod] = useState("this_month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [staffFilter, setStaffFilter] = useState("");

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [rejectingAdvance, setRejectingAdvance] = useState<StaffAdvance | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [disbursingAdvance, setDisbursingAdvance] = useState<StaffAdvance | null>(null);
  const [disbursementNote, setDisbursementNote] = useState("");
  const [repayingAdvance, setRepayingAdvance] = useState<StaffAdvance | null>(null);
  const [repaymentForm, setRepaymentForm] = useState({ amount: "", method: "cash", notes: "" });
  const [historyAdvance, setHistoryAdvance] = useState<StaffAdvance | null>(null);

  // Create form state
  const [createForm, setCreateForm] = useState({
    staff_member: "",
    amount: "",
    currency: tenantCurrency,
    repayment_type: "single",
    installments_count: "2",
    monthly_installment: "",
    reason: "",
    notes: "",
  });

  // Queries
  const { data: salaryConfigs } = useQuery<any[]>({
    queryKey: ["staff", "salary-configs"],
    queryFn: () => api.staff.salaryConfigs.list().then((r: any) => r.data.results || r.data),
  });

  const summaryParams = {
    period: period || undefined,
    start_date: period === "custom" && startDate ? startDate : undefined,
    end_date: period === "custom" && endDate ? endDate : undefined,
    status: statusFilter || undefined,
    staff_member: staffFilter || undefined,
  };

  const { data: summary, isLoading: loadingSummary } = useQuery<StaffAdvanceSummary>({
    queryKey: ["staff", "advances", "summary", summaryParams],
    queryFn: () => api.staff.advances.summary(summaryParams).then((r: any) => r.data),
  });

  const listParams = {
    period: period || undefined,
    start_date: period === "custom" && startDate ? startDate : undefined,
    end_date: period === "custom" && endDate ? endDate : undefined,
    status: statusFilter || undefined,
    staff_member: staffFilter || undefined,
  };

  const { data: advancesData, isLoading: loadingList } = useQuery<PaginatedResponse<StaffAdvance> | StaffAdvance[]>({
    queryKey: ["staff", "advances", listParams],
    queryFn: () => api.staff.advances.list(listParams).then((r: any) => r.data),
  });

  const advancesList: StaffAdvance[] = Array.isArray(advancesData)
    ? advancesData
    : advancesData?.results || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => api.staff.advances.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "advances"] });
      setShowCreateModal(false);
      setCreateForm({
        staff_member: "",
        amount: "",
        currency: tenantCurrency,
        repayment_type: "single",
        installments_count: "2",
        monthly_installment: "",
        reason: "",
        notes: "",
      });
      toast.success("تم تقديم طلب السلفة بنجاح");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "فشل تقديم طلب السلفة");
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => api.staff.advances.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "advances"] });
      toast.success("تم اعتماد السلفة بنجاح");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "فشل اعتماد السلفة"),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      api.staff.advances.reject(id, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "advances"] });
      setRejectingAdvance(null);
      setRejectionReason("");
      toast.success("تم رفض طلب السلفة");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "فشل رفض السلفة"),
  });

  const disburseMutation = useMutation({
    mutationFn: ({ id, note }: { id: number; note: string }) =>
      api.staff.advances.disburse(id, { note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "advances"] });
      setDisbursingAdvance(null);
      setDisbursementNote("");
      toast.success("تم تسجيل صرف السلفة للموظف بنجاح");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "فشل صرف السلفة"),
  });

  const repayMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      api.staff.advances.recordRepayment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "advances"] });
      setRepayingAdvance(null);
      setRepaymentForm({ amount: "", method: "cash", notes: "" });
      toast.success("تم تسجيل السداد بنجاح");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "فشل تسجيل السداد"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.staff.advances.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "advances"] });
      toast.success("تم حذف طلب السلفة");
    },
    onError: () => toast.error("تعذر حذف السلفة"),
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.staff_member || !createForm.amount) {
      toast.error("يرجى ملء جميع الحقول الإلزامية");
      return;
    }
    const payload = {
      staff_member: Number(createForm.staff_member),
      amount: parseFloat(createForm.amount),
      currency: createForm.currency,
      repayment_type: createForm.repayment_type,
      installments_count: createForm.repayment_type === "installment" ? Number(createForm.installments_count) : 1,
      monthly_installment: createForm.repayment_type === "installment" && createForm.monthly_installment ? parseFloat(createForm.monthly_installment) : undefined,
      reason: createForm.reason,
      notes: createForm.notes,
    };
    createMutation.mutate(payload);
  };

  const isFiltered = period !== "this_month" || !!startDate || !!endDate || !!statusFilter || !!staffFilter;
  const handleResetFilters = () => {
    setPeriod("this_month");
    setStartDate("");
    setEndDate("");
    setStatusFilter("");
    setStaffFilter("");
  };

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-400" />
            نظام سلف الموظفين
          </h2>
          <p className="text-xs text-muted-foreground font-bold mt-1">
            إدارة طلبات السلف، اعتمادها، صرفها، وجدولة الاستقطاع المالي التلقائي من مسيرات الرواتب.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl gradient-brand text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          طلب سلفة جديدة
        </button>
      </div>

      {/* Period & Filter Toolbar */}
      <PeriodFilterBar
        period={period}
        onPeriodChange={setPeriod}
        startDate={startDate}
        onStartDateChange={setStartDate}
        endDate={endDate}
        onEndDateChange={setEndDate}
        statuses={STATUS_FILTER_OPTIONS}
        selectedStatus={statusFilter}
        onStatusChange={setStatusFilter}
        resolvedStartDate={summary?.start_date}
        resolvedEndDate={summary?.end_date}
        isFiltered={isFiltered}
        onReset={handleResetFilters}
      />

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        <StatsCard
          label="إجمالي السلف النشطة (القائمة)"
          value={summary?.total_active_advances ?? 0}
          icon={Coins}
          color="amber"
          isCurrency
          currency={summary?.currency || tenantCurrency}
          subtitle="مبالغ لم تسدد بعد"
          loading={loadingSummary}
        />
        <StatsCard
          label="المصروف في الفترة"
          value={summary?.total_disbursed_in_period ?? 0}
          icon={DollarSign}
          color="primary"
          isCurrency
          currency={summary?.currency || tenantCurrency}
          subtitle="سلف تم صرفها للموظفين"
          loading={loadingSummary}
        />
        <StatsCard
          label="المسدد في الفترة"
          value={summary?.total_repaid_in_period ?? 0}
          icon={CheckCircle2}
          color="emerald"
          isCurrency
          currency={summary?.currency || tenantCurrency}
          subtitle="استقطاعات أو سداد مباشر"
          loading={loadingSummary}
        />
        <StatsCard
          label="طلبات قيد الانتظار"
          value={summary?.pending_count ?? 0}
          icon={Clock}
          color="red"
          badge={summary?.pending_count}
          subtitle="بانتظار قرار الإدارة"
          loading={loadingSummary}
        />
      </div>

      {/* Advances Table / List */}
      <div className="glass-card overflow-hidden">
        {loadingList ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : advancesList.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Coins className="w-10 h-10 text-muted-foreground mx-auto stroke-1" />
            <h3 className="text-sm font-black text-white">لا توجد سلف مسجلة</h3>
            <p className="text-xs text-muted-foreground font-bold">
              لا توجد طلبات سلف تطابق الفلاتر المحددة حالياً.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-white/[0.02] border-b border-white/5 text-muted-foreground uppercase font-black text-[10px] tracking-wider">
                <tr>
                  <th className="py-4 px-4 text-start">الموظف</th>
                  <th className="py-4 px-4 text-start">المبلغ</th>
                  <th className="py-4 px-4 text-start">خطة السداد</th>
                  <th className="py-4 px-4 text-start">المسدد / المتبقي</th>
                  <th className="py-4 px-4 text-start">الحالة</th>
                  <th className="py-4 px-4 text-start">تاريخ الطلب</th>
                  <th className="py-4 px-4 text-end">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {advancesList.map((adv) => {
                  const statusInfo = ADVANCE_STATUS_LABELS[adv.status] || { label: adv.status, color: "bg-white/5 text-white" };
                  return (
                    <tr key={adv.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 px-4 text-start">
                        <div className="font-black text-white">{adv.staff_name}</div>
                        <div className="text-[10px] text-muted-foreground">{adv.staff_email}</div>
                      </td>
                      <td className="py-4 px-4 text-start">
                        <span className="font-black text-white text-sm" dir="ltr">
                          {formatCurrency(adv.amount, adv.currency)}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-start">
                        {adv.repayment_type === "installment" ? (
                          <div className="space-y-0.5">
                            <span className="inline-block px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-bold">
                              أقساط ({adv.installments_count} أشهر)
                            </span>
                            <div className="text-[10px] text-muted-foreground font-bold">
                              {formatCurrency(adv.monthly_installment, adv.currency)} / شهرياً
                            </div>
                          </div>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded bg-slate-500/10 text-slate-300 text-[10px] font-bold">
                            دفعة واحدة من الراتب
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-start">
                        <div className="font-bold text-white text-xs" dir="ltr">
                          {formatCurrency(adv.total_repaid, adv.currency)} / {formatCurrency(adv.amount, adv.currency)}
                        </div>
                        <div className="text-[10px] text-amber-400 font-bold">
                          المتبقي: {formatCurrency(adv.remaining_amount, adv.currency)}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-start">
                        <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider inline-block", statusInfo.color)}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-start text-muted-foreground font-bold">
                        {formatDate(adv.request_date)}
                      </td>
                      <td className="py-4 px-4 text-end">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Approve / Reject buttons for pending */}
                          {adv.status === "pending" && (
                            <>
                              <button
                                onClick={() => approveMutation.mutate(adv.id)}
                                disabled={approveMutation.isPending}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white text-[10px] font-black transition-all active:scale-95"
                                title="اعتماد السلفة"
                              >
                                اعتماد
                              </button>
                              <button
                                onClick={() => setRejectingAdvance(adv)}
                                className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white text-[10px] font-black transition-all active:scale-95"
                                title="رفض السلفة"
                              >
                                رفض
                              </button>
                            </>
                          )}

                          {/* Disburse button for approved */}
                          {adv.status === "approved" && (
                            <button
                              onClick={() => setDisbursingAdvance(adv)}
                              className="px-2.5 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500 hover:text-white text-[10px] font-black transition-all active:scale-95 flex items-center gap-1"
                              title="تسجيل صرف السلفة للموظف"
                            >
                              <HandCoins className="w-3 h-3" />
                              صرف
                            </button>
                          )}

                          {/* Record direct payment for disbursed */}
                          {adv.status === "disbursed" && adv.remaining_amount > 0 && (
                            <button
                              onClick={() => {
                                setRepayingAdvance(adv);
                                setRepaymentForm({ amount: String(adv.remaining_amount), method: "cash", notes: "" });
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary hover:text-white text-[10px] font-black transition-all active:scale-95 flex items-center gap-1"
                              title="تسجيل سداد يدوي/نقدي مباشر"
                            >
                              <DollarSign className="w-3 h-3" />
                              سداد يدوي
                            </button>
                          )}

                          {/* Repayments History */}
                          <button
                            onClick={() => setHistoryAdvance(adv)}
                            className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-muted-foreground hover:text-white text-[10px] font-black transition-all"
                            title="سجل الحركات والسداد"
                          >
                            <History className="w-3 h-3" />
                          </button>

                          {/* Delete if pending or rejected */}
                          {["pending", "rejected", "cancelled"].includes(adv.status) && (
                            <button
                              onClick={() => {
                                if (confirm("هل أنت متأكد من حذف هذا السجل؟")) {
                                  deleteMutation.mutate(adv.id);
                                }
                              }}
                              className="p-1.5 rounded-lg bg-white/5 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                              title="حذف"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal: Create Advance ── */}
      {showCreateModal && (
        <Modal open onClose={() => setShowCreateModal(false)} size="md">
          <ModalHeader
            icon={<Coins className="w-5 h-5 text-amber-400" />}
            title="طلب سلفة موظف جديدة"
            subtitle="تسجيل سلفة مالية على الراتب وتحديد خطة الاستقطاع"
            onClose={() => setShowCreateModal(false)}
          />
          <form onSubmit={handleCreateSubmit} className="flex flex-col flex-1 min-h-0">
            <ModalBody className="space-y-4">
              <FormField label="الموظف" required>
                <Select
                  value={createForm.staff_member}
                  onChange={(e) => setCreateForm({ ...createForm, staff_member: e.target.value })}
                  required
                >
                  <option value="">اختر الموظف...</option>
                  {(salaryConfigs || []).map((sc: any) => (
                    <option key={sc.staff_member} value={sc.staff_member}>
                      {sc.staff_name} ({sc.staff_role}) — الراتب: {formatCurrency(sc.basic_salary, sc.currency)}
                    </option>
                  ))}
                </Select>
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="مبلغ السلفة المطلوب" required>
                  <Input
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="0.00"
                    value={createForm.amount}
                    onChange={(e) => {
                      const amt = e.target.value;
                      const count = parseInt(createForm.installments_count) || 1;
                      const monthly = amt && count > 0 ? (parseFloat(amt) / count).toFixed(2) : "";
                      setCreateForm({ ...createForm, amount: amt, monthly_installment: monthly });
                    }}
                    required
                  />
                </FormField>

                <FormField label="العملة" required>
                  <Select
                    value={createForm.currency}
                    onChange={(e) => setCreateForm({ ...createForm, currency: e.target.value })}
                  >
                    <option value="JOD">دينار أردني (JOD)</option>
                    <option value="SAR">ريال سعودي (SAR)</option>
                    <option value="AED">درهم إماراتي (AED)</option>
                    <option value="USD">دولار أمريكي (USD)</option>
                  </Select>
                </FormField>
              </div>

              <FormField label="طريقة وخطة السداد" required>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, repayment_type: "single" })}
                    className={cn(
                      "p-3 rounded-xl border text-xs font-bold text-start transition-all",
                      createForm.repayment_type === "single"
                        ? "bg-primary/10 border-primary text-white"
                        : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
                    )}
                  >
                    <div>دفعة واحدة</div>
                    <div className="text-[10px] text-muted-foreground font-normal">خصم كامل المبلغ من أول راتب قادم</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const count = parseInt(createForm.installments_count) || 2;
                      const amt = parseFloat(createForm.amount) || 0;
                      const monthly = amt > 0 ? (amt / count).toFixed(2) : "";
                      setCreateForm({ ...createForm, repayment_type: "installment", monthly_installment: monthly });
                    }}
                    className={cn(
                      "p-3 rounded-xl border text-xs font-bold text-start transition-all",
                      createForm.repayment_type === "installment"
                        ? "bg-primary/10 border-primary text-white"
                        : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
                    )}
                  >
                    <div>أقساط شهرية</div>
                    <div className="text-[10px] text-muted-foreground font-normal">استقطاع شهري مجدول على عدة دفعات</div>
                  </button>
                </div>
              </FormField>

              {createForm.repayment_type === "installment" && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                  <FormField label="عدد الأشهر / الأقساط" required>
                    <Select
                      value={createForm.installments_count}
                      onChange={(e) => {
                        const count = parseInt(e.target.value) || 1;
                        const amt = parseFloat(createForm.amount) || 0;
                        const monthly = amt > 0 ? (amt / count).toFixed(2) : "";
                        setCreateForm({ ...createForm, installments_count: e.target.value, monthly_installment: monthly });
                      }}
                    >
                      <option value="2">شهران (2 قسط)</option>
                      <option value="3">3 أشهر (3 أقساط)</option>
                      <option value="4">4 أشهر (4 أقساط)</option>
                      <option value="5">5 أشهر (5 أقساط)</option>
                      <option value="6">6 أشهر (6 أقساط)</option>
                      <option value="12">12 شهر (سنة كاملة)</option>
                    </Select>
                  </FormField>

                  <FormField label="قيمة القسط الشهري التقريبي">
                    <Input
                      type="number"
                      step="0.01"
                      value={createForm.monthly_installment}
                      onChange={(e) => setCreateForm({ ...createForm, monthly_installment: e.target.value })}
                    />
                  </FormField>
                </div>
              )}

              <FormField label="سبب طلب السلفة">
                <textarea
                  value={createForm.reason}
                  onChange={(e) => setCreateForm({ ...createForm, reason: e.target.value })}
                  placeholder="مثال: ظرف عائلي طارئ، مصاريف علاجية..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white focus:outline-none focus:border-primary/50"
                />
              </FormField>

              <FormField label="ملاحظات إدارية داخلية">
                <Input
                  value={createForm.notes}
                  onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                  placeholder="ملاحظات خاصة بالإدارة..."
                />
              </FormField>
            </ModalBody>
            <ModalFooter>
              <div className="flex gap-3 w-full">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-black uppercase tracking-wider hover:bg-white/10"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 py-3 rounded-xl gradient-brand text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  تقديم الطلب
                </button>
              </div>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* ── Modal: Reject Advance ── */}
      {rejectingAdvance && (
        <Modal open onClose={() => setRejectingAdvance(null)} size="sm">
          <ModalHeader
            icon={<XCircle className="w-5 h-5 text-rose-400" />}
            title="رفض طلب السلفة"
            subtitle={rejectingAdvance.staff_name}
            onClose={() => setRejectingAdvance(null)}
          />
          <div className="p-6 space-y-4">
            <FormField label="سبب الرفض">
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="يرجى كتابة سبب عدم الموافقة على السلفة..."
                rows={3}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white focus:outline-none focus:border-rose-500/50"
              />
            </FormField>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setRejectingAdvance(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 text-xs font-bold text-white hover:bg-white/10"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => rejectMutation.mutate({ id: rejectingAdvance.id, reason: rejectionReason })}
                disabled={rejectMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-all disabled:opacity-50"
              >
                تأكيد الرفض
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal: Disburse Advance ── */}
      {disbursingAdvance && (
        <Modal open onClose={() => setDisbursingAdvance(null)} size="sm">
          <ModalHeader
            icon={<HandCoins className="w-5 h-5 text-purple-400" />}
            title="تسجيل صرف السلفة"
            subtitle={`${disbursingAdvance.staff_name} — ${formatCurrency(disbursingAdvance.amount, disbursingAdvance.currency)}`}
            onClose={() => setDisbursingAdvance(null)}
          />
          <div className="p-6 space-y-4">
            <p className="text-xs text-muted-foreground font-bold">
              تأكيد تسليم المبلغ للموظف (نقداً أو تحويل بنكي). سيتم تفعيل خطة الاستقطاع المالي بدءاً من مسير الرواتب القادم.
            </p>
            <FormField label="ملاحظات الصرف (رقم الحوالة، طريقة الصرف...)">
              <Input
                value={disbursementNote}
                onChange={(e) => setDisbursementNote(e.target.value)}
                placeholder="مثال: نقداً من الصندوق، تحويل بنكي..."
              />
            </FormField>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDisbursingAdvance(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 text-xs font-bold text-white hover:bg-white/10"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => disburseMutation.mutate({ id: disbursingAdvance.id, note: disbursementNote })}
                disabled={disburseMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all disabled:opacity-50"
              >
                تأكيد الصرف
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal: Manual Direct Repayment ── */}
      {repayingAdvance && (
        <Modal open onClose={() => setRepayingAdvance(null)} size="sm">
          <ModalHeader
            icon={<DollarSign className="w-5 h-5 text-primary" />}
            title="تسجيل سداد يدوي مباشر"
            subtitle={`${repayingAdvance.staff_name} — المتبقي: ${formatCurrency(repayingAdvance.remaining_amount, repayingAdvance.currency)}`}
            onClose={() => setRepayingAdvance(null)}
          />
          <div className="p-6 space-y-4">
            <FormField label="المبلغ المسدد" required>
              <Input
                type="number"
                step="0.01"
                max={repayingAdvance.remaining_amount}
                value={repaymentForm.amount}
                onChange={(e) => setRepaymentForm({ ...repaymentForm, amount: e.target.value })}
                required
              />
            </FormField>
            <FormField label="طريقة السداد">
              <Select
                value={repaymentForm.method}
                onChange={(e) => setRepaymentForm({ ...repaymentForm, method: e.target.value })}
              >
                <option value="cash">سداد نقدي مباشر</option>
                <option value="bank_transfer">تحويل بنكي</option>
                <option value="other">أخرى</option>
              </Select>
            </FormField>
            <FormField label="ملاحظات">
              <Input
                value={repaymentForm.notes}
                onChange={(e) => setRepaymentForm({ ...repaymentForm, notes: e.target.value })}
                placeholder="ملاحظات السداد..."
              />
            </FormField>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setRepayingAdvance(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 text-xs font-bold text-white hover:bg-white/10"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => repayMutation.mutate({ id: repayingAdvance.id, data: { amount: parseFloat(repaymentForm.amount), repayment_method: repaymentForm.method, notes: repaymentForm.notes } })}
                disabled={repayMutation.isPending || !repaymentForm.amount}
                className="flex-1 py-2.5 rounded-xl gradient-brand text-white text-xs font-bold transition-all disabled:opacity-50"
              >
                تأكيد السداد
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal: Repayment History ── */}
      {historyAdvance && (
        <Modal open onClose={() => setHistoryAdvance(null)} size="md">
          <ModalHeader
            icon={<History className="w-5 h-5 text-primary" />}
            title="سجل حركات سداد السلفة"
            subtitle={`${historyAdvance.staff_name} — سلفة رقم #${historyAdvance.id}`}
            onClose={() => setHistoryAdvance(null)}
          />
          <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground">إجمالي السلفة:</span>{" "}
                <span className="font-bold text-white">{formatCurrency(historyAdvance.amount, historyAdvance.currency)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">المتبقي للسداد:</span>{" "}
                <span className="font-bold text-amber-400">{formatCurrency(historyAdvance.remaining_amount, historyAdvance.currency)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-black text-white">الدفعات والاستقطاعات المسجلة:</h4>
              {(!historyAdvance.repayments || historyAdvance.repayments.length === 0) ? (
                <p className="text-xs text-muted-foreground p-4 bg-white/5 rounded-xl text-center">
                  لا توجد حركات سداد مسجلة حتى الآن.
                </p>
              ) : (
                historyAdvance.repayments.map((rep) => (
                  <div key={rep.id} className="p-3 bg-white/5 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <div className="font-black text-white">{formatCurrency(rep.amount, historyAdvance.currency)}</div>
                      <div className="text-[10px] text-muted-foreground font-bold">
                        {rep.repayment_method === "payroll_deduction" ? "استقطاع مسير رواتب" : rep.repayment_method === "cash" ? "سداد نقدي" : "تحويل بنكي"}
                        {rep.notes && ` — ${rep.notes}`}
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground font-bold">
                      {formatDate(rep.repayment_date)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <ModalFooter>
            <button
              onClick={() => setHistoryAdvance(null)}
              className="w-full py-2.5 rounded-xl bg-white/5 text-xs font-bold text-white hover:bg-white/10"
            >
              إغلاق
            </button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
