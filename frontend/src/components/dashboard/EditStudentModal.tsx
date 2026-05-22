"use client";

import React from "react";
import { UserCog, Save, Loader2, AlertCircle } from "lucide-react";
import { Student, Location } from "@/types";
import { Select } from "@/components/ui/select";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { FormField, Input } from "@/components/ui/form-field";

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
          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 text-red-500 text-sm border border-red-500/20 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="whitespace-pre-wrap">{error}</div>
            </div>
          )}

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
                dir="ltr"
                value={student.email || ""}
                onChange={(e) => set("email", e.target.value)}
              />
            </FormField>
            <FormField label="رقم الهاتف" required>
              <Input
                required
                type="tel"
                dir="ltr"
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
