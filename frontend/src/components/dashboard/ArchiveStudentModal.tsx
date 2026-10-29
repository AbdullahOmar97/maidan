"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import {
  Archive,
  AlertTriangle,
  CreditCard,
  Calendar,
  UserX,
  FileText,
  Loader2,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import { cn, parseApiError, formatCurrency } from "@/lib/utils";
import { useTenant } from "@/lib/providers/tenant-provider";
import type { ArchivePrecheckData } from "@/types";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { FormField, Textarea, ErrorBanner } from "@/components/ui/form-field";
import { toast } from "sonner";
import Link from "next/link";

interface ArchiveStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: number;
  studentName: string;
  onArchived?: () => void;
}

const REASON_PRESETS = [
  { value: "انتقال أو سفر للخارج", label: "انتقال أو سفر للخارج" },
  { value: "انسحاب برغبة الطالب أو ولي الأمر", label: "انسحاب برغبة الطالب أو ولي الأمر" },
  { value: "ظرف صحي أو إصابة رياضية", label: "ظرف صحي أو إصابة رياضية" },
  { value: "تعذر السداد أو انقطاع بدون دفع", label: "تعذر السداد أو انقطاع بدون دفع" },
  { value: "قرار إداري أو انضباطي", label: "قرار إداري أو انضباطي" },
  { value: "تخرج وإتمام المرحلة التدريبية", label: "تخرج وإتمام المرحلة التدريبية" },
  { value: "أخرى", label: "سبب آخر (موضح في الملاحظات)" },
];

