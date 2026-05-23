"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Loader2, Shield, Sparkles, ArrowRight, ArrowLeft, Mail, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ErrorAlert } from "@/components/ErrorAlert";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const validateEmail = (value: string): boolean =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("البريد الإلكتروني مطلوب");
      return;
    }
    if (!validateEmail(normalizedEmail)) {
      setError("البريد الإلكتروني غير صالح");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/v1/accounts/password/reset/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      if (!response.ok) {
        throw new Error("Failed to send reset email");
      }

      setIsSuccess(true);
    } catch {
      setError("حدث خطأ أثناء إرسال طلب إعادة التعيين، حاول مرة أخرى");
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
          <Link href="/login" className="relative inline-flex mb-6">
             <div className="absolute inset-0 bg-primary/40 blur-2xl rounded-full scale-150 group-hover:scale-[2] transition-transform duration-700 opacity-20" />
             <div className="relative w-20 h-20 rounded-[2rem] gradient-brand flex items-center justify-center shadow-2xl shadow-primary/40 rotate-12 group-hover:rotate-0 transition-all duration-500">
                <Shield className="w-10 h-10 text-white" />
             </div>
          </Link>
          <h1 className="text-4xl font-black text-white tracking-tighter mb-2">
            MAIDAN
          </h1>
          <p className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em]">استعادة الوصول إلى حسابك</p>
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
                <h2 className="text-2xl font-black text-white">تفقد بريدك الإلكتروني</h2>
                <p className="text-muted-foreground font-medium leading-relaxed">
                  إذا كان البريد <strong>{email}</strong> مسجلاً لدينا، فستصلك رسالة تحتوي على رابط لإعادة تعيين كلمة المرور.
                </p>
                <div className="pt-6">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 text-xs font-black text-primary hover:text-primary/80 transition-colors uppercase tracking-widest"
                  >
                    <ArrowLeft className="w-4 h-4 rtl-flip" />
                    <span>العودة لصفحة تسجيل الدخول</span>
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-black text-white text-center mb-4 tracking-tight">
                  نسيت كلمة المرور؟
                </h2>
                <p className="text-muted-foreground text-center text-sm font-medium mb-8">
                  أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور.
                </p>

                <form onSubmit={onSubmit} className="space-y-6">
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
                        className="w-full px-5 py-4 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-bold placeholder:text-muted-foreground/30 pe-12"
                        placeholder="name@example.com"
                        dir="ltr"
                      />
                      <div className="absolute inset-y-0 start-4 flex items-center text-muted-foreground">
                        <Mail className="w-5 h-5" />
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
                    disabled={isSubmitting}
                    className={cn(
                      "w-full py-4 rounded-2xl gradient-brand text-white text-xs font-black uppercase tracking-widest shadow-2xl shadow-primary/30 transition-all active:scale-95 flex items-center justify-center gap-3 group/btn overflow-hidden relative",
                      isSubmitting ? "opacity-70" : "hover:scale-[1.02]"
                    )}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover/btn:animate-shimmer" />
                    {isSubmitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <span>إرسال رابط التعيين</span>
                        <Sparkles className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-8 text-center">
                  <Link 
                    href="/login"
                    className="inline-flex items-center gap-2 text-[11px] font-black text-primary hover:text-primary/80 transition-colors uppercase tracking-widest group"
                  >
                    <ArrowLeft className="w-3 h-3 rtl-flip group-hover:-translate-x-1 rtl:group-hover:translate-x-1 transition-transform" />
                    <span>العودة لتسجيل الدخول</span>
                  </Link>
                </div>
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
