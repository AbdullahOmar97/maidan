"use client";

import React from "react";
import { UserPlus, Save, Loader2, Shield, MapPin } from "lucide-react";
import { ROLE_LABELS } from "@/lib/constants";
import { Location } from "@/types";
import { Select } from "@/components/ui/select";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { FormField, Input, InfoBanner } from "@/components/ui/form-field";

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

          {canAssignBranch && locations.length > 0 && (
            <FormField label="الفرع">
              <Select
                value={form.primary_location_id}
                onChange={(e) => set("primary_location_id", e.target.value)}
              >
                <option value="">بدون فرع محدد</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </Select>
            </FormField>
          )}

          <InfoBanner icon={<Shield className="w-4 h-4" />}>
            سيتم إضافة الموظف بدون كلمة مرور. عند تسجيل الدخول الأول، سيُطلب منه ضبط كلمة المرور وتأكيد هويته.
          </InfoBanner>
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
            إضافة الموظف
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
