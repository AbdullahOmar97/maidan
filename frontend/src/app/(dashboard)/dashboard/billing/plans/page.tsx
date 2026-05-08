"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { formatCurrency, cn } from "@/lib/utils";
import { 
  CreditCard, Plus, Edit2, Trash2, Loader2, Sparkles, 
  CheckCircle2, XCircle, ArrowRight 
} from "lucide-react";
import type { MembershipPlan } from "@/types";
import Link from "next/link";
import MembershipPlanDialog from "@/components/dashboard/MembershipPlanDialog";
import { toast } from "sonner";
import { PermissionGuard } from "@/components/dashboard/permission-guard";

export default function PlansPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | undefined>(undefined);

  const { data: plansData, isLoading } = useQuery({
    queryKey: ["billing", "plans"],
    queryFn: () => api.billing.plans.list().then((r) => r.data),
  });

  const plans = Array.isArray(plansData) ? plansData : (plansData as any)?.results || [];

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.billing.plans.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "plans"] });
      toast.success("تم حذف الباقة بنجاح");
    },
    onError: () => {
      toast.error("فشل حذف الباقة. قد تكون مرتبطة باشتراكات نشطة.");
    },
  });

  const handleEdit = (plan: MembershipPlan) => {
    setEditingPlan(plan);
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingPlan(undefined);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (window.confirm("هل أنت متأكد من حذف هذه الباقة؟ لا يمكن التراجع عن هذا الإجراء.")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <PermissionGuard permission="can_manage_billing">
    <div className="space-y-10 pb-12">
      <div className="flex items-center gap-4">
        <Link 
          href="/dashboard/billing"
          className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-white transition-all"
        >
          <ArrowRight className="w-5 h-5 rtl-flip" />
        </Link>
        <PageHeader
          title="باقات الاشتراك"
          description="إدارة خطط العضوية والاشتراكات المتاحة للطلاب في الأكاديمية."
          icon={CreditCard}
        >
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-6 py-3 rounded-xl gradient-brand text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.05] active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            باقة جديدة
          </button>
        </PageHeader>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="glass-card p-8 animate-pulse space-y-6">
              <div className="flex justify-between">
                <div className="w-24 h-6 bg-white/5 rounded-lg" />
                <div className="w-12 h-12 bg-white/5 rounded-2xl" />
              </div>
              <div className="h-4 bg-white/5 rounded-lg w-3/4" />
              <div className="h-10 bg-white/5 rounded-xl w-full" />
            </div>
          ))
        ) : plans.length === 0 ? (
          <div className="col-span-full py-32 text-center glass-card">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6 text-muted-foreground opacity-20">
              <CreditCard className="w-10 h-10" />
            </div>
            <h3 className="text-white font-black text-xl">لا توجد باقات اشتراك</h3>
            <p className="text-muted-foreground text-sm font-bold mt-2">ابدأ بإنشاء أول باقة اشتراك لطلابك الآن.</p>
            <button 
              onClick={handleAdd}
              className="mt-8 px-8 py-3 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all"
            >
              إنشاء أول باقة
            </button>
          </div>
        ) : (
          plans.map((plan: MembershipPlan) => (
            <div key={plan.id} className="glass-card group relative overflow-hidden flex flex-col">
              {/* Status Badge */}
              <div className="absolute top-6 left-6 flex items-center gap-2">
                {plan.is_active ? (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest">
                    <CheckCircle2 className="w-3 h-3" />
                    نشطة
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-widest">
                    <XCircle className="w-3 h-3" />
                    متوقفة
                  </span>
                )}
                {plan.is_public && (
                  <span className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest">
                    عامة
                  </span>
                )}
              </div>

              {/* Decorative Icon */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors pointer-events-none" />
              
              <div className="p-8 pt-16 flex-1 space-y-6">
                <div className="space-y-1 text-right">
                  <h3 className="text-xl font-black text-white tracking-tight">{plan.name}</h3>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-1">دورة الدفع</span>
                    <span className="text-xs font-black text-white">{plan.billing_cycle === 'monthly' ? 'شهري' : plan.billing_cycle}</span>
                  </div>
                  <div className="text-left">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-1">السعر</span>
                    <span className="text-lg font-black text-primary" dir="ltr">{formatCurrency(plan.price, plan.currency)}</span>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground font-medium leading-relaxed text-right line-clamp-3 min-h-[4.5rem]">
                  {plan.description || "لا يوجد وصف لهذه الباقة."}
                </p>
              </div>

              {/* Footer Actions */}
              <div className="p-6 border-t border-white/5 bg-white/[0.02] flex items-center gap-3">
                <button
                  onClick={() => handleEdit(plan)}
                  className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  تعديل
                </button>
                <button
                  onClick={() => handleDelete(plan.id)}
                  disabled={deleteMutation.isPending}
                  className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 text-muted-foreground hover:bg-red-500 hover:text-white transition-all flex items-center justify-center active:scale-90"
                >
                  {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <MembershipPlanDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        plan={editingPlan}
      />
    </div>
    </PermissionGuard>
  );
}
