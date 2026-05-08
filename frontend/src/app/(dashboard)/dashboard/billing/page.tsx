"use client";
import { PageHeader } from "@/components/dashboard/page-header";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import {
  CreditCard, AlertTriangle, CheckCircle, Clock,
  TrendingUp, Search, Plus, Download, ChevronRight, Sparkles, Receipt, Loader2,
} from "lucide-react";
import type { Invoice, PaginatedResponse } from "@/types";
import Link from "next/link";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { toast } from "sonner";
import { PermissionGuard } from "@/components/dashboard/permission-guard";
import MarkAsPaidModal, { type PaymentMethodKey } from "@/components/dashboard/MarkAsPaidModal";
import { useBillingPermissions } from "@/lib/hooks/use-permission";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
/** Invoice statuses that are eligible for manual payment confirmation. */
const PAYABLE_STATUSES = new Set<Invoice["status"]>(["pending", "overdue", "partially_paid", "draft"]);

// ---------------------------------------------------------------------------
// InvoiceRow
// ---------------------------------------------------------------------------
interface InvoiceRowProps {
  invoice: Invoice;
  canMarkPaid: boolean;
  onMarkPaid: (invoice: Invoice) => void;
  isMarkingPaid: boolean;
}

function InvoiceRow({ invoice, canMarkPaid, onMarkPaid, isMarkingPaid }: InvoiceRowProps) {
  const showMarkPaid = canMarkPaid && PAYABLE_STATUSES.has(invoice.status);

  return (
    <tr className="group hover:bg-white/[0.02] transition-colors border-b border-white/5 last:border-0">
      <td className="py-5 px-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
            <Receipt className="w-4 h-4" />
          </div>
          <p className="font-black text-sm text-white tracking-tight">{invoice.invoice_number}</p>
        </div>
      </td>
      <td className="py-5 px-6">
        <p className="font-bold text-sm text-white">{invoice.student_name}</p>
      </td>
      <td className="py-5 px-6">
        <StatusBadge status={invoice.status} />
      </td>
      <td className="py-5 px-6 text-sm font-bold text-muted-foreground" dir="ltr">
        {formatDate(invoice.due_date)}
      </td>
      <td className="py-5 px-6 text-right">
        <p className="font-black text-sm text-white" dir="ltr">
          {formatCurrency(invoice.total_amount, invoice.currency)}
        </p>
        {invoice.amount_due > 0 && invoice.status !== "paid" && (
          <p className="text-[10px] font-bold text-amber-400 mt-1" dir="ltr">
            متبقي: {formatCurrency(invoice.amount_due, invoice.currency)}
          </p>
        )}
      </td>
      <td className="py-5 px-6 text-left">
        <div className="flex items-center gap-2 justify-end">
          {showMarkPaid && (
            <button
              onClick={() => onMarkPaid(invoice)}
              disabled={isMarkingPaid}
              title="تأكيد استلام المبلغ يدوياً"
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95",
                "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400",
                "hover:bg-emerald-500 hover:text-white hover:border-emerald-500",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isMarkingPaid
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <CheckCircle className="w-3 h-3" />}
              تم السداد
            </button>
          )}
          <Link
            href={`/dashboard/billing/invoices/${invoice.id}`}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 text-muted-foreground hover:bg-primary hover:text-white transition-all active:scale-90"
          >
            <ChevronRight className="w-4 h-4 rtl-flip" />
          </Link>
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function BillingPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [markingId, setMarkingId] = useState<number | null>(null);
  const [modalInvoice, setModalInvoice] = useState<Invoice | null>(null);
  const queryClient = useQueryClient();
  const { canMarkInvoicePaid, canManageBilling, canCreateInvoice } = useBillingPermissions();
  const canMarkPaid = canMarkInvoicePaid;

  const { data: summary } = useQuery({
    queryKey: ["billing", "summary"],
    queryFn: () => api.billing.invoices.summary().then((r) => r.data),
  });

  const { data: invoices, isLoading } = useQuery<PaginatedResponse<Invoice>>({
    queryKey: ["billing", "invoices", { status: statusFilter, search }],
    queryFn: () =>
      api.billing.invoices
        .list({ status: statusFilter || undefined, search: search || undefined })
        .then((r) => r.data),
  });

  const markPaidMutation = useMutation({
    mutationFn: ({ invoice, paymentMethod, note }: { invoice: Invoice; paymentMethod: PaymentMethodKey; note: string }) =>
      api.billing.invoices.markPaid(invoice.id, { payment_method: paymentMethod, note }),
    onMutate: ({ invoice }: { invoice: Invoice; paymentMethod: PaymentMethodKey; note: string }) => setMarkingId(invoice.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "invoices"] });
      queryClient.invalidateQueries({ queryKey: ["billing", "summary"] });
      toast.success("تم تأكيد السداد بنجاح ✓");
      setModalInvoice(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "فشل تأكيد السداد");
    },
    onSettled: () => setMarkingId(null),
  });

  /** Opens the MarkAsPaidModal for the given invoice. */
  const handleMarkPaid = (invoice: Invoice) => setModalInvoice(invoice);

  /** Called when the modal is confirmed with a chosen payment method. */
  const handleModalConfirm = (paymentMethod: PaymentMethodKey, note: string) => {
    if (!modalInvoice) return;
    markPaidMutation.mutate({ invoice: modalInvoice, paymentMethod, note });
  };

  return (
    <PermissionGuard permission="can_view_billing">
    <div className="space-y-10 pb-12">
      <PageHeader
        title="الفواتير والمدفوعات"
        description="إدارة الشؤون المالية، تتبع الإيرادات بدقة، وإصدار الفواتير للطلاب والمنتسبين."
        icon={CreditCard}
      >
        <div className="flex items-center gap-3">
          {canManageBilling && (
            <Link
              href="/dashboard/billing/plans"
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/[0.08] transition-all active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-primary" />
              إدارة الباقات
            </Link>
          )}
          <button className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/[0.08] transition-all active:scale-95">
            <Download className="w-4 h-4" />
            تصدير
          </button>
          {canCreateInvoice && (
            <Link
              href="/dashboard/billing/new"
              className="flex items-center gap-2 px-6 py-3 rounded-xl gradient-brand text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.05] active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              فاتورة جديدة
            </Link>
          )}
        </div>
      </PageHeader>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard label="مدفوع هذا الشهر" value={summary?.paid_this_month ?? 0} icon={CheckCircle} color="emerald" isCurrency />
        <StatsCard label="إجمالي معلق" value={summary?.total_pending ?? 0} icon={Clock} color="amber" isCurrency />
        <StatsCard label="متأخر" value={summary?.total_overdue ?? 0} icon={AlertTriangle} color="red" badge={summary?.overdue_count} isCurrency />
        <StatsCard label="إجمالي مدفوع" value={summary?.total_paid ?? 0} icon={TrendingUp} color="primary" isCurrency />
      </div>

      {/* Main Content Area */}
      <div className="space-y-6">
        {/* Filter Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 p-2 bg-white/[0.02] border border-white/5 rounded-2xl">
          <div className="relative flex-1 group">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="البحث بالطالب، رقم الفاتورة..."
              className="w-full pr-11 pl-4 py-3 rounded-xl bg-white/5 border border-white/5 focus:border-primary/50 focus:bg-white/10 focus:outline-none text-sm font-bold text-white transition-all placeholder:text-muted-foreground/50"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-6 py-3 rounded-xl bg-white/5 border border-white/5 focus:border-primary/50 focus:bg-white/10 focus:outline-none text-sm font-black text-white transition-all min-w-[180px] appearance-none cursor-pointer"
          >
            <option value="" className="bg-slate-900">جميع الحالات</option>
            <option value="pending" className="bg-slate-900">معلق</option>
            <option value="paid" className="bg-slate-900">مدفوع</option>
            <option value="overdue" className="bg-slate-900">متأخر</option>
            <option value="void" className="bg-slate-900">ملغي</option>
          </select>
        </div>

        {/* Table */}
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-white/[0.03] border-b border-white/5">
                  <th className="py-5 px-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">رقم الفاتورة</th>
                  <th className="py-5 px-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">اسم الطالب</th>
                  <th className="py-5 px-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">الحالة</th>
                  <th className="py-5 px-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">تاريخ الاستحقاق</th>
                  <th className="py-5 px-6 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">المبلغ الإجمالي</th>
                  <th className="py-5 px-6"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {[...Array(6)].map((_, j) => (
                        <td key={j} className="py-6 px-6">
                          <div className="h-4 bg-white/5 rounded-lg w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : invoices?.results.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-32 text-center">
                      <div className="max-w-xs mx-auto">
                        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
                          <Receipt className="w-10 h-10 text-muted-foreground opacity-20" />
                        </div>
                        <p className="text-white font-black text-lg">لا توجد سجلات مالية</p>
                        <p className="text-muted-foreground text-sm font-bold mt-2">ابدأ بإصدار أول فاتورة للطالب الآن.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  invoices?.results.map((invoice) => (
                    <InvoiceRow
                      key={invoice.id}
                      invoice={invoice}
                      canMarkPaid={canMarkPaid}
                      onMarkPaid={handleMarkPaid}
                      isMarkingPaid={markingId === invoice.id}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
          {invoices && invoices.total_pages > 1 && (
            <div className="p-6 bg-white/[0.01] border-t border-white/5 flex items-center justify-between">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                عرض {invoices.results.length} من أصل {invoices.count} سجل
              </p>
              <div className="flex items-center gap-2">
                <button className="px-4 py-2 rounded-xl bg-white/5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-white/10 hover:text-white transition-all disabled:opacity-30">السابق</button>
                <button className="px-4 py-2 rounded-xl bg-white/5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-white/10 hover:text-white transition-all disabled:opacity-30">التالي</button>
              </div>
            </div>
          )}
        </div>
      </div>
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
