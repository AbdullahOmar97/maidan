"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Shield, Eye, EyeOff, Sparkles, ChevronLeft, ArrowLeft } from "lucide-react";
import { isTenantHost } from "@/lib/auth/host";
import { cn } from "@/lib/utils";
import { ErrorAlert } from "@/components/ErrorAlert";

const EMAIL_ERROR = "البريد الإلكتروني غير صالح";
const EMAIL_REQUIRED = "البريد الإلكتروني مطلوب";
const PASSWORD_REQUIRED = "كلمة المرور مطلوبة";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>("");
  const [errorTitle, setErrorTitle] = useState<string>("فشل العملية");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTenantLogin, setIsTenantLogin] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const prefilledEmail = useMemo(() => searchParams.get("email") || "", [searchParams]);

  useEffect(() => {
    const hostname = window.location.hostname;
    const isTenant = isTenantHost(hostname);
    setIsTenantLogin(isTenant);

    if (isTenant) {
      checkTenantStatus();
    }
  }, []);

  const checkTenantStatus = async () => {
    try {
      // Use the proxied backend path to correctly hit the backend API via the frontend dev server/nginx
      const res = await fetch("/api/backend/v1/academy/me/");
      
      if (res.status === 403) {
        const data = await res.json();
        if (data.error?.code === "tenant_inactive" || data.error?.code === "subscription_expired") {
          setErrorTitle(
            data.error.status === "pending" ? "قيد المراجعة" : 
            data.error.status === "expired" ? "اشتراك منتهي" : "النادي غير مفعل"
          );
          setError(data.error.message);
          setIsLocked(true);
        }
      }
    } catch (err) {
      console.error("Status check failed:", err);
    }
  };

  useEffect(() => {
    if (prefilledEmail) {
      setEmail(prefilledEmail);
    }
  }, [prefilledEmail]);

  const validateEmail = (value: string): boolean =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const onDiscoverTenant = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setErrorTitle("فشل العملية");

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError(EMAIL_REQUIRED);
      return;
    }
    if (!validateEmail(normalizedEmail)) {
      setError(EMAIL_ERROR);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/discover-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const data = await response.json();

      if (!response.ok || !data?.found || !data?.login_url) {
        if (data?.code === "pending_approval") {
          setErrorTitle("قيد المراجعة");
          setError("حسابك قيد المراجعة حالياً، يرجى الانتظار لحين تفعيله من قبل الإدارة.");
        } else {
          setError("لم نتمكن من العثور على نادٍ مرتبط بهذا البريد الإلكتروني");
        }
        return;
      }

      window.location.assign(data.login_url);
    } catch {
      setError("حدث خطأ أثناء تحديد النادي، حاول مرة أخرى");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onTenantLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setErrorTitle("فشل العملية");

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError(EMAIL_REQUIRED);
      return;
    }
    if (!validateEmail(normalizedEmail)) {
      setError(EMAIL_ERROR);
      return;
    }
    if (!password.trim()) {
      setError(PASSWORD_REQUIRED);
      return;
    }

    setIsSubmitting(true);
    const result = await signIn("credentials", {
      email: normalizedEmail,
      password,
      redirect: false,
    });
    setIsSubmitting(false);

    if (result?.error) {
      if (result.error.includes("SETUP_REQUIRED")) {
        const email = result.error.split(":")[1];
        router.push(`/setup-password?email=${encodeURIComponent(email)}`);
      } else if (result.error.includes("TENANT_INACTIVE")) {
        const message = result.error.split(":")[1];
        setError(message || "هذا النادي غير نشط حالياً. يرجى التواصل مع الإدارة.");
        setErrorTitle("النادي غير مفعل");
      } else {
        setError("البريد الإلكتروني أو كلمة المرور غير صحيحة");
      }
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden selection:bg-primary/30">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse [animation-delay:2s]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.03)_0%,transparent_70%)]" />
        
        {/* Animated Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
      </div>

      <div className="relative w-full max-w-lg px-6 py-12">
        {/* Brand/Logo Section */}
        <div className="text-center mb-10 group cursor-default">
          <div className="relative inline-flex mb-6">
             <div className="absolute inset-0 bg-primary/40 blur-2xl rounded-full scale-150 group-hover:scale-[2] transition-transform duration-700 opacity-20" />
             <div className="relative w-20 h-20 rounded-[2rem] gradient-brand flex items-center justify-center shadow-2xl shadow-primary/40 rotate-12 group-hover:rotate-0 transition-all duration-500">
                <Shield className="w-10 h-10 text-white" />
             </div>
             <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 animate-bounce">
                <Sparkles className="w-4 h-4 text-primary" />
             </div>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter mb-2">
            MAIDAN
          </h1>
          <div className="flex items-center justify-center gap-2">
            <div className="h-px w-8 bg-gradient-to-r from-transparent to-white/20" />
            <p className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em]">نظام إدارة الدوجو المتكامل</p>
            <div className="h-px w-8 bg-gradient-to-l from-transparent to-white/20" />
          </div>
        </div>

        {/* Main Card */}
        <div className="glass-card relative p-10 overflow-hidden group/card border-white/10">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
          
          <div className="relative z-10">
            <h2 className="text-2xl font-black text-white text-center mb-8 tracking-tight">
              {isTenantLogin ? "تسجيل الدخول" : "الدخول إلى النادي"}
            </h2>

            <form onSubmit={isTenantLogin ? onTenantLogin : onDiscoverTenant} className="space-y-6">
              {/* Email Input */}
              <div className="space-y-2.5">
                <label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                  البريد الإلكتروني
                </label>
                <div className="relative">
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full px-5 py-4 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-bold placeholder:text-muted-foreground/30"
                    placeholder="name@example.com"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Password Input */}
              {isTenantLogin && (
                <div className="space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-500">
                  <div className="flex items-center justify-between ml-1">
                    <label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      كلمة المرور
                    </label>
                    <button type="button" className="text-[10px] font-black text-primary hover:underline uppercase tracking-widest">
                      نسيت كلمة المرور؟
                    </button>
                  </div>
                  <div className="relative group/pass">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="w-full px-5 py-4 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-bold placeholder:text-muted-foreground/30 pr-12"
                      placeholder="••••••••"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-4 flex items-center text-muted-foreground hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Error Message */}
              <ErrorAlert 
                error={error} 
                title={errorTitle}
                variant="compact" 
                className="mb-4"
              />

              {/* Submit Button */}
              <button
                id="login-submit"
                type="submit"
                disabled={isSubmitting || isLocked}
                className={cn(
                  "w-full py-4 rounded-2xl gradient-brand text-white text-xs font-black uppercase tracking-widest shadow-2xl shadow-primary/30 transition-all active:scale-95 flex items-center justify-center gap-3 group/btn overflow-hidden relative",
                  (isSubmitting || isLocked) ? "opacity-70" : "hover:scale-[1.02]"
                )}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover/btn:animate-shimmer" />
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>{isTenantLogin ? "تسجيل الدخول" : "متابعة"}</span>
                    {isTenantLogin ? <Shield className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                  </>
                )}
              </button>
            </form>

            {isTenantLogin && (
              <div className="mt-6 text-center animate-in fade-in duration-700 delay-300">
                <Link 
                  href={email ? `/setup-password?email=${encodeURIComponent(email)}` : "/setup-password"}
                  className="inline-flex items-center gap-2 text-[11px] font-black text-primary hover:text-primary/80 transition-colors uppercase tracking-widest group"
                >
                  <Sparkles className="w-3 h-3 group-hover:rotate-12 transition-transform" />
                  <span>هل تسجل دخولك للمرة الأولى؟ فعل حسابك هنا</span>
                </Link>
              </div>
            )}

            {isTenantLogin && (
              <div className="mt-10 pt-8 border-t border-white/5 space-y-4">
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 group/demo hover:border-primary/30 transition-all">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover/demo:scale-110 transition-transform">
                     <Shield className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">حساب تجريبي للمعاينة</p>
                    <p className="text-xs font-bold text-white truncate" dir="ltr">admin@dragons-dojo.sa / admin1234</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Decorative Corner */}
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-primary/10 blur-3xl rounded-full" />
        </div>

        {/* Footer */}
        <div className="mt-10 text-center space-y-6">
           {!isTenantLogin && (
             <p className="text-muted-foreground text-xs font-bold">
               ليس لديك حساب؟ <Link href="/register" className="text-primary hover:underline font-black">سجل أكاديميتك الآن مجاناً</Link>
             </p>
           )}
           <div className="flex items-center justify-center gap-6 opacity-30">
              <span className="h-px w-12 bg-white/20" />
              <p className="text-[10px] font-black uppercase tracking-widest text-white">MAIDAN PLATFORM</p>
              <span className="h-px w-12 bg-white/20" />
           </div>
           <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest">
            © {new Date().getFullYear()} — جميع الحقوق محفوظة
          </p>
        </div>
      </div>
    </div>
  );
}

