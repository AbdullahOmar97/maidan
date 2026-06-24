"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { Save, Loader2, Sparkles, Tag, DollarSign, Clock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { MembershipPlan } from "@/types";
import { Select } from "@/components/ui/select";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { FormField, Input, Textarea } from "@/components/ui/form-field";

interface MembershipPlanDialogProps {
  isOpen: boolean;
  onClose: () => void;
  plan?: MembershipPlan;
}

const DEFAULT_FORM = {
  name: "",
  description: "",
  price: "",
  billing_cycle: "monthly",
  currency: "JOD",
  tax_rate: "15.00",
  is_active: true,
  is_public: true,
};

export default function MembershipPlanDialog({ isOpen, onClose, plan }: MembershipPlanDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(DEFAULT_FORM);

  const set = (key: keyof typeof DEFAULT_FORM, value: any) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (plan) {
      setFormData({
        name: plan.name,
        description: plan.description ?? "",
        price: plan.price.toString(),
        billing_cycle: plan.billing_cycle,
        currency: plan.currency,
        tax_rate: plan.tax_rate.toString(),
        is_active: plan.is_active,
        is_public: plan.is_public,
      });
    } else {
      setFormData(DEFAULT_FORM);
      if (isOpen) {
        api.tenants.me().then((res: any) => {
          if (res.data?.default_currency) {
            setFormData((prev) => ({ ...prev, currency: res.data.default_currency }));
          }
        });
      }
    }
  }, [plan, isOpen]);

  const mutation = useMutation({
    mutationFn: (data: any) =>
      plan ? api.billing.plans.update(plan.id, data) : api.billing.plans.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "plans"] });
      toast.success(plan ? "تم تحديث الباقة بنجاح" : "تم إنشاء الباقة بنجاح");
      onClose();
    },
    onError: () => {
      toast.error("فشل حفظ الباقة. يرجى التحقق من البيانات.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  return (
    <Modal open={isOpen} onClose={onClose} size="lg">
      <ModalHeader
        icon={<Sparkles className="w-5 h-5" />}
        title={plan ? "تعديل باقة الاشتراك" : "إنشاء باقة اشتراك جديدة"}
        subtitle="أدخل تفاصيل الباقة والأسعار والفوترة"
        onClose={onClose}
      />

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <ModalBody className="space-y-5">
          {/* Basic info */}
          <FormField label="اسم الباقة" required>
            <div className="relative">
              <Tag className="absolute end-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                required

                placeholder="مثال: الباقة الأساسية"
                className="pe-10"
                value={formData.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>
          </FormField>

          <FormField label="الوصف">
            <Textarea

              rows={3}
              placeholder="تفاصيل الباقة، المزايا، شروط الاشتراك..."
              value={formData.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </FormField>

          {/* Pricing row */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label="السعر" required>
              <div className="relative">
                <DollarSign className="absolute end-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  required
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="pe-10"
                  value={formData.price}
                  onChange={(e) => set("price", e.target.value)}
                />
              </div>
            </FormField>

            <FormField label="نسبة الضريبة (%)">
              <Input
                type="number"
                step="0.01"
                value={formData.tax_rate}
                onChange={(e) => set("tax_rate", e.target.value)}
              />
            </FormField>
          </div>

          {/* Cycle & currency row */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label="دورة الفوترة" required>
              <Select
                value={formData.billing_cycle}
                onChange={(e) => set("billing_cycle", e.target.value)}
              >
                <option value="weekly">أسبوعي</option>
                <option value="monthly">شهري</option>
                <option value="quarterly">ربع سنوي (3 أشهر)</option>
                <option value="semi_annual">نصف سنوي (6 أشهر)</option>
                <option value="annual">سنوي</option>
                <option value="one_time">مرة واحدة</option>
              </Select>
            </FormField>

            <FormField label="العملة" required>
              <Select
                value={formData.currency}
                onChange={(e) => set("currency", e.target.value)}
              >
                <option value="JOD">دينار أردني (JOD)</option>
                <option value="SAR">ريال سعودي (SAR)</option>
                <option value="USD">دولار أمريكي (USD)</option>
                <option value="AED">درهم إماراتي (AED)</option>
                <option value="EGP">جنيه مصري (EGP)</option>
                <option value="KWD">دينار كويتي (KWD)</option>
                <option value="QAR">ريال قطري (QAR)</option>
                <option value="BHD">دينار بحريني (BHD)</option>
                <option value="OMR">ريال عماني (OMR)</option>
              </Select>
            </FormField>
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                { key: "is_active", label: "الباقة نشطة", activeClass: "bg-emerald-500/10 border-emerald-500/25 text-emerald-400" },
                { key: "is_public", label: "عرض عام للطلاب", activeClass: "bg-primary/10 border-primary/25 text-primary" },
              ] as const
            ).map(({ key, label, activeClass }) => {
              const isOn = formData[key] as boolean;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => set(key, !isOn)}
                  className={cn(
                    "flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all",
                    isOn ? activeClass : "bg-secondary/20 border-border/50 text-muted-foreground"
                  )}
                >
                  <span className="text-xs font-semibold">{label}</span>
                  {/* Toggle pill */}
                  <div
                    className={cn(
                      "w-9 h-5 rounded-full relative transition-colors",
                      isOn
                        ? key === "is_active" ? "bg-emerald-500" : "bg-primary"
                        : "bg-muted"
                    )}
                  >
                    <div
                      className={cn(
                        "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all",
                        isOn ? "end-0.5" : "end-4.5"
                      )}
                    />
                  </div>
                </button>
              );
            })}
          </div>
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
              disabled={mutation.isPending}
              className="flex-1 py-3 rounded-xl gradient-brand text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {plan ? "تحديث الباقة" : "إنشاء الباقة"}
            </button>
          </div>
        </ModalFooter>
      </form>
    </Modal>
  );
}
