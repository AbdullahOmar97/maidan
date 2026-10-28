"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { formatCurrency, formatDate, cn, isInvoiceOverdue } from "@/lib/utils";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import MarkAsPaidModal, { type PaymentMethodKey } from "@/components/dashboard/MarkAsPaidModal";
import { BatchInvoicePrintModal } from "@/components/dashboard/billing/BatchInvoicePrintModal";
import { printInvoices } from "@/lib/invoice-print-engine";
import { useBillingPermissions } from "@/lib/hooks/use-permission";
import { useTenant } from "@/lib/providers/tenant-provider";
import {
  Receipt, CheckCircle, ChevronRight, Loader2,
  Printer, Download, Eye, X, CheckSquare, Square,
} from "lucide-react";
import { toast } from "sonner";
import type { Invoice } from "@/types";

const PAYABLE_STATUSES = new Set<Invoice["status"]>([
  "pending",
  "overdue",
  "partially_paid",
  "draft",
]);

interface MarkPaidButtonProps {
  invoice: Invoice;
  canMarkPaid: boolean;
  onMarkPaid: (invoice: Invoice) => void;
  isMarkingPaid: boolean;
}

function MarkPaidButton({
  invoice,
  canMarkPaid,
  onMarkPaid,
  isMarkingPaid,
}: MarkPaidButtonProps) {
  if (!canMarkPaid || !PAYABLE_STATUSES.has(invoice.status)) return null;

  return (
    <button
      onClick={() => onMarkPaid(invoice)}
      disabled={isMarkingPaid}
      title="تأكيد استلام المبلغ يدوياً"
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 touch-target",
        "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400",
        "hover:bg-emerald-500 hover:text-white hover:border-emerald-500",
        "disabled:opacity-50 disabled:cursor-not-allowed"
      )}
      aria-label={`تأكيد سداد الفاتورة ${invoice.invoice_number}`}
    >
      {isMarkingPaid ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <CheckCircle className="w-3 h-3" aria-hidden="true" />
      )}
      تم السداد
    </button>
  );
}

interface InvoiceRowProps {
  invoice: Invoice;
  canMarkPaid: boolean;
  onMarkPaid: (invoice: Invoice) => void;
  isMarkingPaid: boolean;
  showPlanPrimary?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: number) => void;
  onQuickPrint?: (invoice: Invoice) => void;
}

