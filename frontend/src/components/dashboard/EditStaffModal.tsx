"use client";

import React from "react";
import { UserCog, Save, Loader2, Power, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/constants";
import { StaffMember, UserRole, Location } from "@/types";
import { Select } from "@/components/ui/select";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { FormField, Input } from "@/components/ui/form-field";

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
  const set = <K extends keyof StaffMember>(key: K, value: StaffMember[K]) =>
    onChange({ ...staff, [key]: value });

  return (
    <Modal open onClose={onClose} size="md">
      <ModalHeader
        icon={<UserCog className="w-5 h-5" />}
        title="تعديل بيانات الموظف"
        subtitle={`${staff.first_name} ${staff.last_name}`}
        onClose={onClose}
      />

      <form
        onSubmit={(e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); onSave(); }}
        className="flex flex-col flex-1 min-h-0"
      >
        <ModalBody className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="الاسم الأول" required>
              <Input
                required
                value={staff.first_name}
                onChange={(e) => set("first_name", e.target.value)}
              />
            </FormField>
            <FormField label="الاسم الأخير" required>
              <Input
                required
                value={staff.last_name}
                onChange={(e) => set("last_name", e.target.value)}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="البريد الإلكتروني" required>
              <Input
                required
                type="email"
                dir="ltr"
                value={staff.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </FormField>
            <FormField label="رقم الهاتف" required>
              <Input
                required
                type="tel"
                dir="ltr"
                value={staff.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </FormField>
          </div>

          <FormField
            label="الدور الوظيفي"
            hint={isOwner ? "لا يمكن تغيير دور مالك الأكاديمية من هنا." : undefined}
          >
            <Select
              disabled={isOwner}
              value={staff.role}
              onChange={(e) => set("role", e.target.value as UserRole)}
            >
              {isOwner && <option value="tenant_owner">{ROLE_LABELS.tenant_owner}</option>}
              {STAFF_ROLES.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </Select>
          </FormField>

          {canAssignBranch && locations.length > 0 && (
            <FormField label="الفرع المخصص">
              <Select
                value={staff.primary_location_id ?? ""}
                onChange={(e) => set("primary_location_id", e.target.value || null)}
              >
                <option value="">بدون فرع محدد</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </Select>
            </FormField>
          )}

          {/* Active toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 border border-border/50">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
                staff.is_active ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-400"
              )}>
                <Power className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">حالة الحساب</p>
                <p className="text-xs text-muted-foreground">
                  {staff.is_active ? "الحساب نشط ويمكنه الدخول" : "الحساب معطل ولا يمكنه الدخول"}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={staff.is_active}
              onClick={() => set("is_active", !staff.is_active)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2",
                staff.is_active ? "bg-primary" : "bg-muted"
              )}
            >
              <span className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                staff.is_active ? "-translate-x-6" : "-translate-x-1"
              )} />
            </button>
          </div>
        </ModalBody>

        <ModalFooter>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-border hover:bg-secondary/60 transition-colors text-sm font-medium"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="px-6 py-2.5 rounded-xl gradient-brand text-white text-sm font-bold shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-60"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            حفظ التغييرات
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
