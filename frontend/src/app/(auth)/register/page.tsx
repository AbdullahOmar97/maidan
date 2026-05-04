"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  ArrowRight, 
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
import { cn } from "@/lib/utils";
import { api } from "@/lib/api/client";

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tenantData, setTenantData] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    academy_name: "",
    slug: "",
  });

  useEffect(() => {
    // Fetch plans
    api.platform.plans.list()
      .then((res: any) => {
        const plansList = res.data.results || res.data;
        setPlans(plansList);
        if (plansList.length > 0) {
          setSelectedPlan(plansList[0].id);
        }
      })
      .catch((err: any) => console.error("Failed to fetch plans", err));
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
            return `${fieldName}: ${errorText}`;
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
              errorMessage = innerError.message || "حدث خطأ في البيانات";
            }
          } else {
            errorMessage = innerError.message || "حدث خطأ في النظام";
          }
        } else if (typeof errorData === "object" && !Array.isArray(errorData)) {
          const messages = parseFieldErrors(errorData);
          if (messages.length > 0) {
            errorMessage = messages.join(" | ");
          }
        } else if (typeof errorData === "string") {
          errorMessage = errorData;
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
        <h1 className="text-4xl font-black text-white mb-4 tracking-tight">تم استلام طلبك بنجاح!</h1>
        <div className="max-w-2xl space-y-6">
          <p className="text-xl text-muted-foreground leading-relaxed">
            شكراً لتسجيل أكاديميتك ({formData.academy_name}). 
            حسابك الآن <strong>قيد المراجعة</strong> من قبل فريق الإدارة.
          </p>
          
          <div className="glass-card p-8 border-amber-500/30 bg-amber-500/5 text-right space-y-4">
            <h3 className="text-lg font-black text-white flex items-center gap-3">
              <Shield className="w-5 h-5 text-amber-500" />
              ماذا سيحدث الآن؟
            </h3>
            <ul className="space-y-3 text-sm text-muted-foreground font-bold">
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 shrink-0 mt-0.5">1</div>
                <span>سيقوم أحد مسؤولي المنصة بمراجعة بيانات أكاديميتك وتفعيل الحساب.</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 shrink-0 mt-0.5">2</div>
                <span>ستصلك رسالة تأكيد على البريد الإلكتروني ({formData.email}) بمجرد التفعيل.</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 shrink-0 mt-0.5">3</div>
                <span>بعد التفعيل، ستتمكن من الدخول إلى لوحة التحكم عبر الرابط الخاص بك.</span>
              </li>
            </ul>
          </div>

          <div className="pt-8">
            <Link 
              href="/login"
              className="text-primary font-black hover:underline flex items-center justify-center gap-2"
            >
              العودة لصفحة الدخول
              <ArrowRight className="w-4 h-4 rtl-flip" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-6 page-enter">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary mb-6">
          <Sparkles className="h-3.5 w-3.5" />
          ابدأ رحلتك مع ميدان اليوم
        </div>
        <h1 className="text-4xl font-black text-white mb-4 tracking-tight">تسجيل أكاديمية جديدة</h1>
        <p className="text-muted-foreground font-bold">أدخل تفاصيل الأكاديمية واختر الباقة المناسبة للبدء</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Section 1: Manager & Academy Info */}
          <div className="space-y-8">
            <h2 className="text-sm font-black text-primary uppercase tracking-[0.2em] flex items-center gap-3">
              <User className="w-5 h-5" />
              بيانات المدير العام للأكاديمية
            </h2>
            
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">الاسم الأول</label>
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
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">اسم العائلة</label>
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
                <h2 className="text-sm font-black text-primary uppercase tracking-[0.2em] flex items-center gap-3 mb-6">
                  <Building2 className="w-5 h-5" />
                  بيانات الأكاديمية
                </h2>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">اسم الأكاديمية</label>
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
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">رابط الأكاديمية (Slug)</label>
                  <div className="relative group">
                    <input
                      type="text"
                      name="slug"
                      required
                      value={formData.slug}
                      onChange={handleChange}
                      placeholder="elite-academy"
                      className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 pr-5 pl-24 text-white focus:outline-none focus:border-primary/50 transition-all font-mono"
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-muted-foreground pointer-events-none">
                      .{window.location.hostname}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Plan Selection */}
          <div className="space-y-8">
            <h2 className="text-sm font-black text-primary uppercase tracking-[0.2em] flex items-center gap-3">
              <Sparkles className="w-5 h-5" />
              اختر باقة الاشتراك
            </h2>

            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {plans.map((plan) => (
                <div 
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={cn(
                    "glass-card p-6 cursor-pointer transition-all duration-300 relative border-2 group",
                    selectedPlan === plan.id 
                      ? "border-primary bg-primary/5 shadow-lg shadow-primary/10" 
                      : "border-white/5 hover:border-white/20 hover:bg-white/[0.02]"
                  )}
                >
                  {selectedPlan === plan.id && (
                    <div className="absolute -left-2 -top-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white shadow-lg">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                  )}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-black text-white text-lg">{plan.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1 font-bold">{plan.description || "باقة مرنة تلبي احتياجاتك"}</p>
                    </div>
                    <div className="text-left">
                      <span className="text-xl font-black text-white">{plan.price_monthly}</span>
                      <span className="text-[10px] text-muted-foreground mr-1 font-black uppercase">{plan.currency} / شهرياً</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-y-2 mt-4 pt-4 border-t border-white/5">
                    <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                      {plan.max_students} طالب
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                      {plan.max_locations} فرع
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                      {plan.max_staff} موظف
                    </div>
                  </div>

                  {/* Dynamic Features */}
                  <div className="mt-4 space-y-2">
                    {Object.entries(plan.features || {}).map(([key, enabled]) => {
                      if (!enabled) return null;
                      const labelMap: Record<string, string> = {
                        whatsapp: "تنبيهات واتساب",
                        kiosk: "جهاز الحضور والبحث",
                        reports: "التقارير المتقدمة",
                        billing: "الفواتير والاشتراكات",
                        staff: "إدارة المدربين",
                        documents: "وثائق الطلاب",
                      };
                      return (
                        <div key={key} className="flex items-center gap-2 text-white/50 text-[11px] font-bold">
                          <Check className="w-3 h-3 text-primary" />
                          <span>
                            {labelMap[key] || key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              
              {plans.length === 0 && (
                <div className="py-12 text-center text-muted-foreground font-bold italic">
                  جاري تحميل الباقات...
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="p-6 rounded-[2rem] bg-destructive/10 border border-destructive/20 flex items-start gap-4 text-destructive animate-shake">
            <AlertCircle className="w-6 h-6 shrink-0" />
            <div className="flex-1">
               <p className="font-black">فشل التسجيل</p>
               <p className="text-sm opacity-90 mt-1">{error}</p>
            </div>
          </div>
        )}

        <div className="pt-4">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary hover:bg-primary/90 text-white font-black py-5 rounded-[2rem] shadow-xl shadow-primary/20 flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                جاري إنشاء الأكاديمية...
              </>
            ) : (
              <>
                إتمام عملية التسجيل
                <ArrowRight className="w-5 h-5 rtl-flip group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          لديك حساب بالفعل؟{" "}
          <Link href="/login" className="text-primary font-bold hover:underline">
            تسجيل الدخول
          </Link>
        </p>
      </form>
    </div>
  );
}
