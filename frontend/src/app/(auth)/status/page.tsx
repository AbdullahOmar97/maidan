"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  ShieldAlert, 
  Clock, 
  CreditCard, 
  ArrowRight, 
  MessageCircle,
  ShieldCheck,
  ChevronLeft
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function StatusPage() {
  const searchParams = useSearchParams();
  const type = searchParams.get("type") || "inactive";
  const message = searchParams.get("message");

  const statusConfig = {
    pending: {
      title: "حسابك قيد المراجعة",
      description: message || "نحن الآن نقوم بمراجعة بيانات أكاديميتك وتفعيل النظام. ستتلقى إشعاراً بمجرد الانتهاء.",
      icon: Clock,
      color: "from-amber-500 to-orange-600",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
      accent: "text-amber-500",
    },
    expired: {
      title: "انتهت صلاحية الاشتراك",
      description: message || "يرجى تجديد اشتراكك للمتابعة في استخدام كافة مميزات المنصة.",
      icon: CreditCard,
      color: "from-red-500 to-rose-600",
      bg: "bg-red-500/10",
      border: "border-red-500/20",
      accent: "text-red-500",
    },
    inactive: {
      title: "النادي غير مفعل",
      description: message || "هذا الحساب غير نشط حالياً. يرجى التواصل مع إدارة المنصة للمزيد من التفاصيل.",
      icon: ShieldAlert,
      color: "from-slate-500 to-slate-700",
      bg: "bg-slate-500/10",
      border: "border-slate-500/20",
      accent: "text-slate-400",
    },
  };

  const currentStatus = statusConfig[type as keyof typeof statusConfig] || statusConfig.inactive;
  const Icon = currentStatus.icon;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden selection:bg-primary/30">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={cn("absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] animate-pulse opacity-20", currentStatus.bg.replace('/10', '/30'))} />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse [animation-delay:2s] opacity-20" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
      </div>

      <div className="relative w-full max-w-xl px-6 py-12">
        {/* Brand Section */}
        <div className="text-center mb-12">
          <div className="relative inline-flex mb-8">
             <div className="absolute inset-0 bg-primary/40 blur-2xl rounded-full scale-150 opacity-20" />
             <div className="relative w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-xl">
                <ShieldCheck className="w-8 h-8 text-primary" />
             </div>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tighter uppercase mb-2">MAIDAN</h1>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Platform Status Center</p>
        </div>

        {/* Main Card */}
        <div className="glass-card relative p-8 md:p-12 overflow-hidden border-white/10 text-center">
          <div className={cn("absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r via-transparent opacity-100", `from-${type === 'pending' ? 'amber' : type === 'expired' ? 'red' : 'slate'}-500`, `to-${type === 'pending' ? 'orange' : type === 'expired' ? 'rose' : 'slate'}-600`)} />
          
          <div className="relative z-10 space-y-8">
            {/* Status Icon */}
            <div className="flex justify-center">
              <div className={cn("relative w-24 h-24 rounded-3xl flex items-center justify-center shadow-2xl border transition-transform duration-500 hover:scale-105", currentStatus.bg, currentStatus.border)}>
                <Icon className={cn("w-12 h-12", currentStatus.accent)} />
                <div className={cn("absolute -top-2 -right-2 w-8 h-8 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 animate-bounce", currentStatus.accent)}>
                   <ShieldAlert className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="space-y-4">
              <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight leading-tight">
                {currentStatus.title}
              </h2>
              <p className="text-slate-400 text-lg font-medium max-w-md mx-auto leading-relaxed">
                {currentStatus.description}
              </p>
            </div>

            {/* Actions */}
            <div className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link
                href="/login"
                className="flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all font-bold text-white group"
              >
                <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                <span>العودة للرئيسية</span>
              </Link>
              
              <button
                className={cn(
                  "flex items-center justify-center gap-3 px-6 py-4 rounded-2xl text-white font-black uppercase tracking-widest shadow-2xl transition-all hover:scale-[1.02] active:scale-95 group overflow-hidden relative",
                  `bg-gradient-to-r ${currentStatus.color}`
                )}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:animate-shimmer" />
                <span>تواصل معنا</span>
                <MessageCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Support Info */}
            <div className="pt-10 border-t border-white/5">
              <p className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-widest mb-4">Support Reference ID</p>
              <code className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-[10px] font-mono text-slate-400 tracking-wider">
                REF-{Math.random().toString(36).substring(2, 10).toUpperCase()}
              </code>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
           <p className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-[0.3em]">
            MAIDAN — INTEGRATED DOJO MANAGEMENT
          </p>
        </div>
      </div>
    </div>
  );
}
