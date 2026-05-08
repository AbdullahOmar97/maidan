"use client";
import React from "react";
import { UserCog, X, Save, Loader2, Power, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/constants";
import { StaffMember, UserRole, Location } from "@/types";

const STAFF_ROLES: { id: string; label: string }[] = [
  { id: "manager",        label: ROLE_LABELS.manager },
  { id: "branch_manager", label: ROLE_LABELS.branch_manager },
  { id: "front_desk",     label: ROLE_LABELS.front_desk },
  { id: "instructor",     label: ROLE_LABELS.instructor },
  { id: "finance",        label: ROLE_LABELS.finance },
];

interface EditStaffModalProps {
  staff: StaffMember;
  locations: Location[];
  canAssignBranch: boolean;
  isPending: boolean;
  onClose: () => void;
  onChange: (updated: StaffMember) => void;
  onSave: () => void;
}

export function EditStaffModal({
  staff,
  locations,
  canAssignBranch,
  isPending,
  onClose,
  onChange,
  onSave,
}: EditStaffModalProps) {
  const isOwner = staff.role === "tenant_owner";

  const handleField = <K extends keyof StaffMember>(key: K, value: StaffMember[K]) =>
    onChange({ ...staff, [key]: value });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl glass-card p-0 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-border/50 flex items-center justify-between bg-secondary/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <UserCog className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-lg font-bold">تعديل بيانات الموظف</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={(e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); onSave(); }}
          className="p-6 space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-muted-foreground mr-1">الاسم الأول</label>
              <input
                required type="text" value={staff.first_name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleField("first_name", e.target.value)}
                className="w-full bg-secondary/30 border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-muted-foreground mr-1">الاسم الأخير</label>
              <input
                required type="text" value={staff.last_name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleField("last_name", e.target.value)}
                className="w-full bg-secondary/30 border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-muted-foreground mr-1">البريد الإلكتروني</label>
              <input
                required type="email" dir="ltr" value={staff.email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleField("email", e.target.value)}
                className="w-full bg-secondary/30 border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-left"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-muted-foreground mr-1">رقم الهاتف</label>
              <input
                required type="tel" dir="ltr" value={staff.phone}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleField("phone", e.target.value)}
                className="w-full bg-secondary/30 border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-left"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-muted-foreground mr-1">الدور الوظيفي</label>
            <select
              disabled={isOwner}
              value={staff.role}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleField("role", e.target.value as UserRole)}
              className="w-full bg-secondary/30 border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 outline-none transition-all disabled:opacity-50"
            >
              {isOwner && <option value="tenant_owner">{ROLE_LABELS.tenant_owner}</option>}
              {STAFF_ROLES.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
            {isOwner && (
              <p className="text-[10px] text-amber-600 font-medium mr-1 mt-1">
                لا يمكن تغيير دور مالك الأكاديمية من هنا.
              </p>
            )}
          </div>

          {canAssignBranch && locations.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-bold text-muted-foreground mr-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                الفرع المخصص
              </label>
              <select
                value={staff.primary_location_id ?? ""}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  handleField("primary_location_id", e.target.value || null)
                }
                className="w-full bg-secondary/30 border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              >
                <option value="">بدون فرع محدد</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name_ar || loc.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="pt-4 border-t border-border/50">
            <div className="flex items-center justify-between p-4 bg-secondary/20 rounded-2xl border border-border/50">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                  staff.is_active ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                )}>
                  <Power className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-sm">حالة الحساب</p>
                  <p className="text-xs text-muted-foreground">
                    {staff.is_active ? "الحساب نشط ويمكنه الدخول" : "الحساب معطل ولا يمكنه الدخول"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleField("is_active", !staff.is_active)}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2",
                  staff.is_active ? "bg-primary" : "bg-muted"
                )}
              >
                <span className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  staff.is_active ? "-translate-x-6" : "-translate-x-1"
                )} />
              </button>
            </div>
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
              حفظ التغييرات
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
