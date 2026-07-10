"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { toast } from "sonner";
import { parseApiError } from "@/lib/utils";
import { Loader2, Users, X, Phone, Mail, MapPin, FileText } from "lucide-react";
import type { Family } from "@/types";

interface FamilyFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  existing?: Family | null;
  onSuccess?: (family: Family) => void;
}

const EMPTY_FORM = {
  name: "",
  primary_contact_name: "",
  primary_contact_phone: "",
  primary_contact_email: "",
  billing_address: "",
  notes: "",
};

export default function FamilyFormDialog({ isOpen, onClose, existing, onSuccess }: FamilyFormDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = !!existing;
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name || "",
        primary_contact_name: existing.primary_contact_name || "",
        primary_contact_phone: existing.primary_contact_phone || "",
        primary_contact_email: existing.primary_contact_email || "",
        billing_address: existing.billing_address || "",
        notes: existing.notes || "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [existing, isOpen]);

  const mutation = useMutation({
    mutationFn: (data: typeof EMPTY_FORM) =>
      isEdit
        ? api.families.update(existing!.id, data)
        : api.families.create(data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["families"] });
      toast.success(isEdit ? "تم تحديث بيانات العائلة بنجاح" : "تم إنشاء العائلة بنجاح");
      onSuccess?.(res.data);
      onClose();
    },
    onError: (err: any) => {
      toast.error(parseApiError(err, "حدث خطأ أثناء حفظ بيانات العائلة."));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.primary_contact_name.trim() || !form.primary_contact_phone.trim()) {
      toast.error("يرجى ملء جميع الحقول الإلزامية.");
      return;
    }
    mutation.mutate(form);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg glass-card flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Decorative gradient */}
        <div className="absolute top-0 end-0 w-48 h-48 bg-primary/10 blur-3xl -me-24 -mt-24 pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center shadow-lg shadow-primary/20">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">{isEdit ? "تعديل بيانات العائلة" : "إنشاء عائلة جديدة"}</h2>
              <p className="text-xs font-bold text-muted-foreground">ربط الطلاب بحساب عائلي موحّد</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 flex items-center justify-center text-muted-foreground hover:text-red-400 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Family Name */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Users className="w-3 h-3" />
              اسم العائلة <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="مثال: عائلة الأحمد"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:bg-white/8 transition-all"
              required
            />
          </div>

          {/* Primary Contact Name */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
              اسم المسؤول الرئيسي <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.primary_contact_name}
              onChange={(e) => setForm((f) => ({ ...f, primary_contact_name: e.target.value }))}
              placeholder="اسم ولي الأمر"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-all"
              required
            />
          </div>

          {/* Phone & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Phone className="w-3 h-3" />
                رقم الهاتف <span className="text-red-400">*</span>
              </label>
              <input
                type="tel"
                value={form.primary_contact_phone}
                onChange={(e) => setForm((f) => ({ ...f, primary_contact_phone: e.target.value }))}
                placeholder="07xxxxxxxx"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-all"
                dir="ltr"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Mail className="w-3 h-3" />
                البريد الإلكتروني
              </label>
              <input
                type="email"
                value={form.primary_contact_email}
                onChange={(e) => setForm((f) => ({ ...f, primary_contact_email: e.target.value }))}
                placeholder="email@example.com"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-all"
                dir="ltr"
              />
            </div>
          </div>

          {/* Billing Address */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <MapPin className="w-3 h-3" />
              عنوان الفواتير
            </label>
            <input
              type="text"
              value={form.billing_address}
              onChange={(e) => setForm((f) => ({ ...f, billing_address: e.target.value }))}
              placeholder="عنوان ولي الأمر (اختياري)"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-all"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <FileText className="w-3 h-3" />
              ملاحظات
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder="أي ملاحظات إضافية حول العائلة..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-all resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
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
              className="flex-1 py-3 rounded-xl gradient-brand text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {mutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Users className="w-4 h-4" />
              )}
              {isEdit ? "حفظ التغييرات" : "إنشاء العائلة"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