function InvoiceRow({
  invoice,
  canMarkPaid,
  onMarkPaid,
  isMarkingPaid,
  showPlanPrimary = false,
  isSelected = false,
  onToggleSelect,
  onQuickPrint,
}: InvoiceRowProps) {
  const displayStatus = isInvoiceOverdue(invoice.status, invoice.due_date)
    ? "overdue"
    : invoice.status;

  const primaryTitle = showPlanPrimary
    ? invoice.plan_name || invoice.notes || "فاتورة اشتراك"
    : invoice.student_name;
  const secondaryTitle = showPlanPrimary
    ? invoice.notes && invoice.plan_name ? invoice.notes : null
    : invoice.plan_name;

  return (
    <tr className={cn(
      "group transition-colors border-b border-white/5 last:border-0",
      isSelected ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-white/[0.02]"
    )}>
      {/* Selection Checkbox */}
      <td className="py-4 ps-4 pe-2 text-start w-10">
        <button
          type="button"
          onClick={() => onToggleSelect?.(invoice.id)}
          className="text-muted-foreground hover:text-primary transition-colors focus:outline-none"
          aria-label={`تحديد الفاتورة ${invoice.invoice_number}`}
        >
          {isSelected ? (
            <CheckSquare className="w-4 h-4 text-primary" />
          ) : (
            <Square className="w-4 h-4 text-white/30 group-hover:text-white/60" />
          )}
        </button>
      </td>

      <td className="py-4 px-4 text-start">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-primary group-hover:scale-110 transition-transform"
            aria-hidden="true"
          >
            <Receipt className="w-4 h-4" />
          </div>
          <p className="font-black text-sm text-white tracking-tight">
            #{invoice.invoice_number}
          </p>
        </div>
      </td>
      <td className="py-4 px-4 text-start">
        <p className="font-bold text-sm text-white">{primaryTitle}</p>
        {secondaryTitle && (
          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{secondaryTitle}</p>
        )}
      </td>
      <td className="py-4 px-4 text-start">
        <StatusBadge status={displayStatus} />
      </td>
      <td className="py-4 px-4 text-sm font-bold text-muted-foreground text-start">
        <bdi>{formatDate(invoice.due_date)}</bdi>
      </td>
      <td className="py-4 px-4 text-end">
        <p className="font-black text-sm text-white">
          <bdi>{formatCurrency(invoice.total_amount, invoice.currency)}</bdi>
        </p>
        {invoice.amount_due > 0 && invoice.status !== "paid" && invoice.status !== "void" && invoice.status !== "refunded" && (
          <p className="text-[10px] font-bold text-amber-400 mt-1">
            متبقي: <bdi>{formatCurrency(invoice.amount_due, invoice.currency)}</bdi>
          </p>
        )}
      </td>
      <td className="py-4 px-5 text-end">
        <div className="flex items-center gap-1.5 justify-end">
          <button
            type="button"
            onClick={() => onQuickPrint?.(invoice)}
            title="معاينة وطباعة الفاتورة"
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white transition-all active:scale-90"
            aria-label={`طباعة الفاتورة ${invoice.invoice_number}`}
          >
            <Printer className="w-4 h-4" />
          </button>
          <MarkPaidButton
            invoice={invoice}
            canMarkPaid={canMarkPaid}
            onMarkPaid={onMarkPaid}
            isMarkingPaid={isMarkingPaid}
          />
          <Link
            href={`/dashboard/billing/invoices/${invoice.id}`}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white/5 text-muted-foreground hover:bg-primary hover:text-white transition-all active:scale-90"
            aria-label={`عرض تفاصيل الفاتورة ${invoice.invoice_number}`}
          >
            <ChevronRight className="w-4 h-4 rtl-flip" aria-hidden="true" />
          </Link>
        </div>
      </td>
    </tr>
  );
}

