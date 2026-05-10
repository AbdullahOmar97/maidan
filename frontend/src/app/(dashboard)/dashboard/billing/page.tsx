"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { PermissionGuard } from "@/components/dashboard/permission-guard";
import MarkAsPaidModal, { type PaymentMethodKey } from "@/components/dashboard/MarkAsPaidModal";
import { Select } from "@/components/ui/select";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import {
  CreditCard, AlertTriangle, CheckCircle, Clock,
  TrendingUp, Search, Plus, Download, ChevronRight,
  Sparkles, Receipt, Loader2, Filter,
} from "lucide-react";
import type { Invoice, PaginatedResponse } from "@/types";
import Link from "next/link";
import { toast } from "sonner";
import { useBillingPermissions } from "@/lib/hooks/use-permission";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PAYABLE_STATUSES = new Set<Invoice["status"]>(["pending", "overdue", "partially_paid", "draft"]);

// ---------------------------------------------------------------------------
// Mark-paid button (shared between table row and mobile card)
// ---------------------------------------------------------------------------
function MarkPaidButton({
  invoice,
  canMarkPaid,
  onMarkPaid,
  isMarkingPaid,
}: {
  invoice: Invoice;
  canMarkPaid: boolean;
  onMarkPaid: (invoice: Invoice) => void;
  isMarkingPaid: boolean;
}) {
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
      {isMarkingPaid
        ? <Loader2 className="w-3 h-3 animate-spin" />
        : <CheckCircle className="w-3 h-3" aria-hidden="true" />}
      تم السداد
    </button>
  );
}

// ---------------------------------------------------------------------------
// Desktop table row
// ---------------------------------------------------------------------------
interface InvoiceRowProps {
  invoice: Invoice;
  canMarkPaid: boolean;
  onMarkPaid: (invoice: Invoice) => void;
  isMarkingPaid: boolean;
}

