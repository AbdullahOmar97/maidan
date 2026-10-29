"use client";

import React, { useState, useEffect } from "react";
import {
  UserCog, Save, Loader2, AlertCircle,
  User, Phone, Mail, MapPin, HeartPulse,
  Users, Calendar, FileText, ChevronRight, ChevronLeft,
  ShieldCheck, Globe, Info
} from "lucide-react";
import { Student, Location, Family } from "@/types";
import { Select } from "@/components/ui/select";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { FormField, Input, ErrorBanner } from "@/components/ui/form-field";
import { cn } from "@/lib/utils";
import {
  NATIONALITIES,
  BLOOD_TYPES,
  LEAD_SOURCES,
  EMERGENCY_RELATIONS,
} from "@/lib/constants";
import { api } from "@/lib/api/client";

interface EditStudentModalProps {
  student: Student;
  locations: Location[];
  isPending: boolean;
  onClose: () => void;
  onChange: (updated: Partial<Student>) => void;
  onSave: () => void;
  error?: string;
}

type TabType = "basic" | "personal" | "medical" | "notes";

export function EditStudentModal({
  student,
  locations,
  isPending,
  onClose,
  onChange,
  onSave,
  error,
}: EditStudentModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("basic");
  const [families, setFamilies] = useState<Family[]>([]);
  const [loadingFamilies, setLoadingFamilies] = useState(false);

  useEffect(() => {
    setLoadingFamilies(true);
    api.families.list()
      .then((res: any) => {
        const famData = res.data?.results ?? res.data ?? [];
        setFamilies(Array.isArray(famData) ? famData : []);
      })
      .catch(() => setFamilies([]))
      .finally(() => setLoadingFamilies(false));
  }, []);

  const set = (key: keyof Student, value: any) =>
    onChange({ [key]: value });

  // Calculate age if DOB provided
  const calculatedAge = student.date_of_birth ? (() => {
    const today = new Date();
    const birth = new Date(student.date_of_birth);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age >= 0 ? age : null;
  })() : null;

  const copyPhoneToWhatsapp = () => {
    if (student.phone) {
      set("whatsapp", student.phone);
    }
  };

  const tabs = [
    {
      id: "basic" as TabType,
      label: "البيانات الأساسية",
      icon: User,
      badge: "إلزامي",
      badgeColor: "text-primary bg-primary/10 border-primary/20",
    },
    {
      id: "personal" as TabType,
      label: "الشخصية والعائلة",
      icon: Users,
      hasData: Boolean(student.date_of_birth || student.nationality || student.family_id || student.emergency_contact_name || student.emergency_contact_phone),
    },
    {
      id: "medical" as TabType,
      label: "السجل الطبي",
      icon: HeartPulse,
      hasData: Boolean(student.blood_type || student.allergies || student.medical_notes),
    },
    {
      id: "notes" as TabType,
      label: "الملاحظات والإقرارات",
      icon: FileText,
      hasData: Boolean(student.notes || student.internal_notes || student.source || student.waiver_signed || student.photo_consent),
    },
  ];

  return (
    <Modal open onClose={onClose} size="2xl">
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
        className="flex flex-col flex-1 min-h-0 overflow-hidden"
      >
        {/* Navigation Tabs */}
        <div className="shrink-0 px-6 sm:px-8 pt-3 pb-2 border-b border-white/[0.06] bg-white/[0.01]">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all shrink-0 border",
                    isActive
                      ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                      : "bg-white/[0.03] text-muted-foreground hover:bg-white/[0.06] hover:text-white border-white/[0.05]"
                  )}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-bold border", tab.badgeColor)}>
                      {tab.badge}
                    </span>
                  )}
                  {tab.hasData && !isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <ModalBody className="space-y-5">
          <ErrorBanner message={error} />

          {/* TAB 1: BASIC & CONTACT */}
          {activeTab === "basic" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Full Name & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="اسم الطالب الكامل" required hint="الاسم الأول والأخير">
                  <Input
                    required
                    value={student.full_name || ""}
                    onChange={(e) => set("full_name", e.target.value)}
                    placeholder="مثال: عبدالله عمر سالم"
                  />
                </FormField>

                <FormField label="الفرع / النادي" required hint="مكان تدريب الطالب">
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
              </div>

              {/* Phone & WhatsApp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="رقم الهاتف" hint="اختياري">
                  <Input
                    type="tel"
                    value={student.phone || ""}
                    onChange={(e) => set("phone", e.target.value)}
                    placeholder="05x xxx xxxx"
                  />
                </FormField>

                <FormField
                  label="رقم الواتساب"
                  hint={
                    student.phone && !student.whatsapp ? (
                      <button
                        type="button"
                        onClick={copyPhoneToWhatsapp}
                        className="text-primary hover:underline font-bold text-[10px]"
                      >
                        نسخ رقم الهاتف
                      </button>
                    ) : "اختياري"
                  }
                >
                  <Input
                    type="tel"
                    value={student.whatsapp || ""}
                    onChange={(e) => set("whatsapp", e.target.value)}
                    placeholder="05x xxx xxxx"
                  />
                </FormField>
              </div>

              {/* Email & Gender & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField label="البريد الإلكتروني" hint="اختياري">
                  <Input
                    type="email"
                    value={student.email || ""}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="student@example.com"
                  />
                </FormField>

                <FormField label="الجنس" required>
                  <Select
                    value={student.gender}
                    onChange={(e) => set("gender", e.target.value as any)}
                  >
                    <option value="male">ذكر</option>
                    <option value="female">أنثى</option>
                  </Select>
                </FormField>

                <FormField label="الحالة" required>
                  <Select
                    value={student.status}
                    onChange={(e) => set("status", e.target.value as any)}
                  >
                    <option value="active">نشط (مشترك فعلي)</option>
                    <option value="trial">تجريبي (فترة تجربة)</option>
                    <option value="lead">عميل محتمل (مهتم)</option>
                    <option value="suspended">موقوف</option>
                    <option value="inactive">غير نشط</option>
                    <option value="graduated">خريج</option>
                  </Select>
                </FormField>
              </div>
            </div>
          )}

          {/* TAB 2: PERSONAL & FAMILY & EMERGENCY */}
          {activeTab === "personal" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Demographics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="تاريخ الميلاد"
                  hint={calculatedAge !== null ? `العمر التقديري: ${calculatedAge} سنة` : "اختياري"}
                >
                  <Input
                    type="date"
                    value={student.date_of_birth || ""}
                    onChange={(e) => set("date_of_birth", e.target.value || null)}
                  />
                </FormField>

                <FormField label="الجنسية" hint="اختياري">
                  <Select
                    value={student.nationality || ""}
                    onChange={(e) => set("nationality", e.target.value)}
                  >
                    <option value="">اختر الجنسية...</option>
                    {NATIONALITIES.map((n) => (
                      <option key={n.code} value={n.code}>
                        {n.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>

              {/* Family Linking */}
              <FormField label="ربط بعائلة مسجلة" hint="اختياري — لدمج الفواتير وسجل العائلة">
                <Select
                  value={student.family_id || ""}
                  onChange={(e) => set("family_id", e.target.value ? parseInt(e.target.value, 10) : null)}
                  disabled={loadingFamilies}
                >
                  <option value="">بدون عائلة (طالب فردي)</option>
                  {families.map((fam) => (
                    <option key={fam.id} value={fam.id}>
                      عائلة {fam.name} — (مسؤول: {fam.primary_contact_name} - {fam.primary_contact_phone})
                    </option>
                  ))}
                </Select>
              </FormField>

              {/* Emergency Contact Header */}
              <div className="pt-2 border-t border-white/5">
                <p className="text-xs font-black text-white mb-3 flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-blue-400" />
                  بيانات التواصل في حالات الطوارئ وولي الأمر
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField label="اسم جهة الاتصال / ولي الأمر" hint="اختياري">
                    <Input
                      value={student.emergency_contact_name || ""}
                      onChange={(e) => set("emergency_contact_name", e.target.value)}
                      placeholder="مثال: عمر سالم (الأب)"
                    />
                  </FormField>

                  <FormField label="هاتف الطوارئ" hint="اختياري">
                    <Input
                      type="tel"
                      value={student.emergency_contact_phone || ""}
                      onChange={(e) => set("emergency_contact_phone", e.target.value)}
                      placeholder="05x xxx xxxx"
                    />
                  </FormField>

                  <FormField label="صلة القرابة" hint="اختياري">
                    <Select
                      value={student.emergency_contact_relation || ""}
                      onChange={(e) => set("emergency_contact_relation", e.target.value)}
                    >
                      <option value="">اختر صلة القرابة...</option>
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

          {/* TAB 3: MEDICAL & HEALTH */}
          {activeTab === "medical" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-3.5 rounded-2xl bg-red-500/5 border border-red-500/10 flex items-start gap-3">
                <HeartPulse className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-white mb-0.5">السجل الصحي والطبي (اختياري)</p>
                  <p className="text-muted-foreground">تُستخدم هذه المعلومات لضمان سلامة الطالب أثناء التدريبات والبطولات.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="فصيلة الدم" hint="اختياري">
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

                <FormField label="الحساسية إن وجدت" hint="أدوية، أطعمة، بيئة...">
                  <Input
                    value={student.allergies || ""}
                    onChange={(e) => set("allergies", e.target.value)}
                    placeholder="مثال: حساسية البنسلين، حساسية الغبار"
                  />
                </FormField>
              </div>

              <FormField label="ملاحظات صحية أو طبية خاصة" hint="أمراض مزمنة، إصابات مفاصل سابقة، تنبيهات للمدرب...">
                <textarea
                  value={student.medical_notes || ""}
                  onChange={(e) => set("medical_notes", e.target.value)}
                  rows={3}
                  placeholder="اكتب أي ملاحظات طبية مهمة يجب على الكادر التدريبي معرفتها..."
                  className="w-full px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/10 text-white text-xs font-semibold focus:border-primary/50 focus:bg-white/[0.05] focus:outline-none transition-all placeholder:text-muted-foreground/30 resize-none"
                />
              </FormField>
            </div>
          )}

          {/* TAB 4: NOTES & CONSENTS & MARKETING */}
          {activeTab === "notes" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Marketing Lead Source */}
              <FormField label="مصدر معرفة النادي (قناة الاستقطاب)" hint="اختياري">
                <Select
                  value={student.source || ""}
                  onChange={(e) => set("source", e.target.value)}
                >
                  <option value="">اختر المصدر...</option>
                  {LEAD_SOURCES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </FormField>

              {/* General & Internal Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="ملاحظات عامة حول الطالب" hint="مرئية في الملف">
                  <textarea
                    value={student.notes || ""}
                    onChange={(e) => set("notes", e.target.value)}
                    rows={3}
                    placeholder="ملاحظات عامة، أهداف الطالب الرياضية..."
                    className="w-full px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/10 text-white text-xs font-semibold focus:border-primary/50 focus:bg-white/[0.05] focus:outline-none transition-all placeholder:text-muted-foreground/30 resize-none"
                  />
                </FormField>

                <FormField label="ملاحظات داخلية خاصة بالإدارة" hint="سرية للموظفين والمدربين فقط">
                  <textarea
                    value={student.internal_notes || ""}
                    onChange={(e) => set("internal_notes", e.target.value)}
                    rows={3}
                    placeholder="ملاحظات متابعة، خصومات استثنائية، سلوك..."
                    className="w-full px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/10 text-white text-xs font-semibold focus:border-primary/50 focus:bg-white/[0.05] focus:outline-none transition-all placeholder:text-muted-foreground/30 resize-none"
                  />
                </FormField>
              </div>

              {/* Waivers & Consents */}
              <div className="pt-2 border-t border-white/5 space-y-3">
                <p className="text-xs font-black text-white mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  الموافقات والإقرارات الرسمية
                </p>

                <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 cursor-pointer hover:bg-white/[0.04] transition-all">
                  <input
                    type="checkbox"
                    checked={Boolean(student.waiver_signed)}
                    onChange={(e) => set("waiver_signed", e.target.checked)}
                    className="mt-1 rounded border-white/20 bg-white/5 text-primary focus:ring-primary h-4 w-4 shrink-0"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-white block mb-0.5">تم توقيع إقرار إخلاء المسؤولية الرياضية والطبية</span>
                    <span className="text-muted-foreground text-[11px]">يقر المشترك / ولي أمره بالموافقة على الشروط واللوائح التنظيمية للنادي.</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 cursor-pointer hover:bg-white/[0.04] transition-all">
                  <input
                    type="checkbox"
                    checked={Boolean(student.photo_consent)}
                    onChange={(e) => set("photo_consent", e.target.checked)}
                    className="mt-1 rounded border-white/20 bg-white/5 text-primary focus:ring-primary h-4 w-4 shrink-0"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-white block mb-0.5">موافقة النشر والتصوير الرياضي (Photo/Media Consent)</span>
                    <span className="text-muted-foreground text-[11px]">الموافقة على التقاط صور وتغطيات إعلامية للتدريبات والأنشطة لنشرها في حسابات النادي.</span>
                  </div>
                </label>
              </div>
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