function InvoiceMobileCard({
  invoice,
  canMarkPaid,
  onMarkPaid,
  isMarkingPaid,
  showPlanPrimary = false,
  isSelected = false,
  onToggleSelect,
  onQuickPrint,
}: InvoiceRowProps) {
  const displayStatus = isInvoiceOverdue(invoice.status, invoice.due_date)
    ? "overdue"
    : invoice.status;

  const primaryTitle = showPlanPrimary
    ? invoice.plan_name || invoice.notes || "فاتورة اشتراك"
    : invoice.student_name;
  const secondaryTitle = showPlanPrimary
    ? invoice.notes && invoice.plan_name ? invoice.notes : null
    : invoice.plan_name;

  return (
    <div className={cn(
      "glass-card p-4 space-y-3 transition-colors",
      isSelected && "border-primary/40 bg-primary/5"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => onToggleSelect?.(invoice.id)}
            className="text-muted-foreground hover:text-primary transition-colors focus:outline-none p-1"
            aria-label={`تحديد الفاتورة ${invoice.invoice_number}`}
          >
            {isSelected ? (
              <CheckSquare className="w-5 h-5 text-primary" />
            ) : (
              <Square className="w-5 h-5 text-white/30" />
            )}
          </button>
          <div
            className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-primary shrink-0"
            aria-hidden="true"
          >
            <Receipt className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="font-black text-sm text-white truncate">
              #{invoice.invoice_number}
            </p>
            <p className="text-xs font-bold text-muted-foreground truncate">
              {primaryTitle}
            </p>
            {secondaryTitle && (
              <p className="text-[10px] text-muted-foreground/70 truncate">{secondaryTitle}</p>
            )}
          </div>
        </div>
        <StatusBadge status={displayStatus} />
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-2 text-xs text-start">
        <div>
          <p className="text-muted-foreground font-black uppercase tracking-widest text-[10px] mb-0.5">
            تاريخ الاستحقاق
          </p>
          <p className="font-bold text-white">
            <bdi>{formatDate(invoice.due_date)}</bdi>
          </p>
        </div>
        <div>
          <p className="text-muted-foreground font-black uppercase tracking-widest text-[10px] mb-0.5">
            المبلغ
          </p>
          <p className="font-black text-white">
            <bdi>{formatCurrency(invoice.total_amount, invoice.currency)}</bdi>
          </p>
          {invoice.amount_due > 0 && invoice.status !== "paid" && invoice.status !== "void" && invoice.status !== "refunded" && (
            <p className="text-[10px] font-bold text-amber-400">
              متبقي: <bdi>{formatCurrency(invoice.amount_due, invoice.currency)}</bdi>
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-white/5">
        <button
          type="button"
          onClick={() => onQuickPrint?.(invoice)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 text-xs font-bold text-white hover:bg-white/10 transition-all"
        >
          <Printer className="w-3.5 h-3.5 text-primary" />
          <span>طباعة</span>
        </button>
        <MarkPaidButton
          invoice={invoice}
          canMarkPaid={canMarkPaid}
          onMarkPaid={onMarkPaid}
          isMarkingPaid={isMarkingPaid}
        />
        <Link
          href={`/dashboard/billing/invoices/${invoice.id}`}
          className="me-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/5 text-muted-foreground text-xs font-black hover:bg-primary hover:text-white transition-all touch-target"
          aria-label={`عرض تفاصيل الفاتورة ${invoice.invoice_number}`}
        >
          التفاصيل
          <ChevronRight className="w-3.5 h-3.5 rtl-flip" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

function InvoicesEmptyState({
  title = "لا توجد سجلات مالية",
  subtitle = "ابدأ بإصدار أول فاتورة للطالب الآن.",
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="py-24 text-center">
      <div
        className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6"
        aria-hidden="true"
      >
        <Receipt className="w-10 h-10 text-muted-foreground opacity-20" />
      </div>
      <p className="text-white font-black text-lg">{title}</p>
      <p className="text-muted-foreground text-sm font-bold mt-2">{subtitle}</p>
    </div>
  );
}

export interface InvoicesListProps {
  invoices: Invoice[];
  isLoading?: boolean;
  canMarkPaid?: boolean;
  showPlanPrimary?: boolean;
  emptyTitle?: string;
  emptySubtitle?: string;
  onInvoiceUpdated?: () => void;
  pagination?: {
    page: number;
    totalPages: number;
    totalCount: number;
    onPageChange: (newPage: number) => void;
  };
}

export function InvoicesList({
  invoices,
  isLoading = false,
  canMarkPaid: canMarkPaidProp,
  showPlanPrimary = false,
  emptyTitle,
  emptySubtitle,
  onInvoiceUpdated,
  pagination,
}: InvoicesListProps) {
  const queryClient = useQueryClient();
  const perms = useBillingPermissions();
  const { tenant } = useTenant();
  const canMarkPaid = canMarkPaidProp !== undefined ? canMarkPaidProp : perms.canMarkInvoicePaid;

  const [modalInvoice, setModalInvoice] = useState<Invoice | null>(null);
  const [markingId, setMarkingId] = useState<number | null>(null);

  // Batch selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [printModalInvoices, setPrintModalInvoices] = useState<Invoice[] | null>(null);
  const [isBulkPrinting, setIsBulkPrinting] = useState(false);
  const [isFetchingAllInvoices, setIsFetchingAllInvoices] = useState(false);
  const [allInvoicesCache, setAllInvoicesCache] = useState<Invoice[] | null>(null);

  const invoiceList = invoices || [];

  const clubInfo = useMemo(() => {
    if (!tenant) return null;
    return {
      name: tenant.name,
      business_name: tenant.business_name || "",
      phone: tenant.phone || "",
      email: tenant.email || "",
      logo: tenant.logo || null,
      stamp: tenant.stamp || null,
      signature: tenant.signature || null,
      currency: tenant.default_currency || "JOD",
      country: tenant.country || "JO",
    };
  }, [tenant]);

  const markPaidMutation = useMutation({
    mutationFn: ({
      invoice,
      data,
    }: {
      invoice: Invoice;
      data: {
        paymentMethod: PaymentMethodKey;
        amount?: number;
        surplusAction?: "credit" | "change";
        note: string;
      };
    }) =>
      api.billing.invoices.markPaid(invoice.id, {
        payment_method: data.paymentMethod,
        amount: data.amount,
        surplus_action: data.surplusAction,
        note: data.note,
      }),
    onMutate: ({ invoice }) => setMarkingId(invoice.id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["billing", "invoices"] });
      queryClient.invalidateQueries({ queryKey: ["billing", "summary"] });
      queryClient.invalidateQueries({ queryKey: ["student-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["student"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      if (res?.data?.status === "partially_paid") {
        toast.success("تم تسجيل الدفعة الجزئية بنجاح ✓");
      } else if (
        Number(res?.data?.surplus_amount ?? 0) > 0 &&
        res?.data?.surplus_action === "credit"
      ) {
        toast.success(
          `تم سداد الفاتورة وإيداع فائض ${res.data.surplus_amount} د.أ بمحفظة الطالب ✓`
        );
      } else {
        toast.success("تم تأكيد السداد بنجاح ✓");
      }
      setModalInvoice(null);
      onInvoiceUpdated?.();
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.error || "فشل تأكيد السداد"),
    onSettled: () => setMarkingId(null),
  });

  const handleMarkPaid = (invoice: Invoice) => setModalInvoice(invoice);
  const handleModalConfirm = (data: {
    paymentMethod: PaymentMethodKey;
    amount?: number;
    surplusAction?: "credit" | "change";
    note: string;
  }) => {
    if (!modalInvoice) return;
    markPaidMutation.mutate({ invoice: modalInvoice, data });
  };

  // Selection handlers
  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isAllVisibleSelected =
    invoiceList.length > 0 && invoiceList.every((inv) => selectedIds.has(inv.id));

  const handleToggleSelectAll = () => {
    if (isAllVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(invoiceList.map((inv) => inv.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
    setAllInvoicesCache(null);
  };

  const handleSelectAllAcrossPages = async () => {
    if (!pagination?.totalCount) return;
    try {
      setIsFetchingAllInvoices(true);
      toast.loading("جارٍ تحميل جميع الفواتير...", { id: "fetch-all-invoices" });
      const res = await api.billing.invoices.list({ page_size: Math.min(200, pagination.totalCount) });
      const allResults: Invoice[] = res.data.results || res.data;
      setAllInvoicesCache(allResults);
      setSelectedIds(new Set(allResults.map((inv) => inv.id)));
      toast.success(`تم تحديد جميع الـ ${allResults.length} فاتورة بنجاح ✓`, { id: "fetch-all-invoices" });
    } catch (err) {
      toast.error("فشل تحميل الفواتير", { id: "fetch-all-invoices" });
    } finally {
      setIsFetchingAllInvoices(false);
    }
  };

  const activeInvoicesPool = allInvoicesCache || invoiceList;
  const selectedInvoices = useMemo(
    () => activeInvoicesPool.filter((inv) => selectedIds.has(inv.id)),
    [activeInvoicesPool, selectedIds]
  );

  const selectedTotalSum = useMemo(
    () => selectedInvoices.reduce((acc, inv) => acc + Number(inv.total_amount || 0), 0),
    [selectedInvoices]
  );

  const handleBatchPrint = () => {
    if (selectedInvoices.length === 0) return;
    setPrintModalInvoices(selectedInvoices);
  };

  const handleDirectBatchDownload = async () => {
    if (selectedInvoices.length === 0) return;
    setIsBulkPrinting(true);
    toast.info("يرجى اختيار 'حفظ بتنسيق PDF' / 'Save as PDF' من خيارات الطابعة", { duration: 4000 });
    try {
      await printInvoices(selectedInvoices, { clubInfo });
    } catch (err) {
      toast.error("فشل تجهيز ملف الطباعة");
    } finally {
      setIsBulkPrinting(false);
    }
  };

  const handleQuickPrint = (invoice: Invoice) => {
    setPrintModalInvoices([invoice]);
  };

  return (
    <div className="space-y-4 relative">
      {/* ── Static Top Action Bar (Print & Download - Embedded in page, not floating) ── */}
      {selectedIds.size > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border border-primary/30 shadow-xl flex flex-col gap-4 animate-in fade-in duration-200">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-primary text-primary-foreground font-black text-sm flex items-center justify-center shadow-md shadow-primary/30">
                {selectedIds.size}
              </span>
              <div>
                <p className="text-sm font-black text-white">
                  تم تحديد {selectedIds.size} فاتورة للطباعة
                </p>
                <p className="text-xs text-muted-foreground font-bold">
                  إجمالي المبالغ: <strong className="text-primary font-mono">{formatCurrency(selectedTotalSum, invoiceList[0]?.currency || "JOD")}</strong>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleBatchPrint}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-black hover:brightness-110 active:scale-95 transition-all shadow-md shadow-primary/20"
              >
                <Printer className="w-4 h-4" />
                <span>معاينة وطباعة ({selectedIds.size})</span>
              </button>

              <button
                type="button"
                onClick={handleDirectBatchDownload}
                disabled={isBulkPrinting}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-black text-white transition-all disabled:opacity-50"
              >
                {isBulkPrinting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                ) : (
                  <Download className="w-4 h-4 text-primary" />
                )}
                <span>تحميل PDF ({selectedIds.size})</span>
              </button>

              <button
                type="button"
                onClick={handleClearSelection}
                className="px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-muted-foreground hover:text-white transition-all"
              >
                إلغاء التحديد
              </button>
            </div>
          </div>

          {pagination && pagination.totalCount > invoiceList.length && selectedIds.size < pagination.totalCount && (
            <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">
                تم تحديد الفواتير المعروضة في الصفحة الحالية فقط (<strong>{selectedIds.size}</strong> فاتورة).
              </span>
              <button
                type="button"
                onClick={handleSelectAllAcrossPages}
                disabled={isFetchingAllInvoices}
                className="text-primary hover:underline font-bold inline-flex items-center gap-1.5"
              >
                {isFetchingAllInvoices ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckSquare className="w-3.5 h-3.5" />
                )}
                <span>تحديد جميع الـ {pagination.totalCount} فاتورة عبر كل الصفحات</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Desktop Table ── */}
      {isLoading ? (
        <div className="table-desktop glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-white/[0.03] border-b border-white/5">
                  <th className="py-5 ps-4 pe-2 w-10 text-start" />
                  <th className="py-5 px-4 text-start text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    رقم الفاتورة
                  </th>
                  <th className="py-5 px-4 text-start text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    {showPlanPrimary ? "الباقة / الوصف" : "اسم الطالب"}
                  </th>
                  <th className="py-5 px-4 text-start text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    الحالة
                  </th>
                  <th className="py-5 px-4 text-start text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    تاريخ الاستحقاق
                  </th>
                  <th className="py-5 px-4 text-end text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    المبلغ الإجمالي
                  </th>
                  <th className="py-5 px-5 text-end" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-4 ps-4 pe-2">
                      <div className="w-4 h-4 bg-white/5 rounded" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-white/5 rounded w-24" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-white/5 rounded w-36" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-6 bg-white/5 rounded-xl w-16" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-white/5 rounded w-20" />
                    </td>
                    <td className="py-4 px-4 text-end">
                      <div className="h-4 bg-white/5 rounded w-16 ms-auto" />
                    </td>
                    <td className="py-4 px-5 text-end">
                      <div className="h-8 bg-white/5 rounded-lg w-20 ms-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : invoiceList.length === 0 ? (
        <div className="table-desktop glass-card overflow-hidden">
          <InvoicesEmptyState title={emptyTitle} subtitle={emptySubtitle} />
        </div>
      ) : (
        <div className="table-desktop glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" aria-label="جدول الفواتير">
              <thead>
                <tr className="bg-white/[0.03] border-b border-white/5">
                  {/* Select All Checkbox */}
                  <th className="py-5 ps-4 pe-2 text-start w-10">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="text-muted-foreground hover:text-primary transition-colors focus:outline-none"
                      title={isAllVisibleSelected ? "إلغاء تحديد الكل" : "تحديد كل الفواتير المعروضة"}
                      aria-label="تحديد كل الفواتير"
                    >
                      {isAllVisibleSelected ? (
                        <CheckSquare className="w-4 h-4 text-primary" />
                      ) : (
                        <Square className="w-4 h-4 text-white/30 hover:text-white/60" />
                      )}
                    </button>
                  </th>
                  <th className="py-5 px-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-start">
                    رقم الفاتورة
                  </th>
                  <th className="py-5 px-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-start">
                    {showPlanPrimary ? "الباقة / الوصف" : "اسم الطالب"}
                  </th>
                  <th className="py-5 px-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-start">
                    الحالة
                  </th>
                  <th className="py-5 px-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-start">
                    تاريخ الاستحقاق
                  </th>
                  <th className="py-5 px-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-end">
                    المبلغ الإجمالي
                  </th>
                  <th className="py-5 px-5 text-end" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {invoiceList.map((invoice) => (
                  <InvoiceRow
                    key={invoice.id}
                    invoice={invoice}
                    canMarkPaid={canMarkPaid}
                    onMarkPaid={handleMarkPaid}
                    isMarkingPaid={markingId === invoice.id}
                    showPlanPrimary={showPlanPrimary}
                    isSelected={selectedIds.has(invoice.id)}
                    onToggleSelect={handleToggleSelect}
                    onQuickPrint={handleQuickPrint}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="p-5 bg-white/[0.01] border-t border-white/5 flex items-center justify-between gap-4">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                عرض {invoiceList.length} من أصل {pagination.totalCount} سجل (صفحة{" "}
                {pagination.page} من {pagination.totalPages})
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    pagination.onPageChange(Math.max(1, pagination.page - 1))
                  }
                  disabled={pagination.page <= 1}
                  className="px-4 py-2 rounded-xl bg-white/5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-white/10 hover:text-white transition-all disabled:opacity-30 touch-target"
                >
                  السابق
                </button>
                <button
                  onClick={() => pagination.onPageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="px-4 py-2 rounded-xl bg-white/5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-white/10 hover:text-white transition-all disabled:opacity-30 touch-target"
                >
                  التالي
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Mobile Card List ── */}
      {isLoading ? (
        <div className="table-mobile space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card p-4 space-y-3 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/5 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-white/5 rounded w-3/4" />
                  <div className="h-3 bg-white/5 rounded w-1/2" />
                </div>
              </div>
              <div className="h-10 bg-white/5 rounded-xl" />
            </div>
          ))}
        </div>
      ) : invoiceList.length === 0 ? (
        <div className="table-mobile glass-card">
          <InvoicesEmptyState title={emptyTitle} subtitle={emptySubtitle} />
        </div>
      ) : (
        <div className="table-mobile space-y-3">
          {invoiceList.map((invoice) => (
            <InvoiceMobileCard
              key={invoice.id}
              invoice={invoice}
              canMarkPaid={canMarkPaid}
              onMarkPaid={handleMarkPaid}
              isMarkingPaid={markingId === invoice.id}
              showPlanPrimary={showPlanPrimary}
              isSelected={selectedIds.has(invoice.id)}
              onToggleSelect={handleToggleSelect}
              onQuickPrint={handleQuickPrint}
            />
          ))}

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between p-3 glass-card">
              <button
                onClick={() =>
                  pagination.onPageChange(Math.max(1, pagination.page - 1))
                }
                disabled={pagination.page <= 1}
                className="px-3 py-1.5 rounded-lg bg-white/5 text-xs font-bold text-muted-foreground disabled:opacity-30"
              >
                السابق
              </button>
              <span className="text-xs text-muted-foreground font-bold">
                صفحة {pagination.page} من {pagination.totalPages}
              </span>
              <button
                onClick={() => pagination.onPageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1.5 rounded-lg bg-white/5 text-xs font-bold text-muted-foreground disabled:opacity-30"
              >
                التالي
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Batch Print / Preview Modal ── */}
      {printModalInvoices && (
        <BatchInvoicePrintModal
          open={Boolean(printModalInvoices)}
          onClose={() => setPrintModalInvoices(null)}
          invoices={printModalInvoices}
          clubInfo={clubInfo}
        />
      )}

      {/* ── Mark As Paid Modal ── */}
      {modalInvoice && (
        <MarkAsPaidModal
          invoiceNumber={modalInvoice.invoice_number}
          totalAmount={Number(modalInvoice.total_amount)}
          amountPaid={Number(modalInvoice.amount_paid)}
          currency={modalInvoice.currency}
          isPending={markPaidMutation.isPending}
          onConfirm={handleModalConfirm}
          onClose={() => setModalInvoice(null)}
        />
      )}
    </div>
  );
}
