"use client";
import React from "react";
import { UserPlus, X, Save, Loader2, Shield, MapPin } from "lucide-react";
import { ROLE_LABELS } from "@/lib/constants";
import { Location } from "@/types";

const STAFF_ROLES: { id: string; label: string }[] = [
  { id: "manager",        label: ROLE_LABELS.manager },
  { id: "branch_manager", label: ROLE_LABELS.branch_manager },
  { id: "front_desk",     label: ROLE_LABELS.front_desk },
  { id: "instructor",     label: ROLE_LABELS.instructor },
  { id: "finance",        label: ROLE_LABELS.finance },
];

export interface NewStaffFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: string;
  primary_location_id: string;
}

export const INITIAL_STAFF_FORM: NewStaffFormData = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  role: "instructor",
  primary_location_id: "",
};

interface AddStaffModalProps {
  form: NewStaffFormData;
  locations: Location[];
  canAssignBranch: boolean;
  isPending: boolean;
  onClose: () => void;
  onChange: (updated: NewStaffFormData) => void;
  onSubmit: () => void;
}

export function AddStaffModal({
  form,
  locations,
  canAssignBranch,
  isPending,
  onClose,
  onChange,
  onSubmit,
}: AddStaffModalProps) {
  const handleField = <K extends keyof NewStaffFormData>(key: K, value: NewStaffFormData[K]) =>
    onChange({ ...form, [key]: value });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl glass-card p-0 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-border/50 flex items-center justify-between bg-secondary/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-lg font-bold">إضافة موظف جديد</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={(e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); onSubmit(); }}
          className="p-6 space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-muted-foreground mr-1">الاسم الأول</label>
              <input
                required type="text" value={form.first_name} placeholder="أحمد"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleField("first_name", e.target.value)}
                className="w-full bg-secondary/30 border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-muted-foreground mr-1">الاسم الأخير</label>
              <input
                required type="text" value={form.last_name} placeholder="محمد"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleField("last_name", e.target.value)}
                className="w-full bg-secondary/30 border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-muted-foreground mr-1">البريد الإلكتروني</label>
              <input
                required type="email" dir="ltr" value={form.email} placeholder="example@maidan.app"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleField("email", e.target.value)}
                className="w-full bg-secondary/30 border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-left"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-muted-foreground mr-1">رقم الهاتف</label>
              <input
                required type="tel" dir="ltr" value={form.phone} placeholder="05xxxxxxx"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleField("phone", e.target.value)}
                className="w-full bg-secondary/30 border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-left"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-muted-foreground mr-1">الدور الوظيفي</label>
            <select
              value={form.role}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleField("role", e.target.value)}
              className="w-full bg-secondary/30 border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            >
              {STAFF_ROLES.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>

          {canAssignBranch && locations.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-bold text-muted-foreground mr-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                الفرع
              </label>
              <select
                value={form.primary_location_id}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleField("primary_location_id", e.target.value)}
                className="w-full bg-secondary/30 border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              >
                <option value="">بدون فرع محدد</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name_ar || loc.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 flex items-start gap-3 mt-4">
            <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              سيتم إضافة الموظف بدون كلمة مرور. عند تسجيل الدخول الأول، سيُطلب منه ضبط كلمة المرور وتأكيد هويته.
            </p>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl border border-border hover:bg-secondary transition-all font-medium">
              إلغاء
            </button>
            <button
              disabled={isPending}
              className="px-8 py-2.5 rounded-xl gradient-brand text-white font-bold hover:opacity-90 shadow-lg shadow-primary/20 transition-all flex items-center gap-2 disabled:opacity-60"
            >
              {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              إضافة الموظف
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