export default function ArchiveStudentModal({
  isOpen,
  onClose,
  studentId,
  studentName,
  onArchived,
}: ArchiveStudentModalProps) {
  const queryClient = useQueryClient();
  const { tenant } = useTenant();
  const currency = tenant?.default_currency || "JOD";
  const [selectedReason, setSelectedReason] = useState<string>("انسحاب برغبة الطالب أو ولي الأمر");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [forceWithDebt, setForceWithDebt] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const {
    data: precheck,
    isLoading: isLoadingPrecheck,
    isError: isPrecheckError,
  } = useQuery<ArchivePrecheckData>({
    queryKey: ["archive-precheck", studentId],
    queryFn: () => api.students.archivePrecheck(studentId).then((r: any) => r.data),
    enabled: isOpen,
  });

  const archiveMutation = useMutation({
    mutationFn: () => {
      const fullReason = additionalNotes.trim()
        ? `${selectedReason}: ${additionalNotes.trim()}`
        : selectedReason;

      return api.students.archive(studentId, {
        reason: fullReason,
        force_with_debt: forceWithDebt,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["student", studentId.toString()] });
      queryClient.invalidateQueries({ queryKey: ["archive-precheck", studentId] });
      toast.success("تمت أرشفة ملف الطالب بنجاح");
      onClose();
      onArchived?.();
    },
    onError: (err: any) => {
      console.error("Archive student error:", err);
      const parsed = parseApiError(err, "حدث خطأ أثناء أرشفة ملف الطالب.");
      setErrorMsg(parsed);
      toast.error(parsed);
    },
  });

  const hasDues = (precheck?.total_due ?? 0) > 0;
  const isSubmitDisabled =
    archiveMutation.isPending ||
    isLoadingPrecheck ||
    (hasDues && !forceWithDebt);

  return (
    <Modal open={isOpen} onClose={onClose} size="lg">
      <ModalHeader
        icon={<Archive className="w-5 h-5 text-amber-500" />}
        title="أرشفة ملف الطالب"
        subtitle={studentName}
        onClose={onClose}
      />

      <ModalBody className="space-y-4">
        {errorMsg && <ErrorBanner message={errorMsg} />}

        {isLoadingPrecheck ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm font-bold">جاري فحص المستحقات والسجلات المرتبطة بالطالب...</p>
          </div>
        ) : isPrecheckError ? (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            تعذر تحميل بيانات الفحص الأولي للطالب. يرجى إعادة المحاولة.
          </div>
        ) : (
          <>
            {/* Informational Callout */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-start">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-200/90 leading-relaxed space-y-1">
                <p className="font-bold">ملاحظة أمان السجلات:</p>
                <p>
                  النظام لا يتيح حذف الطالب نهائياً لحماية سلامة السجلات المالية وتاريخ الأحزمة والحضور. الأرشفة تحجب الطالب من الكشوفات النشطة وتلغي اشتراكاته الحالية، مع إمكانية استعادة الملف مستقبلاً.
                </p>
              </div>
            </div>

            {/* Financial Dues Alert */}
            {hasDues ? (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-start space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-red-400 font-black text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    <span>مستحقات مالية غير مسددة</span>
                  </div>
                  <span className="px-3 py-1 rounded-xl bg-red-500/20 text-red-400 font-mono font-black text-sm">
                    {formatCurrency(precheck?.total_due ?? 0, currency)}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  يوجد على الطالب فواتير غير مسددة أو متبقي عليها مبالغ مالية. الخيار الأفضل هو تسديدها أو تسويتها مالياً قبل إتمام الأرشفة:
                </p>

                {/* Invoices list preview */}
                <div className="space-y-1.5 max-h-36 overflow-y-auto pe-1">
                  {precheck?.outstanding_invoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-black/30 border border-white/5 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="font-mono font-bold text-white">{inv.invoice_number}</span>
                        <span className="text-muted-foreground text-[11px]">
                          (تاريخ الاستحقاق: {inv.due_date})
                        </span>
                      </div>
                      <span className="text-red-400 font-mono font-black">
                        {inv.due_amount} {inv.currency}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Operational Override Acknowledgment */}
                <div className="pt-2 border-t border-red-500/20">
                  <label className="flex items-start gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={forceWithDebt}
                      onChange={(e) => setForceWithDebt(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-red-500/50 bg-black/40 text-red-600 focus:ring-red-500 cursor-pointer"
                    />
                    <span className="text-xs text-red-200 group-hover:text-white transition-colors leading-relaxed">
                      <strong>إقرار إداري استثنائي:</strong> أوافق على أرشفة الطالب مع إبقاء هذه المديونية قائمة في سجلات النادي للمطالبة والتحصيل اللاحق.
                    </span>
                  </label>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2.5 text-emerald-400 text-xs font-bold text-start">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>الذمة المالية سليمة: لا توجد فواتير أو مستحقات مالية معلقة على الطالب.</span>
              </div>
            )}

            {/* Wallet Credit Notice */}
            {(precheck?.account_credit ?? 0) > 0 && (
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs text-amber-300">
                <span>تنبيه محفظة: يوجد رصيد دائن متبقي للطالب:</span>
                <span className="font-mono font-bold text-amber-400">
                  {formatCurrency(precheck?.account_credit ?? 0, currency)}
                </span>
              </div>
            )}

            {/* Subscriptions & Associations Preview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-start">
              <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  <span>الاشتراكات النشطة:</span>
                </div>
                <p className="text-xs text-white font-medium">
                  {precheck?.active_memberships?.length
                    ? `سيتم إنهاء ${precheck.active_memberships.length} اشتراك نشط تلقائياً`
                    : "لا توجد اشتراكات نشطة"}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                  <UserX className="w-3.5 h-3.5 text-primary" />
                  <span>حساب بوابة المشترك:</span>
                </div>
                <p className="text-xs text-white font-medium">
                  {precheck?.has_user_account
                    ? "سيتم تعطيل صلاحية تسجيل الدخول"
                    : "لا يوجد حساب دخول مرتبط"}
                </p>
              </div>
            </div>

            {/* Reason Selection */}
            <div className="space-y-3 pt-2 text-start">
              <FormField label="سبب الأرشفة" required>
                <Select
                  value={selectedReason}
                  onChange={(e) => setSelectedReason(e.target.value)}
                >
                  {REASON_PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="تفاصيل أو ملاحظات إضافية (تُوثق في سجل الطالب)">
                <Textarea
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  placeholder="أدخل أي ملاحظات إدارية ذات صلة بعملية الأرشفة..."
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
              hasDues
                ? "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20"
                : "bg-red-500 hover:bg-red-600 shadow-red-500/20"
            )}
          >
            {archiveMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Archive className="w-4 h-4" />
            )}
            تأكيد الأرشفة
          </button>
        </div>
      </ModalFooter>
    </Modal>
  );
}
