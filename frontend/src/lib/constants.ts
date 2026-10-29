import { UserRole } from "@/types";

export const ROLE_LABELS: Record<UserRole, string> = {
  platform_admin: "مدير النظام",
  tenant_owner: "مالك النادي",
  manager: "مدير",
  branch_manager: "مدير فرع",
  front_desk: "استقبال",
  instructor: "مدرب",
  finance: "مالية",
  staff: "موظف",
  parent: "ولي أمر",
  student: "طالب",
  read_only: "مراقب",
};

export const CURRENCY_OPTIONS = [
  { value: "JOD", label: "JOD" },
  { value: "SAR", label: "SAR" },
  { value: "AED", label: "AED" },
  { value: "KWD", label: "KWD" },
  { value: "BHD", label: "BHD" },
  { value: "OMR", label: "OMR" },
  { value: "QAR", label: "QAR" },
  { value: "EGP", label: "EGP" },
  { value: "USD", label: "USD" },
] as const;

export const NATIONALITIES = [
  { code: "SA", label: "سعودي (SA)" },
  { code: "AE", label: "إماراتي (AE)" },
  { code: "KW", label: "كويتي (KW)" },
  { code: "QA", label: "قطري (QA)" },
  { code: "BH", label: "بحريني (BH)" },
  { code: "OM", label: "عماني (OM)" },
  { code: "JO", label: "أردني (JO)" },
  { code: "EG", label: "مصري (EG)" },
  { code: "SY", label: "سوري (SY)" },
  { code: "LB", label: "لبناني (LB)" },
  { code: "PS", label: "فلسطيني (PS)" },
  { code: "IQ", label: "عراقي (IQ)" },
  { code: "YE", label: "يمني (YE)" },
  { code: "SD", label: "سوداني (SD)" },
  { code: "MA", label: "مغربي (MA)" },
  { code: "DZ", label: "جزائري (DZ)" },
  { code: "TN", label: "تونسي (TN)" },
  { code: "LY", label: "ليبي (LY)" },
  { code: "XX", label: "أخرى (Other)" },
] as const;

export const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

export const LEAD_SOURCES = [
  { value: "walk_in", label: "زيارة مباشرة للنادي (Walk-in)" },
  { value: "referral", label: "توصية من مشترك (Referral)" },
  { value: "social_media", label: "وسائل التواصل الاجتماعي (Social Media)" },
  { value: "website", label: "الموقع الإلكتروني (Website)" },
  { value: "google", label: "بحث جوجل (Google)" },
  { value: "event", label: "فعالية / بطولة (Event)" },
  { value: "phone", label: "استفسار هاتفي (Phone)" },
  { value: "other", label: "أخرى (Other)" },
] as const;

export const EMERGENCY_RELATIONS = [
  "أب",
  "أم",
  "ولي أمر",
  "أخ",
  "أخت",
  "قريب",
  "صديق",
  "أخرى",
] as const;
