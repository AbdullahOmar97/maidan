"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Shield, Sparkles, ArrowRight, Lock, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ErrorAlert } from "@/components/ErrorAlert";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("رابط إعادة التعيين غير صالح أو منتهي الصلاحية.");
    }
  }, [token]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!token) {
      setError("رابط إعادة التعيين مفقود.");
      return;
    }
    if (password.length < 8) {
      setError("كلمة المرور يجب أن تكون 8 أحرف على الأقل.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("كلمات المرور غير متطابقة.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/v1/auth/password/reset/confirm/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          new_password: password,
          new_password_confirm: passwordConfirm,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error?.code === "invalid_token") {
          setError("رابط إعادة التعيين غير صالح أو منتهي الصلاحية.");
        } else {
          setError("حدث خطأ أثناء إعادة تعيين كلمة المرور، حاول مرة أخرى.");
        }
        return;
      }

      setIsSuccess(true);
      // Auto redirect to login after 3 seconds
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch {
      setError("حدث خطأ في الاتصال بالخادم، حاول مرة أخرى.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden selection:bg-primary/30">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] end-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] start-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse [animation-delay:2s]" />

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
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter mb-2">
            MAIDAN
          </h1>
          <p className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em]">تعيين كلمة مرور جديدة</p>
        </div>

        {/* Main Card */}
        <div className="glass-card relative p-10 overflow-hidden border-white/10">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />

          <div className="relative z-10">
            {isSuccess ? (
              <div className="text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
                <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </div>
                <h2 className="text-2xl font-black text-white">تم تغيير كلمة المرور</h2>
                <p className="text-muted-foreground font-medium leading-relaxed">
                  تمت إعادة تعيين كلمة المرور بنجاح. سيتم تحويلك إلى صفحة تسجيل الدخول خلال لحظات.
                </p>
                <div className="pt-6">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 text-xs font-black text-primary hover:text-primary/80 transition-colors uppercase tracking-widest"
                  >
                    <span>انتقل لتسجيل الدخول الآن</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-black text-white text-center mb-8 tracking-tight">
                  كلمة المرور الجديدة
                </h2>

                <form onSubmit={onSubmit} className="space-y-6">
                  {/* Password Input */}
                  <div className="space-y-2.5">
                    <label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ms-1">
                      كلمة المرور الجديدة
                    </label>
                    <div className="relative group/pass">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="w-full px-5 py-4 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-bold placeholder:text-muted-foreground/30 pe-12"
                        placeholder="••••••••"

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

                  {/* Confirm Password Input */}
                  <div className="space-y-2.5">
                    <label htmlFor="password-confirm" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ms-1">
                      تأكيد كلمة المرور
                    </label>
                    <div className="relative">
                      <input
                        id="password-confirm"
                        type={showPassword ? "text" : "password"}
                        value={passwordConfirm}
                        onChange={(event) => setPasswordConfirm(event.target.value)}
                        className="w-full px-5 py-4 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-bold placeholder:text-muted-foreground/30 pe-12"
                        placeholder="••••••••"

                      />
                      <div className="absolute inset-y-0 start-4 flex items-center text-muted-foreground">
                        <Lock className="w-5 h-5" />
                      </div>
                    </div>
                  </div>

                  {/* Error Message */}
                  <ErrorAlert
                    error={error}
                    variant="compact"
                    className="mb-4"
                  />

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting || !token}
                    className={cn(
                      "w-full py-4 rounded-2xl gradient-brand text-white text-xs font-black uppercase tracking-widest shadow-2xl shadow-primary/30 transition-all active:scale-95 flex items-center justify-center gap-3 group/btn overflow-hidden relative",
                      (isSubmitting || !token) ? "opacity-70" : "hover:scale-[1.02]"
                    )}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover/btn:animate-shimmer" />
                    {isSubmitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <span>حفظ كلمة المرور</span>
                        <Sparkles className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>

          {/* Decorative Corner */}
          <div className="absolute -bottom-10 -start-10 w-32 h-32 bg-primary/10 blur-3xl rounded-full" />
        </div>
      </div>
    </div>
  );
}
