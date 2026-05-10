"use client";

import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Shield, Eye, EyeOff, Sparkles, CheckCircle2, Phone, Mail, Lock, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api/client";
import { toast } from "sonner";
import { ErrorAlert } from "@/components/ErrorAlert";

function SetupPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string>("");
  const [errorTitle, setErrorTitle] = useState<string>("فشل العملية");

  const onSetupPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setErrorTitle("فشل العملية");
    
    if (password !== passwordConfirm) {
      setError("كلمات المرور غير متطابقة");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.auth.passwordSetup({
        email,
        phone,
        new_password: password,
        new_password_confirm: passwordConfirm,
      });
      setIsSuccess(true);
      toast.success("تم ضبط كلمة المرور بنجاح");
      setTimeout(() => {
        router.push(`/login?email=${encodeURIComponent(email)}`);
      }, 3000);
    } catch (err: any) {
      const data = err.response?.data;
      let errorMsg = "حدث خطأ أثناء ضبط كلمة المرور";

      if (data) {
        if (typeof data === 'string') {
          errorMsg = data;
        } else if (typeof data === 'object') {
          // Handle DRF style errors: {"detail": "..."} or {"field": ["error"]}
          if (data.detail && typeof data.detail === 'string') {
            errorMsg = data.detail;
          } else if (data.message && typeof data.message === 'string') {
            errorMsg = data.message;
          } else {
            const values = Object.values(data);
            if (values.length > 0) {
              const first = values[0];
              if (Array.isArray(first)) {
                errorMsg = first[0];
              } else if (typeof first === 'string') {
                errorMsg = first;
              }
            }
          }
        }
      }
      setError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="glass-card p-10 text-center animate-in zoom-in-95 duration-500">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        </div>
        <h2 className="text-2xl font-black text-white mb-4">تم التفعيل بنجاح!</h2>
        <p className="text-muted-foreground mb-8">
          لقد قمت بضبط كلمة المرور الخاصة بك. سيتم تحويلك لصفحة تسجيل الدخول خلال ثوانٍ...
        </p>
        <button
          onClick={() => router.push(`/login?email=${encodeURIComponent(email)}`)}
          className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2"
        >
          <span>تسجيل الدخول الآن</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="glass-card relative p-10 overflow-hidden border-white/10">
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
      
      <div className="relative z-10">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-black text-white tracking-tight mb-2">تفعيل الحساب</h2>
          <p className="text-sm text-muted-foreground">مرحباً بك في ميدان! يرجى ضبط كلمة المرور الخاصة بك للبدء</p>
        </div>

        <form onSubmit={onSetupPassword} className="space-y-6">
          {/* Email (Readonly) */}
          <div className="space-y-2.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ms-1">البريد الإلكتروني</label>
            <div className="relative">
              <div className="absolute inset-y-0 end-4 flex items-center pointer-events-none text-muted-foreground">
                <Mail className="w-4 h-4" />
              </div>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full ps-12 pe-5 py-4 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-bold placeholder:text-muted-foreground/30"
                placeholder="name@example.com"
                dir="ltr"
              />
            </div>
          </div>

          {/* Phone Verification */}
          <div className="space-y-2.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ms-1">رقم الهاتف للتحقق</label>
            <div className="relative">
              <div className="absolute inset-y-0 end-4 flex items-center pointer-events-none text-muted-foreground">
                <Phone className="w-4 h-4" />
              </div>
              <input
                required
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full ps-12 pe-5 py-4 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-bold placeholder:text-muted-foreground/30"
                placeholder="05xxxxxxxx"
                dir="ltr"
              />
            </div>
            <p className="text-[10px] text-muted-foreground/60 me-1 mt-1 italic">أدخل رقم الهاتف الذي قام المدير بتسجيله لك</p>
          </div>

          {/* New Password */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ms-1">كلمة المرور الجديدة</label>
              <div className="relative group/pass">
                <div className="absolute inset-y-0 end-4 flex items-center pointer-events-none text-muted-foreground">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full ps-12 pe-12 py-4 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-bold placeholder:text-muted-foreground/30"
                  placeholder="••••••••"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 start-4 flex items-center text-muted-foreground hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ms-1">تأكيد كلمة المرور</label>
              <div className="relative group/pass">
                <div className="absolute inset-y-0 end-4 flex items-center pointer-events-none text-muted-foreground">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  className="w-full ps-12 pe-12 py-4 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-bold placeholder:text-muted-foreground/30"
                  placeholder="••••••••"
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          {/* Error Message */}
          <ErrorAlert 
            error={error} 
            title={errorTitle}
            variant="compact" 
            className="mb-4"
          />

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              "w-full py-4 rounded-2xl gradient-brand text-white text-xs font-black uppercase tracking-widest shadow-2xl shadow-primary/30 transition-all active:scale-95 flex items-center justify-center gap-3 group/btn overflow-hidden relative mt-4",
              isSubmitting ? "opacity-70" : "hover:scale-[1.02]"
            )}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover/btn:animate-shimmer" />
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>حفظ وتفعيل الحساب</span>
                <Sparkles className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function SetupPasswordPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden selection:bg-primary/30">
      {/* Decorative Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] end-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] start-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse [animation-delay:2s]" />
      </div>

      <div className="relative w-full max-w-2xl px-6 py-12">
        <div className="text-center mb-10">
          <div className="relative inline-flex mb-6">
             <div className="relative w-16 h-16 rounded-2xl gradient-brand flex items-center justify-center shadow-2xl rotate-12">
                <Shield className="w-8 h-8 text-white" />
             </div>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tighter mb-2">MAIDAN</h1>
        </div>

        <Suspense fallback={
          <div className="glass-card p-12 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground font-bold">جاري التحميل...</p>
          </div>
        }>
          <SetupPasswordContent />
        </Suspense>

        <div className="mt-10 text-center opacity-30">
          <p className="text-[10px] font-black uppercase tracking-widest text-white">MAIDAN PLATFORM</p>
        </div>
      </div>
    </div>
  );
}
