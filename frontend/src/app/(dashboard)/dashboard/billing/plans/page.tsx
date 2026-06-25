"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { formatCurrency, cn } from "@/lib/utils";
import {
  CreditCard, Plus, Edit2, Trash2, Loader2,
  CheckCircle2
} from "lucide-react";
import type { MembershipPlan } from "@/types";
import MembershipPlanDialog from "@/components/dashboard/MembershipPlanDialog";
import { toast } from "sonner";
import { PermissionGuard } from "@/components/dashboard/permission-guard";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";

export default function PlansPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | undefined>(undefined);
  const [planToDelete, setPlanToDelete] = useState<MembershipPlan | null>(null);

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
      setPlanToDelete(null);
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

  const handleDelete = (plan: MembershipPlan) => {
    setPlanToDelete(plan);
  };

  return (
    <PermissionGuard permission="can_manage_billing">
      <div className="space-y-8 pb-12">
        <PageHeader
          title="باقات الاشتراك"
          description="إدارة خطط العضوية والاشتراكات المتاحة للطلاب في الأكاديمية."
          icon={CreditCard}
          backHref="/dashboard/billing"
          backLabel="العودة للمالية"
        >
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-6 py-3 rounded-xl gradient-brand text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.05] active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            باقة جديدة
          </button>
        </PageHeader>

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
            plans.map((plan: MembershipPlan) => {
              const billingCycleText = {
                weekly: "أسبوعي",
                monthly: "شهري",
                quarterly: "ربع سنوي",
                semi_annual: "نصف سنوي",
                annual: "سنوي",
                one_time: "مرة واحدة",
              }[plan.billing_cycle] || plan.billing_cycle;

              return (
                <div 
                  key={plan.id} 
                  className={cn(
                    "glass-card group relative overflow-hidden flex flex-col transition-all duration-300",
                    "border border-white/[0.06] hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-1"
                  )}
                >
                  {/* Status Badge */}
                  <div className="absolute top-6 start-6 flex items-center gap-2 z-10">
                    {plan.is_active ? (
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        نشطة
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-muted-foreground text-[10px] font-black uppercase tracking-widest">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                        متوقفة
                      </span>
                    )}
                    {plan.is_public && (
                      <span className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest">
                        عامة
                      </span>
                    )}
                  </div>

                  {/* Decorative Glow */}
                  <div className="absolute top-0 end-0 w-32 h-32 bg-primary/5 blur-3xl -me-16 -mt-16 group-hover:bg-primary/10 transition-colors pointer-events-none" />

                  <div className="p-8 pt-16 flex-1 space-y-6">
                    <div className="space-y-1 text-start">
                      <h3 className="text-xl font-black text-white tracking-tight group-hover:text-primary transition-colors">{plan.name}</h3>
                      <p className="text-xs text-muted-foreground font-medium mt-1 line-clamp-2 h-8">
                        {plan.description || "لا يوجد وصف تفصيلي لهذه الباقة."}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-1">دورة الدفع</span>
                        <span className="text-xs font-black text-white">{billingCycleText}</span>
                      </div>
                      <div className="text-end">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-1">السعر</span>
                        <span className="text-lg font-black text-primary"><bdi>{formatCurrency(plan.price, plan.currency)}</bdi></span>
                      </div>
                    </div>

                    {/* Features list */}
                    <div className="space-y-3 pt-2 text-start flex-1">
                      <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>
                          {plan.is_unlimited ? (
                            <span className="text-white font-bold">حضور غير محدود للحصص</span>
                          ) : plan.max_classes_per_week ? (
                            <span>الحد الأقصى للحصص: <strong className="text-white font-bold">{plan.max_classes_per_week} حصص/أسبوع</strong></span>
                          ) : (
                            <span className="text-muted-foreground/60">لم يتم تحديد حد الحصص الأسبوعية</span>
                          )}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                        <CheckCircle2 className={cn("w-4 h-4 shrink-0", plan.setup_fee > 0 ? "text-primary" : "text-emerald-400")} />
                        <span>
                          {plan.setup_fee > 0 ? (
                            <span>رسوم تأسيس إضافية: <strong className="text-white font-bold"><bdi>{formatCurrency(plan.setup_fee, plan.currency)}</bdi></strong></span>
                          ) : (
                            <span className="text-white font-bold">بدون رسوم تأسيس</span>
                          )}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                        <CheckCircle2 className={cn("w-4 h-4 shrink-0", plan.tax_rate > 0 ? "text-primary" : "text-emerald-400")} />
                        <span>
                          {plan.tax_rate > 0 ? (
                            <span>معدل الضريبة: <strong className="text-white font-bold">{plan.tax_rate}%</strong></span>
                          ) : (
                            <span className="text-white font-bold">شامل كافة الضرائب</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="p-6 border-t border-white/5 bg-white/[0.02] flex items-center gap-3">
                    <button
                      onClick={() => handleEdit(plan)}
                      className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all flex items-center justify-center gap-2"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      تعديل الباقة
                    </button>
                    <button
                      onClick={() => handleDelete(plan)}
                      disabled={deleteMutation.isPending}
                      className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 text-muted-foreground hover:bg-red-500 hover:text-white transition-all flex items-center justify-center active:scale-90"
                    >
                      {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <MembershipPlanDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          plan={editingPlan}
        />

        {planToDelete && (
          <Modal open={!!planToDelete} onClose={() => setPlanToDelete(null)} size="sm">
            <ModalHeader
              icon={<Trash2 className="w-5 h-5 text-red-500" />}
              title="حذف باقة الاشتراك"
              subtitle={planToDelete.name}
              onClose={() => setPlanToDelete(null)}
            />
            <ModalBody className="space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed text-start">
                هل أنت متأكد من رغبتك في حذف باقة الاشتراك هذه بشكل نهائي؟ لا يمكن التراجع عن هذا الإجراء.
              </p>
            </ModalBody>
            <ModalFooter>
              <div className="flex gap-3 w-full">
                <button
                  type="button"
                  onClick={() => setPlanToDelete(null)}
                  className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(planToDelete.id)}
                  className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-red-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  تأكيد الحذف
                </button>
              </div>
            </ModalFooter>
          </Modal>
        )}
      </div>
    </PermissionGuard>
  );
}
