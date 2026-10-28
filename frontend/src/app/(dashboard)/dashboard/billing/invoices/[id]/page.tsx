"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { api } from "@/lib/api/client";
import {
  ArrowRight, Receipt, Calendar, User, CreditCard,
  Download, Printer, Send, Clock, CheckCircle,
  AlertTriangle, Info, Sparkles, DollarSign, Loader2, Ban,
  RotateCcw, FileText, CheckCircle2,
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
import VoidInvoiceModal from "@/components/dashboard/VoidInvoiceModal";
import RefundInvoiceModal from "@/components/dashboard/RefundInvoiceModal";
import { BatchInvoicePrintModal } from "@/components/dashboard/billing/BatchInvoicePrintModal";
import { printInvoices } from "@/lib/invoice-print-engine";
import { useBillingPermissions } from "@/lib/hooks/use-permission";
import { useTenant } from "@/lib/providers/tenant-provider";

export default function InvoiceDetailPage() {
  const { id }        = useParams();
  const queryClient   = useQueryClient();
  const { tenant }    = useTenant();
  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [voidOpen, setVoidOpen]         = useState(false);
  const [refundOpen, setRefundOpen]     = useState(false);
  const [printOpen, setPrintOpen]       = useState(false);
  const [isPrinting, setIsPrinting]     = useState(false);
  const { canMarkInvoicePaid, canVoidInvoice } = useBillingPermissions();

  const clubInfo = tenant ? {
    name: tenant.name,
    business_name: tenant.business_name || "",
    phone: tenant.phone || "",
    email: tenant.email || "",
    logo: tenant.logo || null,
    currency: tenant.default_currency || "JOD",
    country: tenant.country || "JO",
  } : null;

  const { data: invoice, isLoading, error } = useQuery<Invoice>({
    queryKey: ["billing", "invoices", id],
    queryFn:  () => api.billing.invoices.get(parseInt(id as string)).then((r) => r.data),
  });

  const handlePrint = async () => {
    if (!invoice) return;
    setPrintOpen(true);
  };

  const handleDownloadPdf = async () => {
    if (!invoice) return;
    setIsPrinting(true);
    toast.info("يرجى اختيار 'حفظ بتنسيق PDF' / 'Save as PDF' من نافذة الطباعة", { duration: 4000 });
    try {
      await printInvoices([invoice], { clubInfo });
    } catch (err) {
      toast.error("فشل تجهيز ملف الطباعة");
    } finally {
      setIsPrinting(false);
    }
  };

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
    mutationFn: (data: { paymentMethod: PaymentMethodKey; amount?: number; surplusAction?: "credit" | "change"; note: string }) =>
      api.billing.invoices.markPaid(parseInt(id as string), {
        payment_method: data.paymentMethod,
        amount: data.amount,
        surplus_action: data.surplusAction,
        note: data.note,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["billing", "invoices", id] });
      queryClient.invalidateQueries({ queryKey: ["billing", "invoices"] });
      queryClient.invalidateQueries({ queryKey: ["billing", "summary"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["student"] });

      if (res?.data?.status === "partially_paid") {
        toast.success("تم تسجيل الدفعة الجزئية بنجاح ✓");
      } else if (Number(res?.data?.surplus_amount ?? 0) > 0 && res?.data?.surplus_action === "credit") {
        toast.success(`تم سداد الفاتورة وإيداع فائض ${res.data.surplus_amount} د.أ بمحفظة الطالب ✓`);
      } else {
        toast.success("تم تأكيد السداد بنجاح ✓");
      }
      setMarkPaidOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "فشل تسجيل السداد"),
  });

  const voidMutation = useMutation({
    mutationFn: (data: { reason: string; reason_details: string }) =>
      api.billing.invoices.void(parseInt(id as string), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "invoices", id] });
      queryClient.invalidateQueries({ queryKey: ["billing", "invoices"] });
      queryClient.invalidateQueries({ queryKey: ["billing", "summary"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["student"] });
      queryClient.invalidateQueries({ queryKey: ["student-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["families"] });
      queryClient.invalidateQueries({ queryKey: ["family"] });
      queryClient.invalidateQueries({ queryKey: ["reporting"] });
      toast.success("تم إلغاء الفاتورة بنجاح (Void)");
      setVoidOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "فشل إلغاء الفاتورة"),
  });

  const refundMutation = useMutation({
    mutationFn: (data: {
      amount: number;
      reason: string;
      reason_details: string;
      refund_method: string;
      cancel_membership: boolean;
    }) => api.billing.invoices.refund(parseInt(id as string), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "invoices", id] });
      queryClient.invalidateQueries({ queryKey: ["billing", "invoices"] });
      queryClient.invalidateQueries({ queryKey: ["billing", "summary"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["student"] });
      queryClient.invalidateQueries({ queryKey: ["student-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["families"] });
      queryClient.invalidateQueries({ queryKey: ["family"] });
      queryClient.invalidateQueries({ queryKey: ["reporting"] });
      toast.success("تم إصدار الإشعار الدائن وتسجيل الاسترداد بنجاح ✓");
      setRefundOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "فشل إصدار الإشعار الدائن أو الاسترداد"),
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
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
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
              <ArrowRight className="w-5 h-5" aria-hidden="true" />
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
              onClick={handlePrint}
              className="touch-target flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all active:scale-95"
              aria-label="طباعة الفاتورة"
            >
              <Printer className="w-4 h-4 text-primary" aria-hidden="true" />
              <span className="hidden xs:inline">طباعة</span>
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={isPrinting}
              className="touch-target flex items-center gap-2 px-4 md:px-6 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all active:scale-95 disabled:opacity-50"
              aria-label="تحميل الفاتورة بصيغة PDF"
            >
              {isPrinting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4 text-primary" aria-hidden="true" />
              )}
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
                <div className="sm:text-end">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">تاريخ الاستحقاق</p>
                  <p className={cn("text-base md:text-lg font-black", isOverdue ? "text-red-400" : "text-white")}>
                    {formatDate(invoice.due_date)}
                  </p>
                </div>
              </div>

              {/* Status Banners */}
              {invoice.status === "void" && (
                <div className="mx-5 md:mx-8 mt-5 md:mt-8 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
                  <div className="flex items-start gap-3">
                    <Ban className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="text-sm font-black text-rose-200">فاتورة ملغاة نهائياً (VOID)</h4>
                      <p className="text-xs text-rose-300/90 leading-relaxed">
                        تم إلغاء هذه الفاتورة رسمياً دون أي أثر مالي، وتم إلغاء أي اشتراك مرتبط بها فورياً.
                        {invoice.voided_at && ` [تاريخ الإلغاء: ${formatDate(invoice.voided_at)}]`}
                        {invoice.voided_by_name && ` [بواسطة: ${invoice.voided_by_name}]`}
                      </p>
                      {invoice.void_reason && (
                        <p className="text-xs font-bold text-rose-200">
                          سبب الإلغاء: {invoice.void_reason}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {invoice.status === "refunded" && (
                <div className="mx-5 md:mx-8 mt-5 md:mt-8 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300">
                  <div className="flex items-start gap-3">
                    <RotateCcw className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-black text-amber-200">فاتورة مستردة بالكامل (REFUNDED)</h4>
                      <p className="text-xs text-amber-300/90 mt-0.5 leading-relaxed">
                        تم استرداد كامل المبلغ المدفوع وإصدار إشعار دائن رسمي مرقم وفق المعايير المحاسبية المعتمدة.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Line items */}
              <div className="p-5 md:p-8 space-y-8 md:space-y-10">
                <div className="space-y-3">
                  <div className="grid grid-cols-4 px-3 md:px-4 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] md:tracking-[0.2em] border-b border-white/5">
                    <div className="col-span-2">الوصف</div>
                    <div className="text-center">الكمية</div>
                    <div className="text-end">المبلغ</div>
                  </div>
                  <div className="grid grid-cols-4 px-3 md:px-4 py-3 md:py-4 items-center">
                    <div className="col-span-2">
                      <p className="text-sm font-bold text-white">رسوم اشتراك / خدمات</p>
                      {invoice.notes && <p className="text-xs text-muted-foreground mt-1">{invoice.notes}</p>}
                    </div>
                    <div className="text-center text-sm font-bold text-white">1</div>
                    <div className="text-end text-sm font-black text-white">
                      <bdi>
                        {formatCurrency(invoice.subtotal, invoice.currency)}
                      </bdi>
                    </div>
                  </div>
                </div>

                {/* Totals */}
                <div className="flex justify-end">
                  <div className="w-full max-w-xs space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground font-bold">المبلغ الفرعي</span>
                      <bdi className="text-white font-black">{formatCurrency(invoice.subtotal, invoice.currency)}</bdi>
                    </div>
                    {invoice.discount_amount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-red-400 font-bold">الخصم</span>
                        <bdi className="text-red-400 font-black">-{formatCurrency(invoice.discount_amount, invoice.currency)}</bdi>
                      </div>
                    )}
                    {invoice.tax_amount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground font-bold">الضريبة ({invoice.tax_rate}%)</span>
                        <bdi className="text-white font-black">{formatCurrency(invoice.tax_amount, invoice.currency)}</bdi>
                      </div>
                    )}
                    <div className="pt-4 border-t border-white/10 flex justify-between">
                      <span className="text-white font-black text-base md:text-lg">الإجمالي</span>
                      <bdi className="text-primary font-black text-xl md:text-2xl">{formatCurrency(invoice.total_amount, invoice.currency)}</bdi>
                    </div>
                    {invoice.amount_paid > 0 && (
                      <div className="flex justify-between text-sm pt-2">
                        <span className="text-emerald-400 font-bold">المبلغ المدفوع</span>
                        <bdi className="text-emerald-400 font-black">{formatCurrency(invoice.amount_paid, invoice.currency)}</bdi>
                      </div>
                    )}
                    {invoice.status !== "paid" && invoice.status !== "refunded" && invoice.status !== "void" && (
                      <div className="p-3 md:p-4 rounded-2xl bg-primary/5 border border-primary/10 flex justify-between mt-4">
                        <span className="text-primary font-black text-xs md:text-sm uppercase tracking-widest">المتبقي للدفع</span>
                        <bdi className="text-primary font-black">{formatCurrency(invoice.amount_due, invoice.currency)}</bdi>
                      </div>
                    )}
                  </div>
                </div>

                {/* Credit Notes List */}
                {invoice.credit_notes && invoice.credit_notes.length > 0 && (
                  <div className="pt-6 border-t border-white/5 space-y-3">
                    <h3 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                      <FileText className="w-4 h-4 text-amber-400" />
                      الإشعارات الدائنة الصادرة (Credit Notes)
                    </h3>
                    <div className="space-y-2.5">
                      {invoice.credit_notes.map((cnItem) => (
                        <div
                          key={cnItem.id}
                          className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-amber-400 font-mono tracking-wider">{cnItem.credit_note_number}</span>
                              <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-300 text-[10px] font-bold">
                                {cnItem.refund_method_display || cnItem.refund_method}
                              </span>
                            </div>
                            <p className="text-muted-foreground">
                              {cnItem.reason_display || cnItem.reason}
                              {cnItem.reason_details ? ` — ${cnItem.reason_details}` : ""}
                            </p>
                            <p className="text-[10px] text-muted-foreground/70">
                              {formatDate(cnItem.issued_at)} {cnItem.issued_by_name ? `بواسطة ${cnItem.issued_by_name}` : ""}
                            </p>
                          </div>
                          <div className="sm:text-end shrink-0">
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">مبلغ الإشعار</p>
                            <p className="text-sm font-black text-amber-400">
                              {formatCurrency(cnItem.amount, cnItem.currency)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
              {invoice.status === "void" ? (
                <>
                  <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 mx-auto" aria-hidden="true">
                    <Ban className="w-8 h-8 md:w-10 md:h-10" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-base md:text-lg font-black text-white mb-1.5">فاتورة ملغاة (Void)</h3>
                    <p className="text-sm text-muted-foreground font-bold">
                      تم إلغاء هذه الفاتورة ولا توجد مطالبات أو التزامات مالية.
                    </p>
                  </div>
                </>
              ) : invoice.status === "refunded" ? (
                <>
                  <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 mx-auto" aria-hidden="true">
                    <RotateCcw className="w-8 h-8 md:w-10 md:h-10" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-base md:text-lg font-black text-white mb-1.5">مستردة بالكامل</h3>
                    <p className="text-sm text-muted-foreground font-bold">
                      تم استرداد المبلغ بالكامل وإصدار إشعار دائن رسمي.
                    </p>
                  </div>
                </>
              ) : invoice.status === "paid" ? (
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

                  {canVoidInvoice && (
                    <div className="space-y-3 pt-4 border-t border-white/5">
                      <button
                        onClick={() => setRefundOpen(true)}
                        className="touch-target w-full py-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 text-amber-400 font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                        aria-label="إصدار إشعار دائن واسترداد"
                      >
                        <RotateCcw className="w-4 h-4" />
                        إصدار إشعار دائن / استرداد (Credit Note)
                      </button>
                    </div>
                  )}
                </>
              ) : invoice.status === "partially_paid" ? (
                <>
                  <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 mx-auto" aria-hidden="true">
                    <Clock className="w-8 h-8 md:w-10 md:h-10" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-base md:text-lg font-black text-white mb-1.5">مسددة جزئياً</h3>
                    <p className="text-sm text-muted-foreground font-bold">
                      تم سداد جزء من المبلغ والمتبقي: {formatCurrency(invoice.amount_due, invoice.currency)}
                    </p>
                  </div>

                  <div className="space-y-3 pt-4">
                    {canMarkInvoicePaid && (
                      <button
                        onClick={() => setMarkPaidOpen(true)}
                        className="touch-target w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3"
                      >
                        <CheckCircle className="w-4 h-4" aria-hidden="true" />
                        سداد المتبقي
                      </button>
                    )}
                    {canVoidInvoice && (
                      <button
                        onClick={() => setRefundOpen(true)}
                        className="touch-target w-full py-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 text-amber-400 font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                      >
                        <RotateCcw className="w-4 h-4" />
                        إصدار إشعار دائن واسترداد
                      </button>
                    )}
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

                    {canVoidInvoice && (
                      <button
                        onClick={() => setVoidOpen(true)}
                        disabled={voidMutation.isPending}
                        className="touch-target w-full py-3 rounded-2xl border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-400 font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        aria-label="إلغاء الفاتورة"
                      >
                        <Ban className="w-4 h-4" />
                        إلغاء الفاتورة (Void)
                      </button>
                    )}
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

                {invoice.voided_by_name && (
                  <QuickInfoRow icon={Ban} label="ألغى الفاتورة" iconColor="bg-rose-500/10 text-rose-400" labelColor="text-rose-400">
                    <p className="text-xs font-bold text-white">{invoice.voided_by_name}</p>
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
          totalAmount={Number(invoice.total_amount)}
          amountPaid={Number(invoice.amount_paid)}
          currency={invoice.currency}
          isPending={markPaidMutation.isPending}
          onConfirm={(data) => markPaidMutation.mutate(data)}
          onClose={() => setMarkPaidOpen(false)}
        />
      )}

      {/* Void Invoice Modal */}
      {voidOpen && invoice && (
        <VoidInvoiceModal
          invoice={invoice}
          isPending={voidMutation.isPending}
          onConfirm={(data) => voidMutation.mutate(data)}
          onClose={() => setVoidOpen(false)}
        />
      )}

      {/* Refund Invoice Modal */}
      {refundOpen && invoice && (
        <RefundInvoiceModal
          invoiceNumber={invoice.invoice_number}
          totalAmount={invoice.total_amount}
          amountPaid={invoice.amount_paid}
          currency={invoice.currency}
          hasMembership={!!invoice.membership_id}
          isPending={refundMutation.isPending}
          onConfirm={(data) => refundMutation.mutate(data)}
          onClose={() => setRefundOpen(false)}
        />
      )}

      {/* Print / Preview Modal */}
      {printOpen && invoice && (
        <BatchInvoicePrintModal
          open={printOpen}
          onClose={() => setPrintOpen(false)}
          invoices={[invoice]}
          clubInfo={clubInfo}
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
