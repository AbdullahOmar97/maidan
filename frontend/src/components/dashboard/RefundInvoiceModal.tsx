"use client";

import { useState } from "react";
import { RotateCcw, Loader2, FileText, CheckCircle2 } from "lucide-react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { FormField, Input, Textarea, Select } from "@/components/ui/form-field";
import { formatCurrency } from "@/lib/utils";

interface RefundInvoiceModalProps {
  invoiceNumber: string;
  totalAmount: number;
  amountPaid: number;
  currency: string;
  hasMembership: boolean;
  isPending: boolean;
  onConfirm: (data: {
    amount: number;
    reason: string;
    reason_details: string;
    refund_method: string;
    cancel_membership: boolean;
  }) => void;
  onClose: () => void;
}

const REFUND_REASONS = [
  { value: "data_entry_error", label: "خطأ في إدخال الفاتورة (Data Entry Error)" },
  { value: "duplicate_invoice", label: "فاتورة مكررة تم سدادها (Duplicate Paid Invoice)" },
  { value: "student_withdrawal", label: "انسحاب الطالب / استرداد الرسوم (Student Withdrawal)" },
  { value: "service_modification", label: "تعديل الباقة أو الخدمة (Service Modification)" },
  { value: "overcharge_correction", label: "تصحيح فرق المبلغ الزائد (Overcharge Correction)" },
  { value: "other", label: "سبب آخر (Other Reason)" },
];

const REFUND_METHODS = [
  { value: "cash", label: "نقداً من الصندوق (Cash)" },
  { value: "bank_transfer", label: "تحويل بنكي (Bank Transfer)" },
  { value: "card_reversal", label: "استرداد على البطاقة (Card Reversal)" },
  { value: "account_credit", label: "رصيد دائن في حساب الطالب (Student Account Credit)" },
  { value: "other", label: "وسيلة أخرى (Other)" },
];

export default function RefundInvoiceModal({
  invoiceNumber,
  totalAmount,
  amountPaid,
  currency,
  hasMembership,
  isPending,
  onConfirm,
  onClose,
}: RefundInvoiceModalProps) {
  const [amount, setAmount] = useState<number>(amountPaid);
  const [reason, setReason] = useState("data_entry_error");
  const [refundMethod, setRefundMethod] = useState("cash");
  const [reasonDetails, setReasonDetails] = useState("");
  const [cancelMembership, setCancelMembership] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0 || amount > amountPaid) {
      return;
    }
    onConfirm({
      amount: Number(amount),
      reason,
      refund_method: refundMethod,
      reason_details: reasonDetails.trim(),
      cancel_membership: cancelMembership,
    });
  };

  return (
    <Modal open onClose={onClose} size="md" disableBackdropClose={isPending}>
      <ModalHeader
        icon={<RotateCcw className="w-5 h-5" />}
        iconColor="bg-amber-500/15 text-amber-400"
        title="إصدار إشعار دائن واسترداد (Credit Note & Refund)"
        subtitle={invoiceNumber}
        onClose={onClose}
      />

      <form onSubmit={handleSubmit}>
        <ModalBody className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-3">
            <FileText className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">المعايير المحاسبية المعتمدة (IFRS / ZATCA):</p>
              <p className="text-amber-200/80 leading-relaxed">
                لا يجوز محاسبياً حذف أو إلغاء فاتورة تم سدادها. سيتم إصدار إشعار دائن رسمي مرقم (Credit Note) يعكس القيد المالي، ويحدث حالة الفاتورة وحسابات الصندوق.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/5">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">إجمالي الفاتورة</p>
              <p className="text-sm font-black text-white mt-0.5">
                {formatCurrency(totalAmount, currency)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">المبلغ المدفوع القابل للاسترداد</p>
              <p className="text-sm font-black text-emerald-400 mt-0.5">
                {formatCurrency(amountPaid, currency)}
              </p>
            </div>
          </div>

          <FormField
            label="مبلغ الاسترداد"
            required
            hint={`الحد الأقصى: ${formatCurrency(amountPaid, currency)}`}
          >
            <div className="flex gap-2">
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max={amountPaid}
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                required
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => setAmount(amountPaid)}
                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white hover:bg-white/10 shrink-0 transition-colors"
              >
                كامل المبلغ
              </button>
            </div>
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="طريقة الاسترداد / الإرجاع" required>
              <Select
                value={refundMethod}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRefundMethod(e.target.value)}
                className="w-full"
              >
                {REFUND_METHODS.map((m) => (
                  <option key={m.value} value={m.value} className="bg-slate-900 text-white">
                    {m.label}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="سبب الاسترداد / الإشعار الدائن" required>
              <Select
                value={reason}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setReason(e.target.value)}
                className="w-full"
              >
                {REFUND_REASONS.map((r) => (
                  <option key={r.value} value={r.value} className="bg-slate-900 text-white">
                    {r.label}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <FormField label="ملاحظات تفصيلية" hint="اختياري — تظهر في سجل الإشعار الدائن">
            <Textarea
              placeholder="اكتب تفاصيل إضافية لتوضيح أسباب إصدار هذا الإشعار..."
              value={reasonDetails}
              onChange={(e) => setReasonDetails(e.target.value)}
              rows={2}
            />
          </FormField>

          {hasMembership && (
            <label className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 cursor-pointer hover:bg-white/[0.04] transition-colors">
              <input
                type="checkbox"
                checked={cancelMembership}
                onChange={(e) => setCancelMembership(e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-primary focus:ring-primary focus:ring-offset-0"
              />
              <div className="text-xs">
                <span className="font-bold text-white">إلغاء اشتراك الطالب المرتبط بهذه الفاتورة</span>
                <p className="text-muted-foreground text-[11px] mt-0.5">
                  إلغاء تفعيل العضوية فورياً لمنع تسجيل الحضور بعد استرداد الرسوم
                </p>
              </div>
            </label>
          )}
        </ModalBody>

        <ModalFooter>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2.5 rounded-xl border border-white/10 text-white text-xs font-bold hover:bg-white/5 transition-all"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={isPending || amount <= 0 || amount > amountPaid}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            إصدار إشعار دائن وتأكيد الاسترداد
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
