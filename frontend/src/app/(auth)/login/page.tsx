"use client";

import { FormEvent, useEffect, useMemo, useState, Suspense } from "react";
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

function LoginContent() {
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
  const [trialInfo, setTrialInfo] = useState<{ isTrial: boolean; daysRemaining: number | null } | null>(null);
  const [tenantName, setTenantName] = useState<string>("");
  const [tenantStatus, setTenantStatus] = useState<string>("");
  const [tenantLogo, setTenantLogo] = useState<string>("");

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
      // Use nginx-proxied path directly — /api/ is routed to Django by nginx
      const res = await fetch("/api/v1/academy/public-info/");

      if (res.status === 403) {
        const data = await res.json();
        if (data.error?.code === "tenant_inactive" || data.error?.code === "subscription_expired") {
          const statusType = data.error.status === "pending" ? "pending" :
            data.error.status === "expired" ? "expired" : "inactive";
          router.replace(`/status?type=${statusType}&message=${encodeURIComponent(data.error.message)}`);
        }
      } else if (res.ok) {
        const data = await res.json();
        setTenantName(data.business_name || data.name || "");
        setTenantStatus(data.status || "");
        if (data.logo) setTenantLogo(data.logo);
        if (data.status === "trial" || data.on_trial) {
          setTrialInfo({
            isTrial: true,
            daysRemaining: data.trial_days_remaining !== undefined ? data.trial_days_remaining : null,
          });
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
        } else if (data?.code === "subscription_expired") {
          setErrorTitle("اشتراك منتهي");
          setError("لقد انتهى اشتراكك. يرجى التجديد للمتابعة.");
        } else if (data?.code === "tenant_inactive") {
          setErrorTitle("النادي غير مفعل");
          setError("هذا الحساب غير نشط حالياً. يرجى التواصل مع إدارة المنصة للمزيد من التفاصيل.");
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
      } else if (result.error.includes("FORCE_PASSWORD_RESET")) {
        const token = result.error.split(":")[1];
        router.push(`/reset-password?token=${encodeURIComponent(token)}`);
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
        <div className="absolute top-[-10%] end-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] start-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse [animation-delay:2s]" />
        <div className="absolute top-1/2 start-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.03)_0%,transparent_70%)]" />

        {/* Animated Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
      </div>

      <div className="relative w-full max-w-lg px-6 py-12">
        {/* Brand/Logo Section */}
        <div className="text-center mb-10 group cursor-default">
          <div className="relative inline-flex mb-6">
            <div className="absolute inset-0 bg-primary/40 blur-2xl rounded-full scale-150 group-hover:scale-[2] transition-transform duration-700 opacity-20" />
            <div className="relative w-20 h-20 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-primary/40 group-hover:scale-105 transition-all duration-500 overflow-hidden bg-white">
              <img
                src={isTenantLogin && tenantLogo ? tenantLogo : "/logo.png"}
                alt={isTenantLogin && tenantLogo && tenantName ? `${tenantName} Logo` : "MAIDAN Logo"}
                className="w-full h-full object-contain p-1"
                onError={(e) => { (e.target as HTMLImageElement).src = "/logo.png"; }}
              />
            </div>
            <div className="absolute -top-2 -end-2 w-8 h-8 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 animate-bounce">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter mb-2">
            {isTenantLogin && tenantLogo && tenantName ? tenantName : "MAIDAN"}
          </h1>
          <div className="flex items-center justify-center gap-2">
            <div className="h-px w-8 bg-gradient-to-r from-transparent to-white/20" />
            <p className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em]">
              {isTenantLogin && tenantLogo && tenantName ? "بوابة الدخول الآمنة" : "نظام إدارة الدوجو المتكامل"}
            </p>
            <div className="h-px w-8 bg-gradient-to-l from-transparent to-white/20" />
          </div>
        </div>

        {/* Main Card */}
        <div>
          <div className="glass-card relative p-10 overflow-hidden group/card border-white/10">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />

          <div className="relative z-10">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-black text-white tracking-tight">
                {isTenantLogin && tenantLogo && tenantName ? `تسجيل الدخول إلى ${tenantName}` : "الدخول إلى النادي"}
              </h2>
              {isTenantLogin && tenantStatus && (
                <div className="mt-3 flex items-center justify-center gap-2">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                    tenantStatus === "trial"
                      ? "bg-amber-500/10 border-amber-500/25 text-amber-400"
                      : "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                  )}>
                    {tenantStatus === "trial" ? "فترة تجريبية" : "اشتراك نشط"}
                  </span>
                </div>
              )}
            </div>

            {trialInfo && trialInfo.isTrial && (
              <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-center animate-in fade-in slide-in-from-top-2 duration-500">
                <p className="text-xs font-bold text-amber-400">
                  ⚠️ اشتراك هذا النادي تجريبي.
                  {trialInfo.daysRemaining !== null && (
                    <span> متبقي {trialInfo.daysRemaining} يوم على انتهاء الفترة.</span>
                  )}
                </p>
              </div>
            )}

            <form onSubmit={isTenantLogin ? onTenantLogin : onDiscoverTenant} className="space-y-6">
              {/* Email Input */}
              <div className="space-y-2.5">
                <label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ms-1">
                  البريد الإلكتروني
                </label>
                <div className="relative">
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full px-5 py-4 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-bold text-white placeholder:text-muted-foreground/30"
                    placeholder="name@example.com"

                  />
                </div>
              </div>

              {/* Password Input */}
              {isTenantLogin && (
                <div className="space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-500">
                  <div className="flex items-center justify-between ms-1">
                    <label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      كلمة المرور
                    </label>
                    <Link href="/forgot-password" className="text-[10px] font-black text-primary hover:underline uppercase tracking-widest">
                      نسيت كلمة المرور؟
                    </Link>
                  </div>
                  <div className="relative group/pass">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="w-full px-5 py-4 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-bold text-white placeholder:text-muted-foreground/30 pe-12"
                      placeholder="••••••••"

                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 end-4 flex items-center text-muted-foreground hover:text-white transition-colors"
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


          </div>

          {/* Decorative Corner */}
          <div className="absolute -bottom-10 -start-10 w-32 h-32 bg-primary/10 blur-3xl rounded-full" />
        </div>
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

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}

