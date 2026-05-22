"use client";

import React from "react";
import { UserPlus, Save, Loader2, Shield, MapPin } from "lucide-react";
import { ROLE_LABELS } from "@/lib/constants";
import { Location } from "@/types";
import { Select } from "@/components/ui/select";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { FormField, Input, InfoBanner } from "@/components/ui/form-field";
import { MultiSelect } from "@/components/ui/multi-select";

const STAFF_ROLES: { id: string; label: string }[] = [
  { id: "manager",        label: ROLE_LABELS.manager },
  { id: "branch_manager", label: ROLE_LABELS.branch_manager },
  { id: "front_desk",     label: ROLE_LABELS.front_desk },
  { id: "instructor",     label: ROLE_LABELS.instructor },
  { id: "finance",        label: ROLE_LABELS.finance },
  { id: "staff",          label: ROLE_LABELS.staff },
];

export interface NewStaffFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: string;
  assigned_location_ids: number[];
}

export const INITIAL_STAFF_FORM: NewStaffFormData = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  role: "instructor",
  assigned_location_ids: [],
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
  const set = <K extends keyof NewStaffFormData>(key: K, value: NewStaffFormData[K]) =>
    onChange({ ...form, [key]: value });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <Modal open onClose={onClose} size="md">
      <ModalHeader
        icon={<UserPlus className="w-5 h-5" />}
        title="إضافة موظف جديد"
        subtitle="سيتم إرسال دعوة إلى بريده الإلكتروني"
        onClose={onClose}
      />

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <ModalBody className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="الاسم الأول" required>
              <Input
                required
                placeholder="أحمد"
                value={form.first_name}
                onChange={(e) => set("first_name", e.target.value)}
              />
            </FormField>
            <FormField label="الاسم الأخير" required>
              <Input
                required
                placeholder="محمد"
                value={form.last_name}
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
                placeholder="name@example.com"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </FormField>
            <FormField label="رقم الهاتف" required>
              <Input
                required
                type="tel"
                dir="ltr"
                placeholder="05xxxxxxx"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </FormField>
          </div>

          <FormField label="الدور الوظيفي" required>
            <Select
              value={form.role}
              onChange={(e) => set("role", e.target.value)}
            >
              {STAFF_ROLES.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </Select>
          </FormField>

          {canAssignBranch && (
            <FormField label="الفروع المخصصة">
              <MultiSelect
                options={locations}
                selectedIds={form.assigned_location_ids}
                onChange={(ids) => set("assigned_location_ids", ids)}
                placeholder="اختر الفروع المخصصة..."
              />
            </FormField>
          )}

          <InfoBanner icon={<Shield className="w-4 h-4" />}>
            سيتم إضافة الموظف بدون كلمة مرور. عند تسجيل الدخول الأول، سيُطلب منه ضبط كلمة المرور وتأكيد هويته.
          </InfoBanner>
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
              disabled={isPending}
              className="flex-1 py-3 rounded-xl gradient-brand text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              إضافة الموظف
            </button>
          </div>
        </ModalFooter>
      </form>
    </Modal>
  );
}
