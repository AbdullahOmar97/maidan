"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { api } from "@/lib/api/client";
import {
  ArrowRight, Receipt, Calendar, User, CreditCard,
  Download, Printer, Send, Clock, CheckCircle,
  AlertTriangle, Info, Sparkles, DollarSign, Loader2,
} from "lucide-react";
import Link from "next/link";
import {
  formatCurrency, formatDate, getStatusBadgeClass,
  getStatusLabel, cn, isInvoiceOverdue,
} from "@/lib/utils";
import type { Invoice } from "@/types";
import { toast } from "sonner";
import { PermissionGuard } from "@/components/dashboard/permission-guard";
import MarkAsPaidModal, { type PaymentMethodKey } from "@/components/dashboard/MarkAsPaidModal";
import { useBillingPermissions } from "@/lib/hooks/use-permission";

export default function InvoiceDetailPage() {
  const { id }        = useParams();
  const queryClient   = useQueryClient();
  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const { canMarkInvoicePaid } = useBillingPermissions();

  const { data: invoice, isLoading, error } = useQuery<Invoice>({
    queryKey: ["billing", "invoices", id],
    queryFn:  () => api.billing.invoices.get(parseInt(id as string)).then((r) => r.data),
  });

  const initiatePaymentMutation = useMutation({
    mutationFn: (provider: string) =>
      api.billing.payments.initiate({
        invoice_id: parseInt(id as string),
        provider,
        return_url: window.location.href,
      }).then((r) => r.data),
    onSuccess: (data) => {
      if (data.redirect_url) {
        window.location.href = data.redirect_url;
      } else if (data.status === "success") {
        toast.success("تم الدفع بنجاح");
        queryClient.invalidateQueries({ queryKey: ["billing", "invoices", id] });
      }
    },
    onError: () => toast.error("فشل بدء عملية الدفع"),
  });

  const markPaidMutation = useMutation({
    mutationFn: ({ paymentMethod, note }: { paymentMethod: PaymentMethodKey; note: string }) =>
      api.billing.invoices.markPaid(parseInt(id as string), { payment_method: paymentMethod, note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "invoices", id] });
      queryClient.invalidateQueries({ queryKey: ["billing", "invoices"] });
      queryClient.invalidateQueries({ queryKey: ["billing", "summary"] });
      toast.success("تم تأكيد السداد بنجاح ✓");
      setMarkPaidOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "فشل تأكيد السداد"),
  });

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center" aria-busy="true" aria-label="جارٍ التحميل">
        <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  // ── Error state ──
  if (error || !invoice) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center px-4" role="alert">
        <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-6">
          <AlertTriangle className="w-10 h-10" aria-hidden="true" />
        </div>
        <h2 className="text-2xl font-black text-white">الفاتورة غير موجودة</h2>
        <p className="text-muted-foreground mt-2">لم نتمكن من العثور على الفاتورة المطلوبة.</p>
        <Link href="/dashboard/billing" className="mt-8 text-primary font-black flex items-center gap-2">
          <ArrowRight className="w-4 h-4 rtl-flip" aria-hidden="true" />
          العودة لقائمة الفواتير
        </Link>
      </div>
    );
  }

  const isOverdue = isInvoiceOverdue(invoice.status, invoice.due_date);
  const statusKey = isOverdue ? "overdue" : invoice.status;

  return (
    <PermissionGuard permission="can_view_billing">
      <div className="max-w-4xl mx-auto space-y-6 md:space-y-10 pb-16 md:pb-20">

        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Back + title */}
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/billing"
              className="touch-target w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-white transition-all active:scale-90 shadow-xl shrink-0"
              aria-label="العودة إلى قائمة الفواتير"
            >
              <ArrowRight className="w-5 h-5 rtl-flip" aria-hidden="true" />
            </Link>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">{invoice.invoice_number}</h1>
                <span
                  className={cn(
                    "px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border shadow-lg",
                    getStatusBadgeClass(statusKey)
                  )}
                >
                  {getStatusLabel(statusKey)}
                </span>
              </div>
              <p className="text-muted-foreground text-sm font-bold mt-1 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                تاريخ الإصدار: {formatDate(invoice.created_at)}
              </p>
            </div>
          </div>

          {/* Print / Download — hide on smallest screens */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={() => window.print()}
              className="touch-target w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-all active:scale-90"
              aria-label="طباعة الفاتورة"
            >
              <Printer className="w-5 h-5" aria-hidden="true" />
            </button>
            <button
              className="touch-target flex items-center gap-2 px-4 md:px-6 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all active:scale-95"
              aria-label="تحميل الفاتورة بصيغة PDF"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              <span className="hidden xs:inline">تحميل PDF</span>
            </button>
          </div>
        </div>

        {/* ── Content Grid ── */}
        {/* On mobile: sidebar stacks below main. On lg: 3-col grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">

          {/* ── Main Invoice Card ── */}
          <div className="lg:col-span-2 space-y-6 md:space-y-8">
            <div className="glass-card overflow-hidden">
              {/* Card header */}
              <div className="p-5 md:p-8 bg-white/[0.02] border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl gradient-brand flex items-center justify-center text-white shadow-xl shadow-primary/20 rotate-3 shrink-0" aria-hidden="true">
                    <Receipt className="w-6 h-6 md:w-8 md:h-8" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">فاتورة للطالب</p>
                    <h2 className="text-lg md:text-xl font-black text-white">{invoice.student_name}</h2>
                  </div>
                </div>
                <div className="sm:text-right">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">تاريخ الاستحقاق</p>
                  <p className={cn("text-base md:text-lg font-black", isOverdue ? "text-red-400" : "text-white")}>
                    {formatDate(invoice.due_date)}
                  </p>
                </div>
              </div>

              {/* Line items */}
              <div className="p-5 md:p-8 space-y-8 md:space-y-10">
                <div className="space-y-3">
                  <div className="grid grid-cols-4 px-3 md:px-4 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] md:tracking-[0.2em] border-b border-white/5">
                    <div className="col-span-2">الوصف</div>
                    <div className="text-center">الكمية</div>
                    <div className="text-start">المبلغ</div>
                  </div>
                  <div className="grid grid-cols-4 px-3 md:px-4 py-3 md:py-4 items-center">
                    <div className="col-span-2">
                      <p className="text-sm font-bold text-white">رسوم اشتراك / خدمات</p>
                      {invoice.notes && <p className="text-xs text-muted-foreground mt-1">{invoice.notes}</p>}
                    </div>
                    <div className="text-center text-sm font-bold text-white">1</div>
                    <div className="text-start text-sm font-black text-white" dir="ltr">
                      {formatCurrency(invoice.subtotal, invoice.currency)}
                    </div>
                  </div>
                </div>

                {/* Totals */}
                <div className="flex justify-end">
                  <div className="w-full max-w-xs space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground font-bold">المبلغ الفرعي</span>
                      <span className="text-white font-black" dir="ltr">{formatCurrency(invoice.subtotal, invoice.currency)}</span>
                    </div>
                    {invoice.discount_amount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-red-400 font-bold">الخصم</span>
                        <span className="text-red-400 font-black" dir="ltr">-{formatCurrency(invoice.discount_amount, invoice.currency)}</span>
                      </div>
                    )}
                    {invoice.tax_amount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground font-bold">الضريبة ({invoice.tax_rate}%)</span>
                        <span className="text-white font-black" dir="ltr">{formatCurrency(invoice.tax_amount, invoice.currency)}</span>
                      </div>
                    )}
                    <div className="pt-4 border-t border-white/10 flex justify-between">
                      <span className="text-white font-black text-base md:text-lg">الإجمالي</span>
                      <span className="text-primary font-black text-xl md:text-2xl" dir="ltr">{formatCurrency(invoice.total_amount, invoice.currency)}</span>
                    </div>
                    {invoice.amount_paid > 0 && (
                      <div className="flex justify-between text-sm pt-2">
                        <span className="text-emerald-400 font-bold">المبلغ المدفوع</span>
                        <span className="text-emerald-400 font-black" dir="ltr">{formatCurrency(invoice.amount_paid, invoice.currency)}</span>
                      </div>
                    )}
                    {invoice.status !== "paid" && (
                      <div className="p-3 md:p-4 rounded-2xl bg-primary/5 border border-primary/10 flex justify-between mt-4">
                        <span className="text-primary font-black text-xs md:text-sm uppercase tracking-widest">المتبقي للدفع</span>
                        <span className="text-primary font-black" dir="ltr">{formatCurrency(invoice.amount_due, invoice.currency)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer note */}
              <div className="px-5 md:px-8 py-4 md:py-6 bg-white/[0.01] border-t border-white/5">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Info className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                  <p className="text-xs font-bold">تم إنشاء هذه الفاتورة آلياً بواسطة نظام ميدان (MAIDAN)</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Sidebar: Status + Quick Info ── */}
          <div className="space-y-5 md:space-y-8">
            {/* Status Card */}
            <div className="glass-card p-5 md:p-8 space-y-5 md:space-y-6 relative overflow-hidden">
              {invoice.status === "paid" ? (
                <>
                  <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mx-auto" aria-hidden="true">
                    <CheckCircle className="w-8 h-8 md:w-10 md:h-10" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-base md:text-lg font-black text-white mb-1.5">تم سداد الفاتورة</h3>
                    <p className="text-sm text-muted-foreground font-bold">
                      تم تأكيد الدفع بتاريخ {invoice.paid_at ? formatDate(invoice.paid_at) : formatDate(invoice.created_at)}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div
                    className={cn(
                      "w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center mx-auto",
                      isOverdue ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"
                    )}
                    aria-hidden="true"
                  >
                    {isOverdue ? <AlertTriangle className="w-8 h-8 md:w-10 md:h-10" /> : <Clock className="w-8 h-8 md:w-10 md:h-10" />}
                  </div>
                  <div className="text-center">
                    <h3 className="text-base md:text-lg font-black text-white mb-1.5">
                      {isOverdue ? "الفاتورة متأخرة" : "انتظار السداد"}
                    </h3>
                    <p className="text-sm text-muted-foreground font-bold">
                      يرجى تسوية المبلغ المطلوب قبل تاريخ الاستحقاق.
                    </p>
                  </div>

                  <div className="space-y-3 pt-4">
                    {canMarkInvoicePaid && (
                      <button
                        onClick={() => setMarkPaidOpen(true)}
                        className="touch-target w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3"
                        aria-label="تأكيد استلام الدفع"
                      >
                        <CheckCircle className="w-4 h-4" aria-hidden="true" />
                        تأكيد استلام الدفع
                      </button>
                    )}
                    <button
                      onClick={() => initiatePaymentMutation.mutate("manual")}
                      disabled={initiatePaymentMutation.isPending}
                      className="touch-target w-full py-3.5 rounded-2xl bg-primary text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                      {initiatePaymentMutation.isPending
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : (<><CreditCard className="w-4 h-4" aria-hidden="true" />سداد الفاتورة الآن</>)}
                    </button>
                    <button
                      className="touch-target w-full py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-3"
                      aria-label="إرسال تذكير للطالب"
                    >
                      <Send className="w-4 h-4" aria-hidden="true" />
                      إرسال تذكير للطالب
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Quick Info */}
            <div className="glass-card p-5 md:p-8 space-y-4 md:space-y-6">
              <h3 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">معلومات إضافية</h3>
              <div className="space-y-4">
                <QuickInfoRow icon={User} label="الطالب">
                  <Link
                    href={`/dashboard/students/${invoice.student_id}`}
                    className="text-xs font-bold text-white hover:text-primary transition-colors"
                  >
                    عرض الملف الشخصي
                  </Link>
                </QuickInfoRow>

                <QuickInfoRow icon={DollarSign} label="نوع الفاتورة">
                  <p className="text-xs font-bold text-white">
                    {invoice.membership_id ? "اشتراك عضوية" : "خدمة يدوية"}
                  </p>
                </QuickInfoRow>

                {invoice.created_by_name && (
                  <QuickInfoRow icon={User} label="أنشأ الفاتورة">
                    <p className="text-xs font-bold text-white">{invoice.created_by_name}</p>
                  </QuickInfoRow>
                )}

                {invoice.paid_by_name && (
                  <QuickInfoRow icon={CheckCircle} label="استلم المبلغ" iconColor="bg-emerald-500/10 text-emerald-400" labelColor="text-emerald-400">
                    <p className="text-xs font-bold text-white">{invoice.paid_by_name}</p>
                  </QuickInfoRow>
                )}

                {invoice.is_recurring && (
                  <QuickInfoRow icon={Sparkles} label="اشتراك دوري" iconColor="bg-primary/10 text-primary" labelColor="text-primary">
                    <p className="text-xs font-bold text-white">تتكرر هذه الفاتورة تلقائياً</p>
                  </QuickInfoRow>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mark-as-Paid Modal */}
      {markPaidOpen && invoice && (
        <MarkAsPaidModal
          invoiceNumber={invoice.invoice_number}
          isPending={markPaidMutation.isPending}
          onConfirm={(method, note) => markPaidMutation.mutate({ paymentMethod: method, note })}
          onClose={() => setMarkPaidOpen(false)}
        />
      )}
    </PermissionGuard>
  );
}

// ---------------------------------------------------------------------------
// Helper: QuickInfoRow
// ---------------------------------------------------------------------------
function QuickInfoRow({
  icon: Icon,
  label,
  children,
  iconColor = "bg-white/5 text-primary",
  labelColor = "text-muted-foreground",
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
  iconColor?: string;
  labelColor?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", iconColor)} aria-hidden="true">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className={cn("text-[10px] font-black uppercase tracking-widest", labelColor)}>{label}</p>
        {children}
      </div>
    </div>
  );
}
