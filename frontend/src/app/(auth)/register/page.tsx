"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowLeft,
  Shield,
  Sparkles,
  User,
  Mail,
  Lock,
  Building2,
  Globe,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Check
} from "lucide-react";
import { cn, translateErrorMessage } from "@/lib/utils";
import { ErrorAlert } from "@/components/ErrorAlert";
import { api } from "@/lib/api/client";

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tenantData, setTenantData] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);


  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    academy_name: "",
    slug: "",
  });

  useEffect(() => {
    setMounted(true);
    setPlansLoading(true);
    setPlansError(null);
    api.platform.plans
      .list()
      .then((res: any) => {
        const plansList = res.data.results || res.data;
        const list = Array.isArray(plansList) ? plansList : [];
        setPlans(list);
        if (list.length > 0) {
          setSelectedPlan(list[0].id);
        }
      })
      .catch((err: any) => {
        console.error("Failed to fetch plans", err);
        setPlansError(
          "تعذر تحميل الباقات. تأكد أن خادم API يعمل وأن المتصفح يصل إلى نفس المنفذ أو nginx (مثل ‎http://localhost‎ بدلاً من المنفذ ‎3000‎ فقط)، أو زِد المهلة عبر ‎NEXT_PUBLIC_API_TIMEOUT_MS‎."
        );
      })
      .finally(() => setPlansLoading(false));
  }, []);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "slug") {
      // Sanitize slug: lowercase, only letters, numbers and hyphens
      const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, "");
      setFormData((prev: any) => ({ ...prev, [name]: sanitized }));
    } else {
      setFormData((prev: any) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) {
      setError("يرجى اختيار باقة للاشتراك");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.platform.tenants.register({
        ...formData,
        plan_id: selectedPlan
      });
      const data = response.data;

      setTenantData(data);
      setIsSuccess(true);

    } catch (err: any) {
      const errorData = err.response?.data;
      let errorMessage = "حدث خطأ أثناء التسجيل. يرجى المحاولة مرة أخرى.";

      if (errorData) {
        const fieldLabels: Record<string, string> = {
          email: "البريد الإلكتروني",
          slug: "رابط الأكاديمية",
          password: "كلمة المرور",
          first_name: "الاسم الأول",
          last_name: "اسم العائلة",
          academy_name: "اسم الأكاديمية",
          plan_id: "الباقة"
        };

        const parseFieldErrors = (obj: any) => {
          return Object.entries(obj).map(([key, value]) => {
            const fieldName = fieldLabels[key] || key;
            const errorText = Array.isArray(value) ? value[0] : (typeof value === "object" ? JSON.stringify(value) : String(value));
            return `${fieldName}: ${translateErrorMessage(String(errorText))}`;
          });
        };

        if (errorData.error && typeof errorData.error === "object") {
          const innerError = errorData.error;
          // If there's a detail object with field errors, use it
          if (innerError.detail && typeof innerError.detail === "object" && !Array.isArray(innerError.detail)) {
            const messages = parseFieldErrors(innerError.detail);
            if (messages.length > 0) {
              errorMessage = messages.join(" | ");
            } else {
              errorMessage = translateErrorMessage(innerError.message || "حدث خطأ في البيانات");
            }
          } else {
            errorMessage = translateErrorMessage(innerError.message || "حدث خطأ في النظام");
          }
        } else if (typeof errorData === "object" && !Array.isArray(errorData)) {
          const messages = parseFieldErrors(errorData);
          if (messages.length > 0) {
            errorMessage = messages.join(" | ");
          }
        } else if (typeof errorData === "string") {
          errorMessage = translateErrorMessage(errorData);
        }
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center page-enter py-12 px-6">
        <div className="w-24 h-24 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-8 shadow-2xl animate-pulse">
          <Clock className="w-12 h-12 text-amber-500" />
        </div>
        <h1 className="text-5xl font-black text-white mb-4 tracking-tight">تم استلام طلبك بنجاح!</h1>
        <div className="max-w-2xl space-y-6">
          <p className="text-2xl text-muted-foreground leading-relaxed">
            شكراً لتسجيل أكاديميتك (<bdi className="text-white font-black">{formData.academy_name}</bdi>).
            حسابك الآن <strong>قيد المراجعة</strong> من قبل فريق الإدارة.
          </p>

          <div className="glass-card p-8 border-amber-500/30 bg-amber-500/5 text-end space-y-4" dir="rtl">
            <h3 className="text-xl font-black text-white flex items-center gap-3">
              <Shield className="w-6 h-6 text-amber-500" />
              ماذا سيحدث الآن؟
            </h3>
            <ul className="space-y-4 text-base text-muted-foreground font-bold">
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 shrink-0 mt-0.5">1</div>
                <span>سيقوم مسؤولو المنصة بمراجعة بيانات أكاديميتك وتفعيل الحساب.</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 shrink-0 mt-0.5">2</div>
                <span>ستصلك رسالة تأكيد على البريد الإلكتروني (<bdi className="text-amber-500 font-mono font-medium">{formData.email}</bdi>) بمجرد التفعيل.</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 shrink-0 mt-0.5">3</div>
                <span>بعد التفعيل، ستتمكن من الدخول إلى لوحة التحكم عبر الرابط الخاص بك.</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 shrink-0 mt-0.5">4</div>
                <span>ستحصل على فترة تجريبية مجانية بالكامل لمدة 14 يوماً تبدأ فور تفعيل الحساب.</span>
              </li>
            </ul>
          </div>

          <div className="pt-8">
            <Link
              href="/login"
              className="text-primary font-black hover:underline flex items-center justify-center gap-2"
            >
              العودة لصفحة الدخول
              <ArrowLeft className="w-4 h-4 rtl-flip" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-6 page-enter">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-primary mb-6">
          <Sparkles className="h-3.5 w-3.5" />
          ابدأ رحلتك مع ميدان اليوم
        </div>
        <h1 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tight">تسجيل أكاديمية جديدة</h1>
        <p className="text-lg text-muted-foreground font-bold">أدخل تفاصيل الأكاديمية واختر الباقة المناسبة للبدء</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Section 1: Manager & Academy Info */}
          <div className="space-y-8">
            <h2 className="text-base font-black text-primary uppercase tracking-[0.2em] flex items-center gap-3">
              <User className="w-5 h-5" />
              بيانات المدير العام للأكاديمية
            </h2>

            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest px-1">الاسم الأول</label>
                  <input
                    type="text"
                    name="first_name"
                    required
                    value={formData.first_name}
                    onChange={handleChange}
                    placeholder="عبدالله"
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 px-5 text-white focus:outline-none focus:border-primary/50 transition-all font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest px-1">اسم العائلة</label>
                  <input
                    type="text"
                    name="last_name"
                    required
                    value={formData.last_name}
                    onChange={handleChange}
                    placeholder="علي"
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 px-5 text-white focus:outline-none focus:border-primary/50 transition-all font-bold"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">البريد الإلكتروني</label>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="admin@academy.com"
                  className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 px-5 text-white focus:outline-none focus:border-primary/50 transition-all font-bold"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">كلمة المرور</label>
                <input
                  type="password"
                  name="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 px-5 text-white focus:outline-none focus:border-primary/50 transition-all font-bold"
                />
              </div>

              <div className="pt-4 mt-8 border-t border-white/5">
                <h2 className="text-base font-black text-primary uppercase tracking-[0.2em] flex items-center gap-3 mb-6">
                  <Building2 className="w-5 h-5" />
                  بيانات الأكاديمية
                </h2>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest px-1">اسم الأكاديمية</label>
                  <input
                    type="text"
                    name="academy_name"
                    required
                    value={formData.academy_name}
                    onChange={handleChange}
                    placeholder="أكاديمية النخبة"
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 px-5 text-white focus:outline-none focus:border-primary/50 transition-all font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest px-1">رابط الأكاديمية (Slug)</label>
                  <div className="flex items-center bg-white/[0.03] border border-white/10 rounded-2xl px-4 sm:px-5 py-4 focus-within:border-primary/50 transition-all group overflow-hidden" dir="ltr">
                    <input
                      type="text"
                      name="slug"
                      required
                      value={formData.slug}
                      onChange={handleChange}
                      placeholder="elite-academy"
                      className="flex-1 min-w-0 bg-transparent border-none p-0 text-white focus:outline-none focus:ring-0 font-mono text-base sm:text-lg text-right"
                    />
                    <span className="text-xs sm:text-sm font-black text-muted-foreground whitespace-nowrap shrink-0 select-none ps-3 ms-3 border-s border-white/10" dir="ltr">
                      .{mounted ? window.location.hostname : (process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || "maidan.app")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Plan Selection */}
          <div className="space-y-8">
            <h2 className="text-base font-black text-primary uppercase tracking-[0.2em] flex items-center gap-3">
              <Sparkles className="w-5 h-5" />
              اختر باقة الاشتراك (مع 14 يوم فترة تجريبية مجانية)
            </h2>

            <div className="space-y-4">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={cn(
                    "glass-card p-6 cursor-pointer transition-all duration-300 relative border-2 group",
                    selectedPlan === plan.id
                      ? "border-primary bg-primary/[0.04] shadow-xl shadow-primary/10 scale-[1.02]"
                      : "border-white/5 hover:border-white/10 hover:bg-white/[0.01] hover:scale-[1.01]"
                  )}
                >
                  {selectedPlan === plan.id && (
                    <div className="absolute top-4 end-4 w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/30 border border-white/10 z-10 animate-in zoom-in-50 duration-200">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}

                  {/* Decorative Subtle glow */}
                  <div className="absolute top-0 end-0 w-24 h-24 bg-primary/5 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                  <div className="flex justify-between items-start mb-4 pe-8 text-start">
                    <div>
                      <h3 className={cn(
                        "font-black text-lg transition-colors",
                        selectedPlan === plan.id ? "text-primary" : "text-white group-hover:text-primary"
                      )}>{plan.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1 font-semibold leading-relaxed">
                        {plan.description || "باقة مرنة تلبي متطلبات نمو أكاديميتك."}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center py-3 px-4 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">تكلفة الباقة</span>
                    <div className="text-start">
                      {plan.price_monthly && parseFloat(plan.price_monthly) > 0 ? (
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-black text-primary"><bdi>{plan.price_monthly}</bdi></span>
                          <span className="text-[10px] text-muted-foreground font-black uppercase">{plan.currency} / شهري</span>
                        </div>
                      ) : plan.price_yearly && parseFloat(plan.price_yearly) > 0 ? (
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-black text-primary"><bdi>{plan.price_yearly}</bdi></span>
                          <span className="text-[10px] text-muted-foreground font-black uppercase">{plan.currency} / سنوي</span>
                        </div>
                      ) : (
                        <span className="text-sm font-black text-emerald-400">مجانًا</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-white/5">
                    <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl py-2 px-1 text-center">
                      <p className="text-[10px] font-black text-muted-foreground mb-0.5">الطلاب</p>
                      <p className="text-xs font-black text-white">{plan.max_students}</p>
                    </div>
                    <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl py-2 px-1 text-center">
                      <p className="text-[10px] font-black text-muted-foreground mb-0.5">الفروع</p>
                      <p className="text-xs font-black text-white">{plan.max_locations}</p>
                    </div>
                    <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl py-2 px-1 text-center">
                      <p className="text-[10px] font-black text-muted-foreground mb-0.5">الموظفين</p>
                      <p className="text-xs font-black text-white">{plan.max_staff}</p>
                    </div>
                  </div>
                </div>
              ))}

              {plansLoading && (
                <div className="py-12 text-center text-muted-foreground font-bold italic">
                  جاري تحميل الباقات...
                </div>
              )}
              {!plansLoading && plansError && (
                <div className="py-8 rounded-2xl border border-destructive/30 bg-destructive/5 px-6 text-center">
                  <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
                  <p className="text-sm font-bold text-destructive/90 leading-relaxed">{plansError}</p>
                </div>
              )}
              {!plansLoading && !plansError && plans.length === 0 && (
                <div className="py-12 text-center text-muted-foreground font-bold">
                  لا توجد باقات مفعّلة حالياً. تواصل مع الدعم أو أنشئ خطط المنصة من لوحة الإدارة.
                </div>
              )}
            </div>
          </div>
        </div>

        <ErrorAlert
          error={error}
          title="فشل التسجيل"
          subtitle="خطأ في البيانات"
        />

        <div className="pt-4">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary hover:bg-primary/90 text-white font-black py-5 rounded-[2rem] shadow-xl shadow-primary/20 flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group text-xl"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                جاري إنشاء الأكاديمية...
              </>
            ) : (
              <>
                إتمام عملية التسجيل
                <ArrowRight className="w-5 h-5 rtl-flip group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </div>

        <p className="text-center text-base text-muted-foreground mt-8">
          لديك حساب بالفعل؟{" "}
          <Link href="/login" className="text-primary font-bold hover:underline">
            تسجيل الدخول
          </Link>
        </p>
      </form>
    </div>
  );
}