function InvoiceRow({ invoice, canMarkPaid, onMarkPaid, isMarkingPaid }: InvoiceRowProps) {
  return (
    <tr className="group hover:bg-white/[0.02] transition-colors border-b border-white/5 last:border-0">
      <td className="py-4 px-5 text-start">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-primary group-hover:scale-110 transition-transform" aria-hidden="true">
            <Receipt className="w-4 h-4" />
          </div>
          <p className="font-black text-sm text-white tracking-tight">{invoice.invoice_number}</p>
        </div>
      </td>
      <td className="py-4 px-5 text-start">
        <p className="font-bold text-sm text-white">{invoice.student_name}</p>
      </td>
      <td className="py-4 px-5 text-start">
        <StatusBadge status={invoice.status} />
      </td>
      <td className="py-4 px-5 text-sm font-bold text-muted-foreground text-start" dir="ltr">
        {formatDate(invoice.due_date)}
      </td>
      <td className="py-4 px-5 text-start">
        <p className="font-black text-sm text-white" dir="ltr">
          {formatCurrency(invoice.total_amount, invoice.currency)}
        </p>
        {invoice.amount_due > 0 && invoice.status !== "paid" && (
          <p className="text-[10px] font-bold text-amber-400 mt-1" dir="ltr">
            متبقي: {formatCurrency(invoice.amount_due, invoice.currency)}
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

// ---------------------------------------------------------------------------
// Mobile invoice card
// ---------------------------------------------------------------------------
function InvoiceMobileCard({
  invoice,
  canMarkPaid,
  onMarkPaid,
  isMarkingPaid,
}: InvoiceRowProps) {
  return (
    <div className="glass-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-primary shrink-0" aria-hidden="true">
            <Receipt className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="font-black text-sm text-white truncate">{invoice.invoice_number}</p>
            <p className="text-xs font-bold text-muted-foreground truncate">{invoice.student_name}</p>
          </div>
        </div>
        <StatusBadge status={invoice.status} />
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground font-black uppercase tracking-widest text-[10px] mb-0.5">تاريخ الاستحقاق</p>
          <p className="font-bold text-white" dir="ltr">{formatDate(invoice.due_date)}</p>
        </div>
        <div>
          <p className="text-muted-foreground font-black uppercase tracking-widest text-[10px] mb-0.5">المبلغ</p>
          <p className="font-black text-white" dir="ltr">{formatCurrency(invoice.total_amount, invoice.currency)}</p>
          {invoice.amount_due > 0 && invoice.status !== "paid" && (
            <p className="text-[10px] font-bold text-amber-400" dir="ltr">
              متبقي: {formatCurrency(invoice.amount_due, invoice.currency)}
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

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
function EmptyState() {
  return (
    <div className="py-24 text-center">
      <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6" aria-hidden="true">
        <Receipt className="w-10 h-10 text-muted-foreground opacity-20" />
      </div>
      <p className="text-white font-black text-lg">لا توجد سجلات مالية</p>
      <p className="text-muted-foreground text-sm font-bold mt-2">ابدأ بإصدار أول فاتورة للطالب الآن.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function BillingPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch]             = useState("");
  const [markingId, setMarkingId]       = useState<number | null>(null);
  const [modalInvoice, setModalInvoice] = useState<Invoice | null>(null);
  const queryClient                     = useQueryClient();

  const { canMarkInvoicePaid, canManageBilling, canCreateInvoice } = useBillingPermissions();

  const { data: summary } = useQuery({
    queryKey: ["billing", "summary"],
    queryFn:  () => api.billing.invoices.summary().then((r) => r.data),
  });

  const { data: invoices, isLoading } = useQuery<PaginatedResponse<Invoice>>({
    queryKey: ["billing", "invoices", { status: statusFilter, search }],
    queryFn:  () =>
      api.billing.invoices
        .list({ status: statusFilter || undefined, search: search || undefined })
        .then((r) => r.data),
  });

  const markPaidMutation = useMutation({
    mutationFn: ({ invoice, paymentMethod, note }: { invoice: Invoice; paymentMethod: PaymentMethodKey; note: string }) =>
      api.billing.invoices.markPaid(invoice.id, { payment_method: paymentMethod, note }),
    onMutate:  ({ invoice }) => setMarkingId(invoice.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "invoices"] });
      queryClient.invalidateQueries({ queryKey: ["billing", "summary"] });
      toast.success("تم تأكيد السداد بنجاح ✓");
      setModalInvoice(null);
    },
    onError:   (err: any) => toast.error(err.response?.data?.error || "فشل تأكيد السداد"),
    onSettled: () => setMarkingId(null),
  });

  const handleMarkPaid    = (invoice: Invoice) => setModalInvoice(invoice);
  const handleModalConfirm = (paymentMethod: PaymentMethodKey, note: string) => {
    if (!modalInvoice) return;
    markPaidMutation.mutate({ invoice: modalInvoice, paymentMethod, note });
  };

  const invoiceList = invoices?.results ?? [];

  return (
    <PermissionGuard permission="can_view_billing">
      <div className="space-y-6 md:space-y-10 pb-12">
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

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
          <StatsCard label="مدفوع هذا الشهر" value={summary?.paid_this_month ?? 0}  icon={CheckCircle}  color="emerald" isCurrency />
          <StatsCard label="إجمالي معلق"      value={summary?.total_pending  ?? 0}  icon={Clock}        color="amber"   isCurrency />
          <StatsCard label="متأخر"             value={summary?.total_overdue  ?? 0}  icon={AlertTriangle} color="red"    badge={summary?.overdue_count} isCurrency />
          <StatsCard label="إجمالي مدفوع"     value={summary?.total_paid     ?? 0}  icon={TrendingUp}   color="primary" isCurrency />
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 p-2 bg-white/[0.02] border border-white/5 rounded-2xl">
          <div className="relative flex-1 group">
            <Search
              className="absolute end-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="البحث بالطالب، رقم الفاتورة..."
              className="w-full pe-11 ps-4 py-3 rounded-xl bg-white/5 border border-white/5 focus:border-primary/50 focus:bg-white/10 focus:outline-none text-sm font-bold text-white transition-all placeholder:text-muted-foreground/50"
              aria-label="البحث في الفواتير"
            />
          </div>
          <div className="relative">
            <Filter className="absolute end-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="sm:min-w-[180px] pe-11"
              aria-label="تصفية حسب الحالة"
            >
              <option value="">جميع الحالات</option>
              <option value="pending">معلق</option>
              <option value="paid">مدفوع</option>
              <option value="overdue">متأخر</option>
              <option value="void">ملغي</option>
            </Select>
          </div>
        </div>

        {/* ── Desktop Table ── */}
        {isLoading ? (
          <div className="table-desktop glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" aria-label="جدول الفواتير">
                <thead>
                  <tr className="bg-white/[0.03] border-b border-white/5">
                    {["رقم الفاتورة", "اسم الطالب", "الحالة", "تاريخ الاستحقاق", "المبلغ الإجمالي", ""].map((h, idx) => (
                      <th 
                        key={h} 
                        className={cn(
                          "py-5 px-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground",
                          idx === 0 ? "rounded-s-lg text-start" : idx === 5 ? "rounded-e-lg text-end" : "text-start"
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse border-b border-white/5">
                      {[...Array(6)].map((_, j) => (
                        <td key={j} className={cn("py-5 px-5", j === 5 ? "text-end" : "text-start")}>
                          <div className={cn("h-4 bg-white/5 rounded-lg w-full", j === 5 && "ms-auto")} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : invoiceList.length === 0 ? (
          <div className="glass-card overflow-hidden"><EmptyState /></div>
        ) : (
          <div className="table-desktop glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" aria-label="جدول الفواتير">
                <thead>
                  <tr className="bg-white/[0.03] border-b border-white/5">
                    <th className="py-5 px-5 rounded-s-lg text-[10px] font-black uppercase tracking-widest text-muted-foreground text-start">رقم الفاتورة</th>
                    <th className="py-5 px-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-start">اسم الطالب</th>
                    <th className="py-5 px-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-start">الحالة</th>
                    <th className="py-5 px-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-start">تاريخ الاستحقاق</th>
                    <th className="py-5 px-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-start">المبلغ الإجمالي</th>
                    <th className="py-5 px-5 rounded-e-lg text-end" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {invoiceList.map((invoice) => (
                    <InvoiceRow
                      key={invoice.id}
                      invoice={invoice}
                      canMarkPaid={canMarkInvoicePaid}
                      onMarkPaid={handleMarkPaid}
                      isMarkingPaid={markingId === invoice.id}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {invoices && invoices.total_pages > 1 && (
              <div className="p-5 bg-white/[0.01] border-t border-white/5 flex items-center justify-between gap-4">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                  عرض {invoiceList.length} من أصل {invoices.count} سجل
                </p>
                <div className="flex items-center gap-2">
                  <button className="px-4 py-2 rounded-xl bg-white/5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-white/10 hover:text-white transition-all disabled:opacity-30 touch-target">السابق</button>
                  <button className="px-4 py-2 rounded-xl bg-white/5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-white/10 hover:text-white transition-all disabled:opacity-30 touch-target">التالي</button>
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
          <div className="table-mobile glass-card"><EmptyState /></div>
        ) : (
          <div className="table-mobile space-y-3">
            {invoiceList.map((invoice) => (
              <InvoiceMobileCard
                key={invoice.id}
                invoice={invoice}
                canMarkPaid={canMarkInvoicePaid}
                onMarkPaid={handleMarkPaid}
                isMarkingPaid={markingId === invoice.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Mark-as-Paid Modal */}
      {modalInvoice && (
        <MarkAsPaidModal
          invoiceNumber={modalInvoice.invoice_number}
          isPending={markPaidMutation.isPending}
          onConfirm={handleModalConfirm}
          onClose={() => setModalInvoice(null)}
        />
      )}
    </PermissionGuard>
  );
}
