"use client";

import { useState } from "react";
import {
  Ban,
  Loader2,
  AlertTriangle,
  DollarSign,
  CalendarX,
  ShoppingBag,
  Award,
  UserCheck,
  FileText,
  Info,
} from "lucide-react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { FormField, Textarea, Select } from "@/components/ui/form-field";
import { formatCurrency } from "@/lib/utils";
import type { Invoice } from "@/types";

interface VoidInvoiceModalProps {
  invoice: Invoice;
  isPending: boolean;
  onConfirm: (data: { reason: string; reason_details: string }) => void;
  onClose: () => void;
}

const VOID_REASONS = [
  { value: "data_entry_error", label: "خطأ في إدخال الفاتورة / المبالغ (Data Entry Error)" },
  { value: "duplicate_invoice", label: "فاتورة مكررة لنفس الطالب (Duplicate Invoice)" },
  { value: "student_withdrawal", label: "انسحاب الطالب / إلغاء التسجيل (Student Withdrawal)" },
  { value: "service_modification", label: "تعديل الباقة أو الخطة التدريبية (Plan Modification)" },
  { value: "other", label: "سبب آخر (Other Reason)" },
];

export default function VoidInvoiceModal({
  invoice,
  isPending,
  onConfirm,
  onClose,
}: VoidInvoiceModalProps) {
  const [reason, setReason] = useState("data_entry_error");
  const [reasonDetails, setReasonDetails] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      reason,
      reason_details: reasonDetails.trim(),
    });
  };

  const hasMembership = !!invoice.membership_id || !!invoice.plan_name;
  const hasStoreOrders = (invoice.store_orders_count ?? 0) > 0;
  const hasExamCandidacies =
    (invoice.exam_candidacies_count ?? 0) > 0 ||
    invoice.notes?.includes("اختبار") ||
    invoice.notes?.includes("ترقية");
  const isSuspended = invoice.student_status === "suspended";

  return (
    <Modal open onClose={onClose} size="md" disableBackdropClose={isPending}>
      <ModalHeader
        icon={<Ban className="w-5 h-5" />}
        iconColor="bg-rose-500/15 text-rose-400"
        title="إلغاء الفاتورة نهائياً (Void Invoice)"
        subtitle={`${invoice.invoice_number} — ${invoice.student_name}`}
        onClose={onClose}
      />

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <ModalBody className="space-y-4">
          {/* Main Warning Banner */}
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">تأكيد عملية الإلغاء المحاسبي:</p>
              <p className="text-rose-200/80 leading-relaxed">
                سيتم اعتبار هذه الفاتورة لاغية (Void) في السجلات المحاسبية والضريبية. راجع أدناه جميع العناصر التي ستتأثر تلقائياً بهذا الإجراء:
              </p>
            </div>
          </div>

          {/* Impact Preview Section */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-primary">
              <Info className="w-4 h-4" />
              <span>ما الذي سيتأثر تلقائياً بإلغاء هذه الفاتورة؟</span>
            </div>

            <div className="space-y-2.5 pt-1 text-xs">
              {/* 1. Financial Dues Drop */}
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-200">
                <DollarSign className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold text-white">الذمة المالية والمستحقات: </span>
                  سيتم إسقاط مبلغ{" "}
                  <b className="text-emerald-400 font-black">
                    {formatCurrency(invoice.total_amount, invoice.currency)}
                  </b>{" "}
                  بالكامل وتصفير المبلغ المتبقي، ولن يُحسب أي جزء منه كدين أو مستحق على الطالب.
                </div>
              </div>

              {/* 2. Membership Subscription Cancellation */}
              {hasMembership && (
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200">
                  <CalendarX className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <span className="font-bold text-white">اشتراك العضوية: </span>
                    سيتم إلغاء باقة الاشتراك{" "}
                    <b className="text-amber-300 font-black">
                      ({invoice.plan_name || "الاشتراك المرتبط"})
                    </b>{" "}
                    فوراً، وإيقاف التجديد التلقائي ومنع تسجيل الحضور للتمارين لحين تجديد الاشتراك.
                  </div>
                </div>
              )}

              {/* 3. Store Orders and Stock */}
              {hasStoreOrders && (
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-200">
                  <ShoppingBag className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <span className="font-bold text-white">طلبات المتجر: </span>
                    سيتم إلغاء الطلبات المرتبطة وإعادة كميات المنتجات فوراً إلى مخزون المتجر.
                  </div>
                </div>
              )}

              {/* 4. Belt Exam / Promotion */}
              {hasExamCandidacies && (
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-200">
                  <Award className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <span className="font-bold text-white">اختبارات وترقيات الأحزمة: </span>
                    سيتم إسقاط رسوم الترقية/الاختبار وفك ارتباط الفاتورة بطلب ترقية الطالب.
                  </div>
                </div>
              )}

              {/* 5. Student Status Reactivation */}
              {isSuspended && (
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-200">
                  <UserCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <span className="font-bold text-white">حساب الطالب المعلق: </span>
                    سيتم رفع التعليق المالي عن الطالب وإعادته للحالة النشطة (Active) تلقائياً في حال عدم وجود متأخرات مالية أخرى.
                  </div>
                </div>
              )}

              {/* 6. Tax & Accounting Audit */}
              <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/5 text-muted-foreground text-[11px]">
                <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-semibold text-white/80">التوثيق المحاسبي: </span>
                  سيتضمن السجل المحاسبي اسمك، سبب الإلغاء، وتاريخ الإجراء للتدقيق والامتثال الضريبي.
                </div>
              </div>
            </div>
          </div>

          <FormField label="سبب الإلغاء" required>
            <Select
              value={reason}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setReason(e.target.value)}
              className="w-full"
            >
              {VOID_REASONS.map((r) => (
                <option key={r.value} value={r.value} className="bg-slate-900 text-white">
                  {r.label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="ملاحظات وتفاصيل إضافية" hint="اختياري — للتوثيق والتدقيق المحاسبي الداخلي">
            <Textarea
              placeholder="اكتب توضيحاً إضافياً لسبب الإلغاء..."
              value={reasonDetails}
              onChange={(e) => setReasonDetails(e.target.value)}
              rows={2}
            />
          </FormField>
        </ModalBody>

        <ModalFooter>
          <div className="flex gap-2.5 justify-end w-full">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2.5 rounded-xl border border-white/10 text-white text-xs font-bold hover:bg-white/5 transition-all"
            >
              تراجع
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-black transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
              تأكيد إلغاء الفاتورة
            </button>
          </div>
        </ModalFooter>
      </form>
    </Modal>
  );
}
