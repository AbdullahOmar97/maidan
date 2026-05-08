"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { X, CreditCard, Calendar, FileText, Loader2, CheckCircle, Package } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { MembershipPlan } from "@/types";
import { toast } from "sonner";

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

  const plans = Array.isArray(plansData) ? plansData : (plansData as any)?.results || [];

  const membershipMutation = useMutation({
    mutationFn: (data: any) => api.billing.memberships.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student", studentId.toString()] });
      queryClient.invalidateQueries({ queryKey: ["billing", "memberships"] });
      toast.success("تم إضافة باقة الاشتراك بنجاح");
      onClose();
    },
    onError: (err: any) => {
      console.error("Error creating membership:", err);
      toast.error("فشل إضافة باقة الاشتراك. يرجى التحقق من البيانات.");
    }
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanId) return;

    membershipMutation.mutate({
      student_id: studentId,
      plan_id: Number(selectedPlanId),
      start_date: startDate,
      status: "active",
      notes: notes,
    });
  };

  const selectedPlan = plans?.find(p => p.id === Number(selectedPlanId));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0f172a] border border-white/10 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-gradient-to-br from-primary/10 to-transparent">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl gradient-brand flex items-center justify-center text-white shadow-xl shadow-primary/20">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">إضافة باقة اشتراك</h2>
              <p className="text-xs font-bold text-muted-foreground mt-0.5">{studentName}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-red-500/20 hover:text-red-400 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* Plan Selection */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-primary/70 flex items-center gap-2">
              <CreditCard className="w-3.5 h-3.5" />
              اختر الباقة
            </label>
            <div className="relative">
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(Number(e.target.value))}
                disabled={plansLoading || membershipMutation.isPending}
                className="w-full h-14 px-5 rounded-2xl bg-white/5 border border-white/10 text-white font-bold focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all appearance-none cursor-pointer"
                required
              >
                <option value="" className="bg-slate-900">اختر من القائمة...</option>
                {plans?.map((plan) => (
                  <option key={plan.id} value={plan.id} className="bg-slate-900">
                    {plan.name} — {formatCurrency(plan.price, plan.currency)}
                  </option>
                ))}
              </select>
              <div className="absolute left-5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                <Package className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Plan Summary Card */}
          {selectedPlan && (
            <div className="p-5 rounded-2xl bg-primary/5 border border-primary/20 animate-in fade-in slide-in-from-top-2">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">تفاصيل الباقة</span>
                <span className="text-[10px] font-black uppercase tracking-widest bg-primary/20 px-2 py-0.5 rounded text-primary">
                  {selectedPlan.billing_cycle === "monthly" ? "شهري" : 
                   selectedPlan.billing_cycle === "annual" ? "سنوي" : selectedPlan.billing_cycle}
                </span>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-sm font-bold text-white mb-1">{selectedPlan.name}</p>
                  <p className="text-[10px] text-muted-foreground">{selectedPlan.description || "لا يوجد وصف"}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-primary">{formatCurrency(selectedPlan.price, selectedPlan.currency)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Start Date */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-primary/70 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" />
              تاريخ البدء
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={membershipMutation.isPending}
              className="w-full h-14 px-5 rounded-2xl bg-white/5 border border-white/10 text-white font-bold focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all appearance-none"
              required
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-primary/70 flex items-center gap-2">
              <FileText className="w-3.5 h-3.5" />
              ملاحظات
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={membershipMutation.isPending}
              className="w-full p-5 rounded-2xl bg-white/5 border border-white/10 text-white font-bold focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all min-h-[100px] resize-none text-right placeholder:text-muted-foreground/30"
              placeholder="أي ملاحظات إضافية حول الاشتراك..."
              dir="rtl"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-14 rounded-2xl bg-white/5 border border-white/10 text-white text-sm font-black uppercase tracking-widest hover:bg-white/10 transition-all"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={membershipMutation.isPending || !selectedPlanId}
              className="flex-[2] h-14 rounded-2xl gradient-brand text-white text-sm font-black uppercase tracking-widest shadow-xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-3"
            >
              {membershipMutation.isPending ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <span>تأكيد الاشتراك</span>
                  <CheckCircle className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
