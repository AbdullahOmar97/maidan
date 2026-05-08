"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { 
  ArrowRight, Receipt, Calendar, User, CreditCard, 
  Download, Printer, Send, Clock, CheckCircle, 
  AlertTriangle, Info, Sparkles, DollarSign
} from "lucide-react";
import Link from "next/link";
import { 
  formatCurrency, formatDate, getStatusBadgeClass, 
  getStatusLabel, cn, isInvoiceOverdue 
} from "@/lib/utils";
import type { Invoice } from "@/types";
import { toast } from "sonner";
import { PermissionGuard } from "@/components/dashboard/permission-guard";
import MarkAsPaidModal, { type PaymentMethodKey } from "@/components/dashboard/MarkAsPaidModal";
import { useBillingPermissions } from "@/lib/hooks/use-permission";

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const { canMarkInvoicePaid } = useBillingPermissions();
  const canMarkPaid = canMarkInvoicePaid;

  const { data: invoice, isLoading, error } = useQuery<Invoice>({
    queryKey: ["billing", "invoices", id],
    queryFn: () => api.billing.invoices.get(parseInt(id as string)).then((r) => r.data),
  });

  const initiatePaymentMutation = useMutation({
    mutationFn: (provider: string) => 
      api.billing.payments.initiate({
        invoice_id: parseInt(id as string),
        provider,
        return_url: window.location.href,
      }).then(r => r.data),
    onSuccess: (data) => {
      if (data.redirect_url) {
        window.location.href = data.redirect_url;
      } else if (data.status === "success") {
        toast.success("تم الدفع بنجاح");
        queryClient.invalidateQueries({ queryKey: ["billing", "invoices", id] });
      }
    },
    onError: () => {
      toast.error("فشل بدء عملية الدفع");
    }
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
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "فشل تأكيد السداد");
    },
  });

  if (isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-6">
          <AlertTriangle className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-white">الفاتورة غير موجودة</h2>
        <p className="text-muted-foreground mt-2">لم نتمكن من العثور على الفاتورة المطلوبة.</p>
        <Link href="/dashboard/billing" className="mt-8 text-primary font-black flex items-center gap-2">
          <ArrowRight className="w-4 h-4 rtl-flip" />
          العودة لقائمة الفواتير
        </Link>
      </div>
    );
  }

  const isOverdue = isInvoiceOverdue(invoice.status, invoice.due_date);

  return (
    <PermissionGuard permission="can_view_billing">
    <div className="max-w-4xl mx-auto space-y-10 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <Link
            href="/dashboard/billing"
            className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-white transition-all active:scale-90 shadow-xl"
          >
            <ArrowRight className="w-6 h-6 rtl-flip" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black text-white tracking-tight">{invoice.invoice_number}</h1>
              <span className={cn("px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border shadow-lg", getStatusBadgeClass(isOverdue ? "overdue" : invoice.status))}>
                {getStatusLabel(isOverdue ? "overdue" : invoice.status)}
              </span>
            </div>
            <p className="text-muted-foreground text-sm font-bold mt-1 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              تاريخ الإصدار: {formatDate(invoice.created_at)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => window.print()}
            className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-all active:scale-90"
            title="طباعة"
          >
            <Printer className="w-5 h-5" />
          </button>
          <button 
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all active:scale-95"
          >
            <Download className="w-4 h-4" />
            تحميل PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Invoice Card */}
        <div className="lg:col-span-2 space-y-8">
          <div className="glass-card overflow-hidden">
            <div className="p-8 bg-white/[0.02] border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl gradient-brand flex items-center justify-center text-white shadow-xl shadow-primary/20 rotate-3">
                  <Receipt className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">فاتورة للطالب</p>
                  <h2 className="text-xl font-black text-white">{invoice.student_name}</h2>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">تاريخ الاستحقاق</p>
                <p className={cn("text-lg font-black", isOverdue ? "text-red-400" : "text-white")}>
                  {formatDate(invoice.due_date)}
                </p>
              </div>
            </div>

            <div className="p-8 space-y-10">
              {/* Line Items Table */}
              <div className="space-y-4">
                <div className="grid grid-cols-4 px-4 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] border-b border-white/5">
                  <div className="col-span-2">الوصف</div>
                  <div className="text-center">الكمية</div>
                  <div className="text-left">المبلغ</div>
                </div>
                <div className="grid grid-cols-4 px-4 py-4 items-center group">
                  <div className="col-span-2">
                    <p className="text-sm font-bold text-white">رسوم اشتراك / خدمات</p>
                    {invoice.notes && <p className="text-xs text-muted-foreground mt-1">{invoice.notes}</p>}
                  </div>
                  <div className="text-center text-sm font-bold text-white">1</div>
                  <div className="text-left text-sm font-black text-white" dir="ltr">{formatCurrency(invoice.subtotal, invoice.currency)}</div>
                </div>
              </div>

              {/* Totals Section */}
              <div className="flex justify-end pt-10">
                <div className="w-full max-w-xs space-y-4">
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
                    <span className="text-white font-black text-lg">الإجمالي</span>
                    <span className="text-primary font-black text-2xl" dir="ltr">{formatCurrency(invoice.total_amount, invoice.currency)}</span>
                  </div>
                  
                  {invoice.amount_paid > 0 && (
                    <div className="flex justify-between text-sm pt-2">
                      <span className="text-emerald-400 font-bold">المبلغ المدفوع</span>
                      <span className="text-emerald-400 font-black" dir="ltr">{formatCurrency(invoice.amount_paid, invoice.currency)}</span>
                    </div>
                  )}

                  {invoice.status !== "paid" && (
                    <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex justify-between mt-6">
                      <span className="text-primary font-black text-sm uppercase tracking-widest">المتبقي للدفع</span>
                      <span className="text-primary font-black" dir="ltr">{formatCurrency(invoice.amount_due, invoice.currency)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Status Message */}
            <div className="p-8 bg-white/[0.01] border-t border-white/5">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Info className="w-4 h-4 text-primary" />
                <p className="text-xs font-bold">تم إنشاء هذه الفاتورة آلياً بواسطة نظام ميدان (MAIDAN)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Actions */}
        <div className="space-y-8">
          {/* Status Context Card */}
          <div className="glass-card p-8 space-y-6 relative overflow-hidden">
             {invoice.status === "paid" ? (
               <>
                 <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mx-auto mb-4">
                   <CheckCircle className="w-10 h-10" />
                 </div>
                 <div className="text-center">
                   <h3 className="text-lg font-black text-white mb-2">تم سداد الفاتورة</h3>
                   <p className="text-sm text-muted-foreground font-bold">تم تأكيد الدفع بتاريخ {invoice.paid_at ? formatDate(invoice.paid_at) : formatDate(invoice.created_at)}</p>
                 </div>
               </>
             ) : (
               <>
                 <div className={cn(
                   "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4",
                   isOverdue ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"
                 )}>
                   {isOverdue ? <AlertTriangle className="w-10 h-10" /> : <Clock className="w-10 h-10" />}
                 </div>
                 <div className="text-center">
                   <h3 className="text-lg font-black text-white mb-2">{isOverdue ? "الفاتورة متأخرة" : "انتظار السداد"}</h3>
                   <p className="text-sm text-muted-foreground font-bold">يرجى تسوية المبلغ المطلوب قبل تاريخ الاستحقاق لتجنب تعليق الخدمة.</p>
                 </div>
                 
                 <div className="space-y-3 pt-6">
                    {canMarkPaid && (
                      <button
                        onClick={() => setMarkPaidOpen(true)}
                        className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3"
                      >
                        <CheckCircle className="w-4 h-4" />
                        تأكيد استلام الدفع
                      </button>
                    )}
                    <button 
                      onClick={() => initiatePaymentMutation.mutate("manual")}
                      disabled={initiatePaymentMutation.isPending}
                      className="w-full py-4 rounded-2xl bg-primary text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3"
                    >
                      {initiatePaymentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                        <>
                          <CreditCard className="w-4 h-4" />
                          سداد الفاتورة الآن
                        </>
                      )}
                    </button>
                    <button className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-3">
                      <Send className="w-4 h-4" />
                      إرسال تذكير للطالب
                    </button>
                 </div>
               </>
             )}
          </div>

          {/* Quick Info */}
          <div className="glass-card p-8 space-y-6">
            <h3 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">معلومات إضافية</h3>
            <div className="space-y-4">
               <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-primary">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">الطالب</p>
                    <Link href={`/dashboard/students/${invoice.student_id}`} className="text-xs font-bold text-white hover:text-primary transition-colors">
                      عرض الملف الشخصي
                    </Link>
                  </div>
               </div>
               <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-primary">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">نوع الفاتورة</p>
                    <p className="text-xs font-bold text-white">{invoice.membership_id ? "اشتراك عضوية" : "خدمة يدوية"}</p>
                  </div>
               </div>
               {invoice.created_by_name && (
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-primary">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">أنشأ الفاتورة</p>
                      <p className="text-xs font-bold text-white">{invoice.created_by_name}</p>
                    </div>
                 </div>
               )}
               {invoice.paid_by_name && (
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] text-emerald-400 font-black uppercase tracking-widest">استلم المبلغ</p>
                      <p className="text-xs font-bold text-white">{invoice.paid_by_name}</p>
                    </div>
                 </div>
               )}
               {invoice.is_recurring && (
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] text-primary font-black uppercase tracking-widest">اشتراك دوري</p>
                      <p className="text-xs font-bold text-white">تتكرر هذه الفاتورة تلقائياً</p>
                    </div>
                 </div>
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
