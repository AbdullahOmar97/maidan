"use client";

import React, { useState } from "react";
import {
  UserCog, Save, Loader2, AlertCircle,
  User, Phone, Mail, MapPin, HeartPulse,
  Users, Calendar, FileText, ChevronRight, ChevronLeft
} from "lucide-react";
import { Student, Location } from "@/types";
import { Select } from "@/components/ui/select";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { FormField, Input, ErrorBanner } from "@/components/ui/form-field";
import { cn } from "@/lib/utils";

interface EditStudentModalProps {
  student: Student;
  locations: Location[];
  isPending: boolean;
  onClose: () => void;
  onChange: (updated: Partial<Student>) => void;
  onSave: () => void;
  error?: string;
}

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const EMERGENCY_RELATIONS = [
  "أب",
  "أم",
  "ولي أمر",
  "أخ",
  "أخت",
  "قريب",
  "صديق",
  "أخرى",
];

export function EditStudentModal({
  student,
  locations,
  isPending,
  onClose,
  onChange,
  onSave,
  error,
}: EditStudentModalProps) {
  const [activeTab, setActiveTab] = useState<"basic" | "personal" | "medical" | "notes">("basic");

  const set = (key: string, value: any) =>
    onChange({ [key]: value });

  return (
    <Modal open onClose={onClose} size="xl">
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
        {/* Navigation Tabs */}
        <div className="shrink-0 px-6 sm:px-8 pt-3 pb-2 border-b border-white/[0.06] bg-white/[0.01]">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab("basic")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 border",
                activeTab === "basic"
                  ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                  : "bg-white/[0.03] text-muted-foreground hover:bg-white/[0.06] hover:text-white border-white/[0.05]"
              )}
            >
              <User className="w-3.5 h-3.5 shrink-0" />
              <span>الأساسية والتواصل</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("personal")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 border",
                activeTab === "personal"
                  ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                  : "bg-white/[0.03] text-muted-foreground hover:bg-white/[0.06] hover:text-white border-white/[0.05]"
              )}
            >
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>الشخصية والطوارئ</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("medical")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 border",
                activeTab === "medical"
                  ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                  : "bg-white/[0.03] text-muted-foreground hover:bg-white/[0.06] hover:text-white border-white/[0.05]"
              )}
            >
              <HeartPulse className="w-3.5 h-3.5 shrink-0" />
              <span>السجل الطبي</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("notes")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 border",
                activeTab === "notes"
                  ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                  : "bg-white/[0.03] text-muted-foreground hover:bg-white/[0.06] hover:text-white border-white/[0.05]"
              )}
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>الملاحظات</span>
            </button>
          </div>
        </div>

        <ModalBody className="space-y-4">
          <ErrorBanner message={error} />

          {/* TAB 1: BASIC & CONTACT */}
          {activeTab === "basic" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <FormField label="اسم الطالب (الاسم الكامل)" required>
                <Input
                  required
                  value={student.full_name || ""}
                  onChange={(e) => set("full_name", e.target.value)}
                  placeholder="مثال: عبدالله عمر سالم"
                />
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField label="الفرع / الموقع" required>
                  <Select
                    value={student.location_id}
                    onChange={(e) => set("location_id", parseInt(e.target.value, 10))}
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </Select>
                </FormField>

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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField label="رقم الهاتف">
                  <Input
                    type="tel"
                    value={student.phone || ""}
                    onChange={(e) => set("phone", e.target.value)}
                    placeholder="05x xxx xxxx"
                  />
                </FormField>

                <FormField label="رقم الواتساب">
                  <Input
                    type="tel"
                    value={student.whatsapp || ""}
                    onChange={(e) => set("whatsapp", e.target.value)}
                    placeholder="05x xxx xxxx"
                  />
                </FormField>

                <FormField label="البريد الإلكتروني">
                  <Input
                    type="email"
                    value={student.email || ""}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="student@example.com"
                  />
                </FormField>
              </div>
            </div>
          )}

          {/* TAB 2: PERSONAL & EMERGENCY */}
          {activeTab === "personal" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="تاريخ الميلاد">
                  <Input
                    type="date"
                    value={student.date_of_birth || ""}
                    onChange={(e) => set("date_of_birth", e.target.value || null)}
                  />
                </FormField>

                <FormField label="رمز الجنسية">
                  <Input
                    value={student.nationality || ""}
                    onChange={(e) => set("nationality", e.target.value)}
                    placeholder="SA, JO, EG..."
                  />
                </FormField>
              </div>

              <div className="pt-2 border-t border-white/5 space-y-4">
                <p className="text-xs font-bold text-white flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-blue-400" />
                  بيانات التواصل في حالات الطوارئ
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField label="اسم جهة الطوارئ / ولي الأمر">
                    <Input
                      value={student.emergency_contact_name || ""}
                      onChange={(e) => set("emergency_contact_name", e.target.value)}
                      placeholder="عمر سالم (الأب)"
                    />
                  </FormField>

                  <FormField label="هاتف الطوارئ">
                    <Input
                      type="tel"
                      value={student.emergency_contact_phone || ""}
                      onChange={(e) => set("emergency_contact_phone", e.target.value)}
                      placeholder="05x xxx xxxx"
                    />
                  </FormField>

                  <FormField label="صلة القرابة">
                    <Select
                      value={student.emergency_contact_relation || ""}
                      onChange={(e) => set("emergency_contact_relation", e.target.value)}
                    >
                      <option value="">اختر...</option>
                      {EMERGENCY_RELATIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MEDICAL */}
          {activeTab === "medical" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="فصيلة الدم">
                  <Select
                    value={student.blood_type || ""}
                    onChange={(e) => set("blood_type", e.target.value)}
                  >
                    <option value="">غير محددة</option>
                    {BLOOD_TYPES.map((bt) => (
                      <option key={bt} value={bt}>
                        {bt}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField label="الحساسية إن وجدت">
                  <Input
                    value={student.allergies || ""}
                    onChange={(e) => set("allergies", e.target.value)}
                    placeholder="حساسية أدوية، أطعمة..."
                  />
                </FormField>
              </div>

              <FormField label="ملاحظات طبية أو حالات خاصة">
                <textarea
                  value={student.medical_notes || ""}
                  onChange={(e) => set("medical_notes", e.target.value)}
                  rows={3}
                  placeholder="ملاحظات صحية، إصابات سابقة..."
                  className="w-full px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/10 text-white text-xs font-semibold focus:border-primary/50 focus:bg-white/[0.05] focus:outline-none transition-all placeholder:text-muted-foreground/30 resize-none"
                />
              </FormField>
            </div>
          )}

          {/* TAB 4: NOTES */}
          {activeTab === "notes" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <FormField label="ملاحظات عامة حول الطالب">
                <textarea
                  value={student.notes || ""}
                  onChange={(e) => set("notes", e.target.value)}
                  rows={3}
                  placeholder="ملاحظات عامة..."
                  className="w-full px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/10 text-white text-xs font-semibold focus:border-primary/50 focus:bg-white/[0.05] focus:outline-none transition-all placeholder:text-muted-foreground/30 resize-none"
                />
              </FormField>

              <FormField label="ملاحظات داخلية خاصة بالإدارة">
                <textarea
                  value={student.internal_notes || ""}
                  onChange={(e) => set("internal_notes", e.target.value)}
                  rows={3}
                  placeholder="ملاحظات سرية للكادر الإداري والتدريبي..."
                  className="w-full px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/10 text-white text-xs font-semibold focus:border-primary/50 focus:bg-white/[0.05] focus:outline-none transition-all placeholder:text-muted-foreground/30 resize-none"
                />
              </FormField>
            </div>
          )}
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