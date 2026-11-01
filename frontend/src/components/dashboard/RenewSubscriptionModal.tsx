"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { RefreshCw, AlertTriangle, CheckCircle2, Package, Loader2, Calendar } from "lucide-react";
import { formatCurrency, parseApiError } from "@/lib/utils";
import type { MembershipSummary } from "@/types";
import { toast } from "sonner";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";

interface RenewSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: number;
  studentName: string;
  membership: MembershipSummary;
  outstandingBalance: number;
  currency?: string;
}

const CYCLE_LABELS: Record<string, string> = {
  weekly: "أسبوعي",
  monthly: "شهري",
  quarterly: "ربع سنوي (3 أشهر)",
  semi_annual: "نصف سنوي (6 أشهر)",
  annual: "سنوي",
  one_time: "مرة واحدة",
};

export default function RenewSubscriptionModal({
  isOpen,
  onClose,
  studentId,
  studentName,
  membership,
  outstandingBalance,
  currency = "JOD",
}: RenewSubscriptionModalProps) {
  const queryClient = useQueryClient();

  const renewMutation = useMutation({
    mutationFn: () => api.students.renewSubscription(studentId),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["student"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["billing"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      const invNum = res?.data?.invoice?.invoice_number;
      toast.success(
        invNum
          ? `تم تجديد اشتراك الطالب بنجاح وإصدار الفاتورة رقم ${invNum} ✓`
          : "تم تجديد اشتراك الطالب وإصدار فاتورة التجديد بنجاح ✓"
      );
      onClose();
    },
    onError: (err: any) => {
      toast.error(parseApiError(err, "فشل تجديد الاشتراك. يرجى المحاولة مرة أخرى."));
    },
  });

  const hasUnpaidDues = outstandingBalance > 0;
  const cycleText = membership.billing_cycle ? (CYCLE_LABELS[membership.billing_cycle] ?? membership.billing_cycle) : "دوري";

  return (
    <Modal open={isOpen} onClose={onClose} size="md">
      <ModalHeader
        icon={<RefreshCw className="w-5 h-5 text-primary" />}
        title="تجديد اشتراك الطالب"
        subtitle={studentName}
        onClose={onClose}
      />

      <ModalBody className="space-y-5">
        {/* Plan Overview Card */}
        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center text-white shadow-md">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-black text-white">{membership.plan_name}</h4>
                <p className="text-xs text-muted-foreground font-semibold">الدورة: {cycleText}</p>
              </div>
            </div>
            {membership.price !== undefined && (
              <div className="text-end">
                <p className="text-lg font-black text-primary">
                  <bdi>{formatCurrency(membership.price, membership.currency || currency)}</bdi>
                </p>
                <span className="text-[10px] text-muted-foreground font-bold">قيمة التجديد</span>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 font-bold">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              تاريخ البدء: {membership.status === "active" && membership.end_date ? "مباشرة بعد انتهاء الفترة الحالية" : "اليوم (تجديد فوري)"}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/5 border border-white/10">
              تجديد تلقائي مفعل
            </span>
          </div>
        </div>

        {/* Dues Status Alert */}
        {hasUnpaidDues ? (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2 text-start">
            <div className="flex items-center gap-2 text-amber-400 font-black text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>تنبيه: مستحقات مالية سابقة غير مسددة</span>
            </div>
            <p className="text-xs text-amber-200/90 leading-relaxed font-medium">
              الطالب عليه مستحقات سابقة غير مسددة بقيمة{" "}
              <strong className="text-white font-black underline decoration-amber-400">
                {formatCurrency(outstandingBalance, currency)}
              </strong>
              .
            </p>
            <p className="text-[11px] text-amber-300/80 leading-relaxed font-semibold">
              بصفتك مسؤولاً، بالضغط على تأكيد التجديد سيتم تفعيل اشتراك الطالب فوراً، وإصدار فاتورة التجديد الجديدة لتنزل على حسابه وتضاف لمستحقاته المالية.
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-3 text-start">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-black text-emerald-300">سداد المستحقات مكتمل</p>
              <p className="text-[11px] text-emerald-200/80 font-medium mt-0.5">
                تم سداد كافة المستحقات السابقة. سيتم تجديد باقة الطالب وإصدار فاتورة الدورة الجديدة.
              </p>
            </div>
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <button
          type="button"
          onClick={onClose}
          disabled={renewMutation.isPending}
          className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold transition-all disabled:opacity-50"
        >
          إلغاء
        </button>
        <button
          type="button"
          onClick={() => renewMutation.mutate()}
          disabled={renewMutation.isPending}
          className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl gradient-brand text-white text-xs font-black shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
        >
          {renewMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>جاري تجديد الباقة وإصدار الفاتورة...</span>
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              <span>تأكيد تجديد الاشتراك وإصدار الفاتورة</span>
            </>
          )}
        </button>
      </ModalFooter>
    </Modal>
  );
}
