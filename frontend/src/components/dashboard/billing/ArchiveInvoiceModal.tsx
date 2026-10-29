"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import {
  Archive,
  AlertTriangle,
  CreditCard,
  Calendar,
  Loader2,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import { cn, formatCurrency, parseApiError } from "@/lib/utils";
import type { ArchiveInvoicePrecheckData } from "@/types";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { FormField, Textarea, ErrorBanner } from "@/components/ui/form-field";
import { toast } from "sonner";

interface ArchiveInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: number;
  invoiceNumber: string;
  onArchived?: () => void;
}

const INVOICE_REASON_PRESETS = [
  { value: "أرشفة فاتورة مسددة ومكتملة", label: "أرشفة فاتورة مسددة ومكتملة" },
  { value: "إغلاق دورة محاسبية / سنة مالية منتهية", label: "إغلاق دورة محاسبية / سنة مالية منتهية" },
  { value: "أرشفة فاتورة ملغاة رسمياً (Void)", label: "أرشفة فاتورة ملغاة رسمياً (Void)" },
  { value: "أرشفة بعد الاسترداد الكامل (Refunded)", label: "أرشفة بعد الاسترداد الكامل (Refunded)" },
  { value: "إعدام دين / تعذر التحصيل (Bad Debt)", label: "إعدام دين / تعذر التحصيل (Bad Debt)" },
  { value: "تسوية محاسبية إدارية معتمدة", label: "تسوية محاسبية إدارية معتمدة" },
  { value: "أخرى", label: "سبب آخر (موضح في الملاحظات)" },
];

export default function ArchiveInvoiceModal({
  isOpen,
  onClose,
  invoiceId,
  invoiceNumber,
  onArchived,
}: ArchiveInvoiceModalProps) {
  const queryClient = useQueryClient();
  const [selectedReason, setSelectedReason] = useState<string>("أرشفة فاتورة مسددة ومكتملة");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [forceWithDebt, setForceWithDebt] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const {
    data: precheck,
    isLoading: isLoadingPrecheck,
    isError: isPrecheckError,
  } = useQuery<ArchiveInvoicePrecheckData>({
    queryKey: ["archive-invoice-precheck", invoiceId],
    queryFn: () => api.billing.invoices.archivePrecheck(invoiceId).then((r: any) => r.data),
    enabled: isOpen,
  });

  const archiveMutation = useMutation({
    mutationFn: () => {
      const fullReason = additionalNotes.trim()
        ? `${selectedReason}: ${additionalNotes.trim()}`
        : selectedReason;

      return api.billing.invoices.archive(invoiceId, {
        reason: fullReason,
        force_with_debt: forceWithDebt,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "invoices"] });
      queryClient.invalidateQueries({ queryKey: ["billing", "invoices", invoiceId.toString()] });
      queryClient.invalidateQueries({ queryKey: ["archive-invoice-precheck", invoiceId] });
      toast.success("تمت أرشفة الفاتورة بنجاح وفق المعايير المحاسبية");
      onClose();
      onArchived?.();
    },
    onError: (err: any) => {
      console.error("Archive invoice error:", err);
      const parsed = parseApiError(err, "حدث خطأ أثناء أرشفة الفاتورة.");
      setErrorMsg(parsed);
      toast.error(parsed);
    },
  });

  const hasDue = (precheck?.amount_due ?? 0) > 0 && !["void", "refunded"].includes(precheck?.status || "");
  const isSubmitDisabled =
    archiveMutation.isPending ||
    isLoadingPrecheck ||
    (hasDue && !forceWithDebt);

  return (
    <Modal open={isOpen} onClose={onClose} size="md">
      <ModalHeader
        icon={<Archive className="w-5 h-5 text-amber-500" />}
        title="أرشفة الفاتورة"
        subtitle={invoiceNumber}
        onClose={onClose}
      />

      <ModalBody className="space-y-4">
        {errorMsg && <ErrorBanner message={errorMsg} />}

        {isLoadingPrecheck ? (
          <div className="py-10 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
            <p className="text-xs font-bold">جاري مراجعة القيود المحاسبية للفاتورة...</p>
          </div>
        ) : isPrecheckError ? (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            تعذر فحص الفاتورة أولياً. يرجى إعادة المحاولة.
          </div>
        ) : (
          <>
            {/* Regulatory Notice */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-start">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-200/90 leading-relaxed space-y-1">
                <p className="font-bold">معايير الامتثال المالي والضريبي:</p>
                <p>
                  لا يتم حذف الفواتير نهائياً للحفاظ على التسلسل الرقمي ودفاتر القيود والامتثال الضريبي. الأرشفة تنقل الفاتورة إلى السجلات المغلقة مع بقائها موثقة بالكامل.
                </p>
              </div>
            </div>

            {/* Financial Status Summary */}
            {hasDue ? (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-start space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-red-400 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4" />
                    <span>رصيد معلق غير مسدد على الفاتورة</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-lg bg-red-500/20 text-red-400 font-mono font-black text-xs">
                    {formatCurrency(precheck?.amount_due ?? 0, precheck?.currency ?? "JOD")}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  هذه الفاتورة ما زالت تحتوي على رصيد مستحق. الأفضل تحصيل المبلغ أو إصدار إشعار دائن/إلغاء قبل الأرشفة، ما لم تكن هناك موافقة إدارية على إعدام الدين:
                </p>

                <div className="pt-2 border-t border-red-500/20">
                  <label className="flex items-start gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={forceWithDebt}
                      onChange={(e) => setForceWithDebt(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-red-500/50 bg-black/40 text-red-600 focus:ring-red-500 cursor-pointer"
                    />
                    <span className="text-xs text-red-200 group-hover:text-white transition-colors leading-relaxed">
                      <strong>إقرار إداري:</strong> أوافق على أرشفة هذه الفاتورة مع إبقائها كمديونية معدومة/معلقة في التقارير المحاسبية.
                    </span>
                  </label>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2.5 text-emerald-400 text-xs font-bold text-start">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>الفاتورة مكتملة مالياً (الرصيد المستحق: 0) ومؤهلة للأرشفة المغلقة.</span>
              </div>
            )}

            {/* Reason Presets */}
            <div className="space-y-3 pt-1 text-start">
              <FormField label="سبب أرشفة الفاتورة" required>
                <Select
                  value={selectedReason}
                  onChange={(e) => setSelectedReason(e.target.value)}
                >
                  {INVOICE_REASON_PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="ملاحظات توثيقية إضافية (تُسجل في قيود الفاتورة)">
                <Textarea
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  placeholder="أدخل أي إيضاحات محاسبية أو مراجع تسوية..."
                  rows={2}
                />
              </FormField>
            </div>
          </>
        )}
      </ModalBody>

      <ModalFooter>
        <div className="flex gap-3 w-full">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all"
          >
            إلغاء
          </button>
          <button
            type="button"
            disabled={isSubmitDisabled}
            onClick={() => archiveMutation.mutate()}
            className={cn(
              "flex-1 py-3 rounded-xl text-white text-xs font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed",
              hasDue
                ? "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20"
                : "bg-primary hover:brightness-110 shadow-primary/20"
            )}
          >
            {archiveMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Archive className="w-4 h-4" />
            )}
            تأكيد أرشفة الفاتورة
          </button>
        </div>
      </ModalFooter>
    </Modal>
  );
}
