"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { CreditCard, Calendar, FileText, Loader2, CheckCircle, Package, Settings, AlertCircle, History } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { MembershipPlan } from "@/types";
import { toast } from "sonner";
import { Select } from "@/components/ui/select";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { FormField, Input, Textarea } from "@/components/ui/form-field";
import Link from "next/link";

interface MembershipDialogProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: number;
  studentName: string;
}

type BackbillMode = "unpaid" | "paid" | "single";

export default function MembershipDialog({
  isOpen,
  onClose,
  studentId,
  studentName,
}: MembershipDialogProps) {
  const queryClient = useQueryClient();
  const [selectedPlanId, setSelectedPlanId] = useState<number | "">("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [backbillMode, setBackbillMode] = useState<BackbillMode>("unpaid");

  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ["billing", "plans"],
    queryFn: () => api.billing.plans.list().then((res: any) => res.data),
    enabled: isOpen,
  });

  const plans: MembershipPlan[] = Array.isArray(plansData)
    ? plansData
    : (plansData as any)?.results ?? [];

  const selectedPlan = plans.find((p) => p.id === Number(selectedPlanId));

  const computeEndDate = (start: string, cycle?: string): string => {
    if (!start || !cycle || cycle === "one_time") return "";
    const [y, m, d] = start.split("-").map(Number);
    if (!y || !m || !d) return "";
    const date = new Date(Date.UTC(y, m - 1, d));
    if (cycle === "weekly") {
      date.setUTCDate(date.getUTCDate() + 7);
    } else {
      const monthsToAdd =
        cycle === "monthly" ? 1 :
        cycle === "quarterly" ? 3 :
        cycle === "semi_annual" ? 6 :
        cycle === "annual" ? 12 : 1;
      const targetMonth = date.getUTCMonth() + monthsToAdd;
      const targetYear = date.getUTCFullYear() + Math.floor(targetMonth / 12);
      const normMonth = ((targetMonth % 12) + 12) % 12;
      const maxDay = new Date(Date.UTC(targetYear, normMonth + 1, 0)).getUTCDate();
      date.setUTCFullYear(targetYear, normMonth, Math.min(d, maxDay));
    }
    return date.toISOString().split("T")[0];
  };

  const getElapsedCycles = (start: string, cycle?: string): { count: number; pastCount: number; currentEnd: string } => {
    if (!start || !cycle || cycle === "one_time") return { count: 1, pastCount: 0, currentEnd: "" };
    const [y, m, d] = start.split("-").map(Number);
    if (!y || !m || !d) return { count: 1, pastCount: 0, currentEnd: "" };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let curStart = new Date(Date.UTC(y, m - 1, d));
    const singleEnd = computeEndDate(start, cycle);
    if (curStart >= today) {
      return { count: 1, pastCount: 0, currentEnd: singleEnd };
    }

    let count = 0;
    let pastCount = 0;
    let lastEnd = singleEnd;
    let loopGuard = 0;

    while (curStart <= today && loopGuard < 120) {
      loopGuard++;
      const curStartStr = curStart.toISOString().split("T")[0];
      const curEndStr = computeEndDate(curStartStr, cycle);
      lastEnd = curEndStr;
      const [ey, em, ed] = curEndStr.split("-").map(Number);
      const curEnd = new Date(Date.UTC(ey, em - 1, ed));

      count++;
      if (curEnd <= today) {
        pastCount++;
      }
      curStart = curEnd;
    }

    return { count, pastCount, currentEnd: lastEnd };
  };

  const cycleInfo = selectedPlan
    ? getElapsedCycles(startDate, selectedPlan.billing_cycle)
    : { count: 1, pastCount: 0, currentEnd: "" };
  const isBackdated = cycleInfo.pastCount > 0 && selectedPlan?.billing_cycle !== "one_time";

  const updateEndDate = (start: string, plan: MembershipPlan | undefined, mode: BackbillMode) => {
    if (!plan || !start) {
      setEndDate("");
      return;
    }
    const info = getElapsedCycles(start, plan.billing_cycle);
    if (info.pastCount > 0 && mode !== "single") {
      setEndDate(info.currentEnd);
    } else {
      setEndDate(computeEndDate(start, plan.billing_cycle));
    }
  };

  const handlePlanChange = (planId: number | "") => {
    setSelectedPlanId(planId);
    const plan = plans.find((p) => p.id === Number(planId));
    updateEndDate(startDate, plan, backbillMode);
  };

  const handleStartDateChange = (newStart: string) => {
    setStartDate(newStart);
    updateEndDate(newStart, selectedPlan, backbillMode);
  };

  const handleBackbillModeChange = (mode: BackbillMode) => {
    setBackbillMode(mode);
    updateEndDate(startDate, selectedPlan, mode);
  };

  const membershipMutation = useMutation({
    mutationFn: (data: any) => api.billing.memberships.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["billing"] });
      toast.success("تم إضافة باقة الاشتراك بنجاح");
      onClose();
    },
    onError: () => {
      toast.error("فشل إضافة باقة الاشتراك. يرجى التحقق من البيانات.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanId) return;
    membershipMutation.mutate({
      student_id: studentId,
      plan_id: Number(selectedPlanId),
      start_date: startDate,
      end_date: endDate || null,
      status: "active",
      notes,
      backbill_mode: isBackdated ? backbillMode : "single",
    });
  };

  const cycleLabels: Record<string, string> = {
    weekly: "أسبوعي",
    monthly: "شهري",
    quarterly: "ربع سنوي (3 أشهر)",
    semi_annual: "نصف سنوي (6 أشهر)",
    annual: "سنوي",
    one_time: "مرة واحدة",
  };

  return (
    <Modal open={isOpen} onClose={onClose} size="md">
      <ModalHeader
        icon={<Package className="w-5 h-5" />}
        title="إضافة باقة اشتراك"
        subtitle={studentName}
        onClose={onClose}
      />

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <ModalBody className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-bold text-muted-foreground/80 uppercase tracking-wider">
                اختر الباقة
                <span className="text-destructive ms-1">*</span>
              </label>
              <Link
                href="/dashboard/billing/plans"
                className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1 font-bold"
              >
                <Settings className="w-3 h-3" />
                إدارة الباقات
              </Link>
            </div>
            <Select
              value={selectedPlanId}
              onChange={(e) => handlePlanChange(e.target.value ? Number(e.target.value) : "")}
              disabled={plansLoading || membershipMutation.isPending}
              required
            >
              <option value="">اختر من القائمة...</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} — {formatCurrency(plan.price, plan.currency)}
                </option>
              ))}
            </Select>
          </div>

          {/* Plan summary card */}
          {selectedPlan && (
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex justify-between items-start mb-2">
                <p className="text-sm font-semibold">{selectedPlan.name}</p>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/15 text-primary px-2 py-0.5 rounded-md">
                  {cycleLabels[selectedPlan.billing_cycle] ?? selectedPlan.billing_cycle}
                </span>
              </div>
              {selectedPlan.description && (
                <p className="text-xs text-muted-foreground mb-2">{selectedPlan.description}</p>
              )}
              <p className="text-lg font-black text-primary">
                <bdi>{formatCurrency(selectedPlan.price, selectedPlan.currency)}</bdi>
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="تاريخ البدء" required>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                disabled={membershipMutation.isPending}
                required
              />
            </FormField>

            {selectedPlan?.billing_cycle !== "one_time" && (
              <FormField label="تاريخ الانتهاء (تلقائي حسب الباقة)">
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={membershipMutation.isPending || !selectedPlanId}
                />
              </FormField>
            )}
          </div>

          {/* Backbilling Alert and Mode Selection */}
          {isBackdated && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-black text-amber-300">
                    تاريخ البدء يسبق تاريخ اليوم بمقدار {cycleInfo.pastCount} {cycleInfo.pastCount === 1 ? "دورة سابقة" : "دورات سابقة"}
                  </p>
                  <p className="text-[11px] text-amber-400/80 mt-0.5">
                    إجمالي الفترات حتى نهاية الدورة الحالية: {cycleInfo.count} فترات (تنتهي في {cycleInfo.currentEnd})
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-amber-500/20 text-xs">
                <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
                  كيف ترغب في معالجة الفواتير السابقة؟
                </label>

                {/* Option 1: Unpaid (Due/Overdue) */}
                <label className={cn(
                  "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                  backbillMode === "unpaid" ? "bg-primary/10 border-primary/50 text-white" : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
                )}>
                  <input
                    type="radio"
                    name="backbillMode"
                    value="unpaid"
                    checked={backbillMode === "unpaid"}
                    onChange={() => handleBackbillModeChange("unpaid")}
                    className="mt-1 accent-primary"
                  />
                  <div className="space-y-0.5">
                    <span className="font-black block text-xs text-white">توليد فواتير مستحقة (غير مدفوعة)</span>
                    <span className="text-[11px] text-muted-foreground block leading-relaxed">
                      يتم توليد {cycleInfo.count} فواتير ({cycleInfo.pastCount} فواتير سابقة مستحقة + فاتورة الدورة الحالية) وإضافتها للرصيد المالي المستحق على الطالب.
                    </span>
                  </div>
                </label>

                {/* Option 2: Paid (Historical settled) */}
                <label className={cn(
                  "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                  backbillMode === "paid" ? "bg-primary/10 border-primary/50 text-white" : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
                )}>
                  <input
                    type="radio"
                    name="backbillMode"
                    value="paid"
                    checked={backbillMode === "paid"}
                    onChange={() => handleBackbillModeChange("paid")}
                    className="mt-1 accent-primary"
                  />
                  <div className="space-y-0.5">
                    <span className="font-black block text-xs text-white">تسجيل الفترات السابقة كـ &quot;مدفوعة&quot;</span>
                    <span className="text-[11px] text-muted-foreground block leading-relaxed">
                      يتم توثيق الفترات السابقة ({cycleInfo.pastCount}) كفواتير مدفوعة مسبقاً، وفاتورة الفترة الحالية فقط تبقى معلقة للدفع.
                    </span>
                  </div>
                </label>

                {/* Option 3: Single Period */}
                <label className={cn(
                  "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                  backbillMode === "single" ? "bg-primary/10 border-primary/50 text-white" : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
                )}>
                  <input
                    type="radio"
                    name="backbillMode"
                    value="single"
                    checked={backbillMode === "single"}
                    onChange={() => handleBackbillModeChange("single")}
                    className="mt-1 accent-primary"
                  />
                  <div className="space-y-0.5">
                    <span className="font-black block text-xs text-white">دورة واحدة فقط (بدون توليد فواتير بأثر رجعي)</span>
                    <span className="text-[11px] text-muted-foreground block leading-relaxed">
                      تسجيل فاتورة واحدة تبدأ من {startDate} بدون احتساب أي دورات سابقة.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}

          <FormField label="ملاحظات">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={membershipMutation.isPending}
              placeholder="أي ملاحظات إضافية حول الاشتراك..."

              rows={2}
            />
          </FormField>
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
              type="submit"
              disabled={membershipMutation.isPending || !selectedPlanId}
              className="flex-1 py-3 rounded-xl gradient-brand text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {membershipMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              تأكيد الاشتراك
            </button>
          </div>
        </ModalFooter>
      </form>
    </Modal>
  );
}
