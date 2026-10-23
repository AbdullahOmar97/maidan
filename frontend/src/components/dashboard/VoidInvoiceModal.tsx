"use client";

import { useState } from "react";
import { Ban, Loader2, AlertTriangle } from "lucide-react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { FormField, Textarea, Select } from "@/components/ui/form-field";

interface VoidInvoiceModalProps {
  invoiceNumber: string;
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
  invoiceNumber,
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

  return (
    <Modal open onClose={onClose} size="sm" disableBackdropClose={isPending}>
      <ModalHeader
        icon={<Ban className="w-5 h-5" />}
        iconColor="bg-rose-500/15 text-rose-400"
        title="إلغاء الفاتورة (Void Invoice)"
        subtitle={invoiceNumber}
        onClose={onClose}
      />

      <form onSubmit={handleSubmit}>
        <ModalBody className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">تنبيه محاسبي وتنظيمي:</p>
              <p className="text-rose-200/80 leading-relaxed">
                سيتم إلغاء الفاتورة نهائياً واعتبارها لاغية (Void) في السجلات الضريبية والمحاسبية، كما سيتم إلغاء أي اشتراك مرتبط بها فوراً لمنع تسجيل الحضور غير المصرح به.
              </p>
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
              rows={3}
            />
          </FormField>
        </ModalBody>

        <ModalFooter>
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
        </ModalFooter>
      </form>
    </Modal>
  );
}
