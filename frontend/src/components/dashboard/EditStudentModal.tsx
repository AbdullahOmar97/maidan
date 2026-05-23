"use client";

import React from "react";
import { UserCog, Save, Loader2, AlertCircle } from "lucide-react";
import { Student, Location } from "@/types";
import { Select } from "@/components/ui/select";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { FormField, Input, ErrorBanner } from "@/components/ui/form-field";

interface EditStudentModalProps {
  student: Student;
  locations: Location[];
  isPending: boolean;
  onClose: () => void;
  onChange: (updated: Partial<Student>) => void;
  onSave: () => void;
  error?: string;
}

export function EditStudentModal({
  student,
  locations,
  isPending,
  onClose,
  onChange,
  onSave,
  error,
}: EditStudentModalProps) {
  const set = (key: string, value: any) =>
    onChange({ [key]: value });

  return (
    <Modal open onClose={onClose} size="md">
      <ModalHeader
        icon={<UserCog className="w-5 h-5" />}
        title="تعديل بيانات الطالب"
        subtitle={student.full_name}
        onClose={onClose}
      />

      <form
        onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          onSave();
        }}
        className="flex flex-col flex-1 min-h-0"
      >
        <ModalBody className="space-y-4">
          <ErrorBanner message={error} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="الاسم الأول" required>
              <Input
                required
                value={student.first_name}
                onChange={(e) => set("first_name", e.target.value)}
              />
            </FormField>
            <FormField label="الاسم الأخير" required>
              <Input
                required
                value={student.last_name}
                onChange={(e) => set("last_name", e.target.value)}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="البريد الإلكتروني">
              <Input
                type="email"

                value={student.email || ""}
                onChange={(e) => set("email", e.target.value)}
              />
            </FormField>
            <FormField label="رقم الهاتف" required>
              <Input
                required
                type="tel"

                value={student.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="الجنس" required>
              <Select
                value={student.gender}
                onChange={(e) => set("gender", e.target.value)}
              >
                <option value="male">ذكر</option>
                <option value="female">أنثى</option>
              </Select>
            </FormField>
            <FormField label="الحالة" required>
              <Select
                value={student.status}
                onChange={(e) => set("status", e.target.value)}
              >
                <option value="active">نشط</option>
                <option value="trial">تجريبي</option>
                <option value="lead">عميل محتمل</option>
                <option value="suspended">موقوف</option>
                <option value="inactive">غير نشط</option>
                <option value="graduated">خريج</option>
              </Select>
            </FormField>
          </div>

          <FormField label="الفرع / الموقع" required>
            <Select
              value={student.location_id}
              onChange={(e) => set("location_id", parseInt(e.target.value))}
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </Select>
          </FormField>
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
              حفظ التغييرات
            </button>
          </div>
        </ModalFooter>
      </form>
    </Modal>
  );
}
