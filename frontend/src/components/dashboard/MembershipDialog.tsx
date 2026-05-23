"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { CreditCard, Calendar, FileText, Loader2, CheckCircle, Package } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { MembershipPlan } from "@/types";
import { toast } from "sonner";
import { Select } from "@/components/ui/select";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { FormField, Input, Textarea } from "@/components/ui/form-field";

interface MembershipDialogProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: number;
  studentName: string;
}

export default function MembershipDialog({
  isOpen,
  onClose,
  studentId,
  studentName,
}: MembershipDialogProps) {
  const queryClient = useQueryClient();
  const [selectedPlanId, setSelectedPlanId] = useState<number | "">("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ["billing", "plans"],
    queryFn: () => api.billing.plans.list().then((res: any) => res.data),
    enabled: isOpen,
  });

  const plans: MembershipPlan[] = Array.isArray(plansData)
    ? plansData
    : (plansData as any)?.results ?? [];

  const membershipMutation = useMutation({
    mutationFn: (data: any) => api.billing.memberships.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student", studentId.toString()] });
      queryClient.invalidateQueries({ queryKey: ["billing", "memberships"] });
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
      status: "active",
      notes,
    });
  };

  const selectedPlan = plans.find((p) => p.id === Number(selectedPlanId));

  return (
    <Modal open={isOpen} onClose={onClose} size="sm">
      <ModalHeader
        icon={<Package className="w-5 h-5" />}
        title="إضافة باقة اشتراك"
        subtitle={studentName}
        onClose={onClose}
      />

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <ModalBody className="space-y-4">
          <FormField label="اختر الباقة" required>
            <Select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(Number(e.target.value))}
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
          </FormField>

          {/* Plan summary card */}
          {selectedPlan && (
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex justify-between items-start mb-2">
                <p className="text-sm font-semibold">{selectedPlan.name}</p>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/15 text-primary px-2 py-0.5 rounded-md">
                  {selectedPlan.billing_cycle === "monthly" ? "شهري" :
                    selectedPlan.billing_cycle === "annual" ? "سنوي" : selectedPlan.billing_cycle}
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

          <FormField label="تاريخ البدء" required>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={membershipMutation.isPending}
              required
            />
          </FormField>

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
