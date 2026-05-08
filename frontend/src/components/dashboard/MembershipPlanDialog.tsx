"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { 
  X, Save, Loader2, Sparkles, Tag, Description, 
  DollarSign, Clock, Hash, Globe, CheckCircle2, AlertCircle 
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { MembershipPlan } from "@/types";

interface MembershipPlanDialogProps {
  isOpen: boolean;
  onClose: () => void;
  plan?: MembershipPlan; // If provided, we are editing
}

export default function MembershipPlanDialog({ isOpen, onClose, plan }: MembershipPlanDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    billing_cycle: "monthly",
    currency: "JOD",
    tax_rate: "15.00",
    is_active: true,
    is_public: true,
  });

  useEffect(() => {
    if (plan) {
      setFormData({
        name: plan.name,
        description: plan.description || "",
        price: plan.price.toString(),
        billing_cycle: plan.billing_cycle,
        currency: plan.currency,
        tax_rate: plan.tax_rate.toString(),
        is_active: plan.is_active,
        is_public: plan.is_public,
      });
    } else {
      setFormData({
        name: "",
        description: "",
        price: "",
        billing_cycle: "monthly",
        currency: "JOD",
        tax_rate: "15.00",
        is_active: true,
        is_public: true,
      });
    }
  }, [plan, isOpen]);

  const mutation = useMutation({
    mutationFn: (data: any) => {
      if (plan) {
        return api.billing.plans.update(plan.id, data);
      }
      return api.billing.plans.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "plans"] });
      toast.success(plan ? "تم تحديث الباقة بنجاح" : "تم إنشاء الباقة بنجاح");
      onClose();
    },
    onError: (err: any) => {
      toast.error("فشل حفظ الباقة. يرجى التحقق من البيانات.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-[#0B0F1A] border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className="relative p-8 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl gradient-brand flex items-center justify-center shadow-lg shadow-primary/20">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white">{plan ? "تعديل باقة" : "إنشاء باقة اشتراك جديدة"}</h2>
                <p className="text-sm text-muted-foreground font-medium">أدخل تفاصيل الباقة والأسعار والفوترة</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Info */}
            <div className="md:col-span-2 space-y-2 text-right">
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-2">اسم الباقة</label>
              <div className="relative group">
                <Tag className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  required
                  dir="rtl"
                  type="text"
                  placeholder="مثال: الباقة الأساسية"
                  className="w-full pr-11 pl-4 py-3.5 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-bold text-white"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>

            <div className="md:col-span-2 space-y-2 text-right">
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-2">الوصف</label>
              <textarea
                dir="rtl"
                rows={3}
                placeholder="تفاصيل الباقة، المزايا، شروط الاشتراك..."
                className="w-full px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-bold text-white resize-none"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            {/* Pricing */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mr-2">السعر</label>
              <div className="relative group">
                <DollarSign className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  required
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full pr-11 pl-4 py-3.5 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-bold text-white"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mr-2">دورة الفوترة</label>
              <select
                className="w-full px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-black text-white appearance-none cursor-pointer"
                value={formData.billing_cycle}
                onChange={(e) => setFormData({ ...formData, billing_cycle: e.target.value })}
              >
                <option value="weekly" className="bg-[#0B0F1A]">أسبوعي</option>
                <option value="monthly" className="bg-[#0B0F1A]">شهري</option>
                <option value="quarterly" className="bg-[#0B0F1A]">ربع سنوي (3 أشهر)</option>
                <option value="semi_annual" className="bg-[#0B0F1A]">نصف سنوي (6 أشهر)</option>
                <option value="annual" className="bg-[#0B0F1A]">سنوي</option>
                <option value="one_time" className="bg-[#0B0F1A]">مرة واحدة</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mr-2">العملة</label>
              <select
                className="w-full px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-black text-white appearance-none cursor-pointer"
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              >
                <option value="JOD" className="bg-[#0B0F1A]">دينار أردني (JOD)</option>
                <option value="SAR" className="bg-[#0B0F1A]">ريال سعودي (SAR)</option>
                <option value="USD" className="bg-[#0B0F1A]">دولار أمريكي (USD)</option>
                <option value="AED" className="bg-[#0B0F1A]">درهم إماراتي (AED)</option>
                <option value="EGP" className="bg-[#0B0F1A]">جنيه مصري (EGP)</option>
                <option value="KWD" className="bg-[#0B0F1A]">دينار كويتي (KWD)</option>
                <option value="QAR" className="bg-[#0B0F1A]">ريال قطري (QAR)</option>
                <option value="BHD" className="bg-[#0B0F1A]">دينار بحريني (BHD)</option>
                <option value="OMR" className="bg-[#0B0F1A]">ريال عماني (OMR)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mr-2">نسبة الضريبة (%)</label>
              <input
                type="number"
                step="0.01"
                className="w-full px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-black text-white"
                value={formData.tax_rate}
                onChange={(e) => setFormData({ ...formData, tax_rate: e.target.value })}
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
              className={cn(
                "flex items-center justify-between p-4 rounded-2xl border transition-all",
                formData.is_active 
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                  : "bg-white/5 border-white/10 text-muted-foreground"
              )}
            >
              <span className="text-xs font-black uppercase tracking-widest">الباقة نشطة</span>
              <div className={cn(
                "w-10 h-5 rounded-full relative transition-colors",
                formData.is_active ? "bg-emerald-500" : "bg-white/10"
              )}>
                <div className={cn(
                  "absolute top-1 w-3 h-3 rounded-full bg-white transition-all",
                  formData.is_active ? "right-6" : "right-1"
                )} />
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFormData({ ...formData, is_public: !formData.is_public })}
              className={cn(
                "flex items-center justify-between p-4 rounded-2xl border transition-all",
                formData.is_public 
                  ? "bg-primary/10 border-primary/20 text-primary" 
                  : "bg-white/5 border-white/10 text-muted-foreground"
              )}
            >
              <span className="text-xs font-black uppercase tracking-widest">عرض عام</span>
              <div className={cn(
                "w-10 h-5 rounded-full relative transition-colors",
                formData.is_public ? "bg-primary" : "bg-white/10"
              )}>
                <div className={cn(
                  "absolute top-1 w-3 h-3 rounded-full bg-white transition-all",
                  formData.is_public ? "right-6" : "right-1"
                )} />
              </div>
            </button>
          </div>
        </form>

        <div className="p-8 border-t border-white/5 bg-white/[0.02] flex items-center justify-end gap-4">
          <button
            type="button"
            onClick={onClose}
            className="px-8 py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest text-muted-foreground hover:bg-white/10 transition-all"
          >
            إلغاء
          </button>
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="px-8 py-3 rounded-xl gradient-brand text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{plan ? "تحديث البيانات" : "إنشاء الباقة"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
