"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { formatCurrency, formatDate, cn, isInvoiceOverdue } from "@/lib/utils";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import MarkAsPaidModal, { type PaymentMethodKey } from "@/components/dashboard/MarkAsPaidModal";
import { useBillingPermissions } from "@/lib/hooks/use-permission";
import { Receipt, CheckCircle, ChevronRight, Loader2 } from "lucide-react";
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
}

function InvoiceRow({
  invoice,
  canMarkPaid,
  onMarkPaid,
  isMarkingPaid,
  showPlanPrimary = false,
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
    <tr className="group hover:bg-white/[0.02] transition-colors border-b border-white/5 last:border-0">
      <td className="py-4 px-5 text-start">
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
      <td className="py-4 px-5 text-start">
        <p className="font-bold text-sm text-white">{primaryTitle}</p>
        {secondaryTitle && (
          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{secondaryTitle}</p>
        )}
      </td>
      <td className="py-4 px-5 text-start">
        <StatusBadge status={displayStatus} />
      </td>
      <td className="py-4 px-5 text-sm font-bold text-muted-foreground text-start">
        <bdi>{formatDate(invoice.due_date)}</bdi>
      </td>
      <td className="py-4 px-5 text-end">
        <p className="font-black text-sm text-white">
          <bdi>{formatCurrency(invoice.total_amount, invoice.currency)}</bdi>
        </p>
        {invoice.amount_due > 0 && invoice.status !== "paid" && (
          <p className="text-[10px] font-bold text-amber-400 mt-1">
            متبقي: <bdi>{formatCurrency(invoice.amount_due, invoice.currency)}</bdi>
          </p>
        )}
      </td>
      <td className="py-4 px-5 text-end">
        <div className="flex items-center gap-2 justify-end">
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
    <div className="glass-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
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
          {invoice.amount_due > 0 && invoice.status !== "paid" && (
            <p className="text-[10px] font-bold text-amber-400">
              متبقي: <bdi>{formatCurrency(invoice.amount_due, invoice.currency)}</bdi>
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-white/5">
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
          عرض التفاصيل
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
  const canMarkPaid = canMarkPaidProp !== undefined ? canMarkPaidProp : perms.canMarkInvoicePaid;

  const [modalInvoice, setModalInvoice] = useState<Invoice | null>(null);
  const [markingId, setMarkingId] = useState<number | null>(null);

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

  const invoiceList = invoices || [];

  return (
    <div className="space-y-4">
      {/* ── Desktop Table ── */}
      {isLoading ? (
        <div className="table-desktop glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-white/[0.03] border-b border-white/5">
                  <th className="py-5 px-5 text-start text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    رقم الفاتورة
                  </th>
                  <th className="py-5 px-5 text-start text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    {showPlanPrimary ? "الباقة / الوصف" : "اسم الطالب"}
                  </th>
                  <th className="py-5 px-5 text-start text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    الحالة
                  </th>
                  <th className="py-5 px-5 text-start text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    تاريخ الاستحقاق
                  </th>
                  <th className="py-5 px-5 text-end text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    المبلغ الإجمالي
                  </th>
                  <th className="py-5 px-5 text-end" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-4 px-5">
                      <div className="h-4 bg-white/5 rounded w-24" />
                    </td>
                    <td className="py-4 px-5">
                      <div className="h-4 bg-white/5 rounded w-36" />
                    </td>
                    <td className="py-4 px-5">
                      <div className="h-6 bg-white/5 rounded-xl w-16" />
                    </td>
                    <td className="py-4 px-5">
                      <div className="h-4 bg-white/5 rounded w-20" />
                    </td>
                    <td className="py-4 px-5 text-end">
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
                  <th className="py-5 px-5 rounded-s-lg text-[10px] font-black uppercase tracking-widest text-muted-foreground text-start">
                    رقم الفاتورة
                  </th>
                  <th className="py-5 px-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-start">
                    {showPlanPrimary ? "الباقة / الوصف" : "اسم الطالب"}
                  </th>
                  <th className="py-5 px-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-start">
                    الحالة
                  </th>
                  <th className="py-5 px-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-start">
                    تاريخ الاستحقاق
                  </th>
                  <th className="py-5 px-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-end">
                    المبلغ الإجمالي
                  </th>
                  <th className="py-5 px-5 rounded-e-lg text-end" />
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
