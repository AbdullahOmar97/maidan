"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import {
  ArrowRight, UserPlus, Loader2, AlertCircle, Sparkles, MapPin,
  Phone, Mail, User, Info, CheckCircle2, Camera, X,
  Award, CreditCard, HeartPulse, Users, ShieldCheck, FileText,
  Calendar, Globe, MessageSquare
} from "lucide-react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Location, BeltRank, MembershipPlan, Family } from "@/types";
import { cn, parseApiError } from "@/lib/utils";
import { InputWrapper } from "@/components/form-elements";
import { Select } from "@/components/ui/select";
import { toast } from "sonner";
import { PermissionGuard } from "@/components/dashboard/permission-guard";

const NATIONALITIES = [
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
];

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const LEAD_SOURCES = [
  { value: "walk_in", label: "زيارة مباشرة للنادي (Walk-in)" },
  { value: "referral", label: "توصية من مشترك (Referral)" },
  { value: "social_media", label: "وسائل التواصل الاجتماعي (Social Media)" },
  { value: "website", label: "الموقع الإلكتروني (Website)" },
  { value: "google", label: "بحث جوجل (Google)" },
  { value: "event", label: "فعالية / بطولة (Event)" },
  { value: "phone", label: "استفسار هاتفي (Phone)" },
  { value: "other", label: "أخرى (Other)" },
];

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

export default function NewStudentPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [locations, setLocations] = useState<Location[]>([]);
  const [belts, setBelts] = useState<BeltRank[]>([]);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [error, setError] = useState("");

  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    // Basic Info (Mandatory: full_name, location_id)
    full_name: "",
    location_id: "" as number | "",
    phone: "",
    email: "",
    whatsapp: "",
    gender: "male" as "male" | "female",
    status: "active" as const,

    // Personal & Demographic
    date_of_birth: "",
    nationality: "",

    // Emergency & Family
    emergency_contact_name: "",
    emergency_contact_phone: "",
    emergency_contact_relation: "",
    family_id: "" as number | "",

    // Medical
    blood_type: "",
    allergies: "",
    medical_notes: "",

    // Belts & Subscription
    initial_belt_id: "" as number | "",
    initial_membership_plan_id: "" as number | "",
    membership_start_date: new Date().toISOString().split("T")[0],

    // Marketing, Notes & Consents
    source: "",
    notes: "",
    internal_notes: "",
    waiver_signed: false,
    photo_consent: false,
  });

  // Calculate age if DOB provided
  const calculatedAge = formData.date_of_birth ? (() => {
    const today = new Date();
    const birth = new Date(formData.date_of_birth);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age >= 0 ? age : null;
  })() : null;

  useEffect(() => {
    // 1. Fetch locations
    api.locations.list()
      .then((res: any) => {
        const locationData = res.data.results || res.data;
        const locs = Array.isArray(locationData) ? locationData : [];
        setLocations(locs);
        if (locs.length > 0) {
          setFormData(prev => ({ ...prev, location_id: locs[0].id }));
        }
      })
      .catch((err) => {
        console.error("Failed to fetch locations", err);
        setError("فشل تحميل قائمة الفروع. يرجى التأكد من وجود فرع واحد على الأقل.");
      })
      .finally(() => {
        setLocationsLoading(false);
      });

    // 2. Fetch belts
    api.belts.ranks()
      .then((res: any) => {
        const ranksData = res.data?.results ?? res.data ?? [];
        setBelts(Array.isArray(ranksData) ? ranksData : []);
      })
      .catch(() => setBelts([]));

    // 3. Fetch membership plans
    api.billing.plans.list()
      .then((res: any) => {
        const plansData = res.data?.results ?? res.data ?? [];
        setPlans(Array.isArray(plansData) ? plansData : []);
      })
      .catch(() => setPlans([]));

    // 4. Fetch families
    api.families.list()
      .then((res: any) => {
        const famData = res.data?.results ?? res.data ?? [];
        setFamilies(Array.isArray(famData) ? famData : []);
      })
      .catch(() => setFamilies([]));
  }, []);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("حجم الصورة يجب ألا يتجاوز 5 ميجابايت");
        return;
      }
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleRemovePhoto = () => {
    setPhoto(null);
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const createMutation = useMutation({
    mutationFn: (data: FormData | Record<string, any>) => api.students.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success("تم إضافة الطالب بنجاح");
      router.push("/dashboard/students");
    },
    onError: (err: any) => {
      const message = parseApiError(err, "حدث خطأ أثناء إضافة الطالب. يرجى التحقق من البيانات.");
      setError(message);
      toast.error("فشل إضافة الطالب");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name?.trim()) {
      setError("يرجى إدخال اسم الطالب الكامل");
      return;
    }
    if (!formData.location_id) {
      setError("يرجى اختيار الفرع");
      return;
    }

    setError("");
    if (photo) {
      const data = new FormData();
      Object.entries(formData).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") {
          data.append(k, String(v));
        }
      });
      data.append("photo", photo);
      createMutation.mutate(data);
    } else {
      const payload: Record<string, any> = {};
      Object.entries(formData).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") {
          payload[k] = v;
        }
      });
      createMutation.mutate(payload);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name === "location_id" || name === "family_id" || name === "initial_belt_id" || name === "initial_membership_plan_id") {
      setFormData(prev => ({ ...prev, [name]: value === "" ? "" : parseInt(value, 10) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const copyPhoneToWhatsapp = () => {
    if (formData.phone) {
      setFormData(prev => ({ ...prev, whatsapp: prev.phone }));
    }
  };

  if (locationsLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <Loader2 className="w-6 h-6 text-primary absolute top-1/2 start-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
      </div>
    );
  }

  return (
    <PermissionGuard permission="can_manage_students">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-0 space-y-6 md:space-y-8 pb-40">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <Link
              href="/dashboard/students"
              className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-white transition-all active:scale-90"
            >
              <ArrowRight className="w-6 h-6" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">إضافة طالب جديد</h1>
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest border border-primary/20">
                  نموذج شامل
                </span>
              </div>
              <p className="text-muted-foreground text-sm font-bold mt-1 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                فقط الاسم الكامل والفرع إلزاميان — وبقية البيانات اختيارية ويمكن إضافتها وتعديلها في أي وقت
              </p>
            </div>
          </div>
        </div>

        {/* Main Form Content */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {error && (
            <div className="p-6 rounded-3xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold flex items-start gap-3 animate-in fade-in slide-in-from-top-4">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div className="whitespace-pre-wrap">{error}</div>
            </div>
          )}

          <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6 md:gap-8">
            {/* Main Column (2 spans) */}
            <div className="lg:col-span-2 space-y-8">
              {/* Section 1: Basic & Demographic Info */}
              <div className="glass-card p-5 md:p-8 space-y-6 md:space-y-8 relative">
                <div className="absolute top-0 end-0 w-32 h-32 bg-primary/5 blur-3xl -me-16 -mt-16 pointer-events-none" />

                <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-lg shadow-primary/10">
                      <User className="w-4 h-4" />
                    </div>
                    <h3 className="text-lg font-black text-white">البيانات الشخصية والأساسية</h3>
                  </div>
                  <span className="text-[10px] font-bold text-primary px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20">
                    الاسم والفرع إلزاميان
                  </span>
                </div>

                {/* Photo Picker */}
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                  <div className="relative group">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center shrink-0">
                      {photoPreview ? (
                        <img src={photoPreview} alt="معاينة الصورة" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="w-8 h-8 text-muted-foreground/50" />
                      )}
                    </div>
                    {photoPreview && (
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="absolute -top-2 -end-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white mb-1">صورة الطالب الشخصية (اختياري)</p>
                    <p className="text-xs text-muted-foreground mb-3">تُستخدم الصورة في التعرف السريع والبطاقات واختبارات الأحزمة (PNG أو JPG بحد أقصى 5MB)</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/jpg"
                      className="hidden"
                      onChange={handlePhotoChange}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold transition-all"
                    >
                      {photoPreview ? "تغيير الصورة" : "رفع صورة للطالب"}
                    </button>
                  </div>
                </div>

                {/* Full Name & Branch (REQUIRED) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <InputWrapper label="اسم الطالب (الاسم الكامل)" icon={Info}>
                    <input
                      required
                      type="text"
                      name="full_name"
                      value={formData.full_name}
                      onChange={handleChange}
                      placeholder="مثال: عبدالله عمر سالم"
                      className="w-full px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-bold placeholder:text-muted-foreground/30 text-end"
                    />
                  </InputWrapper>

                  <InputWrapper label="الفرع / النادي" icon={MapPin}>
                    <Select
                      required
                      name="location_id"
                      value={formData.location_id}
                      onChange={handleChange}
                    >
                      <option value="" disabled>اختر الفرع...</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name_ar || loc.name}
                        </option>
                      ))}
                    </Select>
                  </InputWrapper>
                </div>

                {/* Date of Birth & Nationality */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <InputWrapper
                    label="تاريخ الميلاد (اختياري)"
                    icon={Calendar}
                  >
                    <div className="space-y-1">
                      <input
                        type="date"
                        name="date_of_birth"
                        value={formData.date_of_birth}
                        onChange={handleChange}
                        className="w-full px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-bold"
                      />
                      {calculatedAge !== null && (
                        <p className="text-[11px] text-primary font-bold px-2">العمر التقديري: {calculatedAge} سنة</p>
                      )}
                    </div>
                  </InputWrapper>

                  <InputWrapper label="الجنسية (اختياري)" icon={Globe}>
                    <Select
                      name="nationality"
                      value={formData.nationality}
                      onChange={handleChange}
                    >
                      <option value="">اختر الجنسية...</option>
                      {NATIONALITIES.map((n) => (
                        <option key={n.code} value={n.code}>
                          {n.label}
                        </option>
                      ))}
                    </Select>
                  </InputWrapper>
                </div>
              </div>

              {/* Section 2: Contact Info */}
              <div className="glass-card p-5 md:p-8 space-y-6 md:space-y-8 relative">
                <div className="absolute top-0 end-0 w-32 h-32 bg-blue-500/5 blur-3xl -me-16 -mt-16 pointer-events-none" />

                <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shadow-lg shadow-blue-500/10">
                    <Phone className="w-4 h-4" />
                  </div>
                  <h3 className="text-lg font-black text-white">معلومات التواصل (اختياري)</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <InputWrapper label="رقم الهاتف" icon={Phone}>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="05x xxx xxxx"
                      className="w-full px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-bold placeholder:text-muted-foreground/30"
                    />
                  </InputWrapper>

                  <InputWrapper label="رقم الواتساب" icon={Phone}>
                    <div className="space-y-1">
                      <input
                        type="tel"
                        name="whatsapp"
                        value={formData.whatsapp}
                        onChange={handleChange}
                        placeholder="05x xxx xxxx"
                        className="w-full px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-bold placeholder:text-muted-foreground/30"
                      />
                      {formData.phone && !formData.whatsapp && (
                        <button
                          type="button"
                          onClick={copyPhoneToWhatsapp}
                          className="text-primary hover:underline font-bold text-[10px] px-1"
                        >
                          نسخ رقم الهاتف إلى الواتساب
                        </button>
                      )}
                    </div>
                  </InputWrapper>

                  <InputWrapper label="البريد الإلكتروني" icon={Mail}>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="student@example.com"
                      className="w-full px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-bold placeholder:text-muted-foreground/30"
                    />
                  </InputWrapper>
                </div>
              </div>

              {/* Section 3: Subscription & Belt Rank */}
              <div className="glass-card p-5 md:p-8 space-y-6 md:space-y-8 relative">
                <div className="absolute top-0 end-0 w-32 h-32 bg-emerald-500/5 blur-3xl -me-16 -mt-16 pointer-events-none" />

                <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">الاشتراك والحزام الأولي (اختياري)</h3>
                    <p className="text-xs text-muted-foreground">يمكنك إلحاق المشترك بباقة أو رتبة حزام مباشرة عند إنشاء الحساب</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <InputWrapper label="خطة الاشتراك الأولية" icon={CreditCard}>
                    <Select
                      name="initial_membership_plan_id"
                      value={formData.initial_membership_plan_id}
                      onChange={handleChange}
                    >
                      <option value="">بدون اشتراك حالياً</option>
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {p.price} {p.currency || "SAR"} ({p.billing_cycle})
                        </option>
                      ))}
                    </Select>
                  </InputWrapper>

                  <InputWrapper label="تاريخ بدء الاشتراك" icon={Calendar}>
                    <input
                      type="date"
                      name="membership_start_date"
                      value={formData.membership_start_date}
                      onChange={handleChange}
                      disabled={!formData.initial_membership_plan_id}
                      className="w-full px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-bold disabled:opacity-40"
                    />
                  </InputWrapper>
                </div>

                <InputWrapper label="الحزام الأولي / الرتبة الرياضية" icon={Award}>
                  <Select
                    name="initial_belt_id"
                    value={formData.initial_belt_id}
                    onChange={handleChange}
                  >
                    <option value="">بدون حزام مسجل</option>
                    {belts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} {b.name_ar ? `(${b.name_ar})` : ""} — [{b.martial_art}]
                      </option>
                    ))}
                  </Select>
                </InputWrapper>
              </div>

              {/* Section 4: Emergency Contact & Family Link */}
              <div className="glass-card p-5 md:p-8 space-y-6 md:space-y-8 relative">
                <div className="absolute top-0 end-0 w-32 h-32 bg-purple-500/5 blur-3xl -me-16 -mt-16 pointer-events-none" />

                <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 shadow-lg shadow-purple-500/10">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">العائلة وجهات الاتصال للطوارئ (اختياري)</h3>
                  </div>
                </div>

                <InputWrapper label="ربط بعائلة مسجلة" icon={Users}>
                  <Select
                    name="family_id"
                    value={formData.family_id}
                    onChange={handleChange}
                  >
                    <option value="">بدون عائلة (طالب فردي)</option>
                    {families.map((fam) => (
                      <option key={fam.id} value={fam.id}>
                        عائلة {fam.name} — (مسؤول: {fam.primary_contact_name} - {fam.primary_contact_phone})
                      </option>
                    ))}
                  </Select>
                </InputWrapper>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2">
                  <InputWrapper label="اسم ولي الأمر / جهة الطوارئ" icon={User}>
                    <input
                      type="text"
                      name="emergency_contact_name"
                      value={formData.emergency_contact_name}
                      onChange={handleChange}
                      placeholder="مثال: عمر سالم (الأب)"
                      className="w-full px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-bold placeholder:text-muted-foreground/30"
                    />
                  </InputWrapper>

                  <InputWrapper label="هاتف الطوارئ" icon={Phone}>
                    <input
                      type="tel"
                      name="emergency_contact_phone"
                      value={formData.emergency_contact_phone}
                      onChange={handleChange}
                      placeholder="05x xxx xxxx"
                      className="w-full px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-bold placeholder:text-muted-foreground/30"
                    />
                  </InputWrapper>

                  <InputWrapper label="صلة القرابة" icon={Info}>
                    <Select
                      name="emergency_contact_relation"
                      value={formData.emergency_contact_relation}
                      onChange={handleChange}
                    >
                      <option value="">اختر صلة القرابة...</option>
                      {EMERGENCY_RELATIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </Select>
                  </InputWrapper>
                </div>
              </div>

              {/* Section 5: Medical Information */}
              <div className="glass-card p-5 md:p-8 space-y-6 md:space-y-8 relative">
                <div className="absolute top-0 end-0 w-32 h-32 bg-red-500/5 blur-3xl -me-16 -mt-16 pointer-events-none" />

                <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                  <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400 shadow-lg shadow-red-500/10">
                    <HeartPulse className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">السجل الطبي والصحي (اختياري)</h3>
                    <p className="text-xs text-muted-foreground">لضمان سلامة الطالب أثناء الحصص التدريبية والأنشطة الرياضية</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <InputWrapper label="فصيلة الدم" icon={HeartPulse}>
                    <Select
                      name="blood_type"
                      value={formData.blood_type}
                      onChange={handleChange}
                    >
                      <option value="">غير محددة</option>
                      {BLOOD_TYPES.map((bt) => (
                        <option key={bt} value={bt}>
                          {bt}
                        </option>
                      ))}
                    </Select>
                  </InputWrapper>

                  <InputWrapper label="الحساسية إن وجدت" icon={Info}>
                    <input
                      type="text"
                      name="allergies"
                      value={formData.allergies}
                      onChange={handleChange}
                      placeholder="أدوية، أطعمة، بيئة..."
                      className="w-full px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-bold placeholder:text-muted-foreground/30"
                    />
                  </InputWrapper>
                </div>

                <InputWrapper label="ملاحظات طبية أو حالات خاصة" icon={FileText}>
                  <textarea
                    name="medical_notes"
                    value={formData.medical_notes}
                    onChange={handleChange}
                    rows={3}
                    placeholder="أمراض مزمنة، إصابات سابقة، تنبيهات للمدربين..."
                    className="w-full px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-bold placeholder:text-muted-foreground/30 resize-none"
                  />
                </InputWrapper>
              </div>

              {/* Section 6: Notes & Consents */}
              <div className="glass-card p-5 md:p-8 space-y-6 md:space-y-8 relative">
                <div className="absolute top-0 end-0 w-32 h-32 bg-amber-500/5 blur-3xl -me-16 -mt-16 pointer-events-none" />

                <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
                    <FileText className="w-4 h-4" />
                  </div>
                  <h3 className="text-lg font-black text-white">الملاحظات والموافقات (اختياري)</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <InputWrapper label="ملاحظات عامة حول الطالب" icon={MessageSquare}>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleChange}
                      rows={3}
                      placeholder="ملاحظات عامة، أهداف المشترك الرياضية..."
                      className="w-full px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-bold placeholder:text-muted-foreground/30 resize-none"
                    />
                  </InputWrapper>

                  <InputWrapper label="ملاحظات داخلية خاصة بالإدارة" icon={ShieldCheck}>
                    <textarea
                      name="internal_notes"
                      value={formData.internal_notes}
                      onChange={handleChange}
                      rows={3}
                      placeholder="ملاحظات سرية للإدارة والمدربين..."
                      className="w-full px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-bold placeholder:text-muted-foreground/30 resize-none"
                    />
                  </InputWrapper>
                </div>

                {/* Waivers & Consents */}
                <div className="pt-2 border-t border-white/5 space-y-3">
                  <label className="flex items-start gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/5 cursor-pointer hover:bg-white/[0.04] transition-all">
                    <input
                      type="checkbox"
                      name="waiver_signed"
                      checked={formData.waiver_signed}
                      onChange={handleChange}
                      className="mt-1 rounded border-white/20 bg-white/5 text-primary focus:ring-primary h-4 w-4 shrink-0"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-white block mb-0.5">تم توقيع إقرار إخلاء المسؤولية الرياضية والطبية</span>
                      <span className="text-muted-foreground text-[11px]">يقر المشترك / ولي أمره بالموافقة على الشروط واللوائح التنظيمية للنادي.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/5 cursor-pointer hover:bg-white/[0.04] transition-all">
                    <input
                      type="checkbox"
                      name="photo_consent"
                      checked={formData.photo_consent}
                      onChange={handleChange}
                      className="mt-1 rounded border-white/20 bg-white/5 text-primary focus:ring-primary h-4 w-4 shrink-0"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-white block mb-0.5">الموافقة على التصوير والنشر الإعلامي</span>
                      <span className="text-muted-foreground text-[11px]">يسمح بنشر صور الطالب في منصات النادي والفعاليات والبطولات الرسمية.</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Sidebar Column (1 span) */}
            <div className="space-y-6 md:space-y-8">
              {/* System Details Box */}
              <div className="glass-card p-5 md:p-8 space-y-6 md:space-y-8 relative">
                <div className="absolute top-0 end-0 w-32 h-32 bg-amber-500/5 blur-3xl -me-16 -mt-16 pointer-events-none" />

                <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
                    <Info className="w-4 h-4" />
                  </div>
                  <h3 className="text-lg font-black text-white">إعدادات النظام</h3>
                </div>

                <div className="space-y-5">
                  <InputWrapper label="الجنس" icon={User}>
                    <Select
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                    >
                      <option value="male">ذكر</option>
                      <option value="female">أنثى</option>
                    </Select>
                  </InputWrapper>

                  <InputWrapper label="الحالة الأولية" icon={CheckCircle2}>
                    <Select
                      name="status"
                      value={formData.status}
                      onChange={handleChange}
                    >
                      <option value="active">نشط (مشترك)</option>
                      <option value="trial">تجريبي (فترة تجربة)</option>
                      <option value="lead">عميل محتمل</option>
                      <option value="inactive">غير نشط</option>
                    </Select>
                  </InputWrapper>

                  <InputWrapper label="مصدر التسجيل (قناة الاستقطاب)" icon={Sparkles}>
                    <Select
                      name="source"
                      value={formData.source}
                      onChange={handleChange}
                    >
                      <option value="">اختر المصدر...</option>
                      {LEAD_SOURCES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </Select>
                  </InputWrapper>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 sticky top-6">
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="w-full py-5 rounded-[2rem] gradient-brand text-white text-sm font-black uppercase tracking-widest shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 group disabled:opacity-50"
                >
                  {createMutation.isPending ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                    <>
                      <span>حفظ بيانات الطالب</span>
                      <CheckCircle2 className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                    </>
                  )}
                </button>
                <Link
                  href="/dashboard/students"
                  className="w-full py-5 rounded-[2rem] bg-white/5 border border-white/10 text-white text-sm font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center"
                >
                  إلغاء العملية
                </Link>
              </div>
            </div>
          </div>
          <div className="h-20 md:hidden" aria-hidden="true" />
        </form>
      </div>
    </PermissionGuard>
  );
}