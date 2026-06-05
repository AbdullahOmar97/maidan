"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { 
  Clock, 
  AlertCircle, 
  XCircle, 
  ShieldAlert, 
  ArrowRight,
  Mail,
  Loader2
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

function StatusContent() {
  const searchParams = useSearchParams();
  const type = searchParams.get("type") || "pending";

  const config: Record<string, {
    icon: any;
    title: string;
    description: string;
    color: string;
    bg: string;
    border: string;
  }> = {
    pending: {
      icon: Clock,
      title: "حسابك قيد المراجعة",
      description: "لقد استلمنا طلبك وهو الآن قيد المراجعة من قبل فريق الإدارة. سيتم تفعيل حسابك قريباً.",
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
    },
    expired: {
      icon: ShieldAlert,
      title: "انتهى اشتراكك",
      description: "عذراً، لقد انتهت صلاحية اشتراك هذه الأكاديمية. يرجى التواصل مع الإدارة لتجديد الاشتراك واستعادة الوصول.",
      color: "text-destructive",
      bg: "bg-destructive/10",
      border: "border-destructive/20",
    },
    inactive: {
      icon: XCircle,
      title: "الحساب غير نشط",
      description: "هذا الحساب معطل حالياً. يرجى التواصل مع الدعم الفني لمزيد من المعلومات.",
      color: "text-muted-foreground",
      bg: "bg-white/5",
      border: "border-white/10",
    }
  };

  const current = config[type] || config.inactive;
  const Icon = current.icon;

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center py-12 px-6 page-enter">
      <div className={cn(
        "w-24 h-24 rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl animate-pulse",
        current.bg,
        current.border,
        "border"
      )}>
        <Icon className={cn("w-12 h-12", current.color)} />
      </div>

      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-4xl font-black text-white tracking-tight">{current.title}</h1>
        <p className="text-xl text-muted-foreground font-bold leading-relaxed">
          {current.description}
        </p>

        <div className="glass-card p-8 border-white/5 bg-white/[0.02] space-y-6 text-end">
          <h3 className="text-lg font-black text-white flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-primary" />
            تحتاج للمساعدة؟
          </h3>
          <p className="text-sm text-muted-foreground font-bold leading-relaxed">
            يمكنك التواصل مع فريق الدعم الفني للمنصة عبر القنوات التالية لمتابعة حالة حسابك أو طلب التفعيل الفوري.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <a 
              href="mailto:support@maidan.app" 
              className="flex-1 flex items-center justify-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all font-bold text-white text-sm"
            >
              <Mail className="w-5 h-5 text-primary" />
              support@maidan.app
            </a>
            <Link 
              href="/login" 
              className="flex-1 flex items-center justify-center gap-3 p-4 rounded-2xl gradient-brand text-white font-black text-sm hover:scale-105 transition-all shadow-xl shadow-primary/20"
            >
              العودة للدخول
              <ArrowRight className="w-5 h-5 rtl-flip" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StatusPage() {
  return (
    <Suspense fallback={
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      </div>
    }>
      <StatusContent />
    </Suspense>
  );
}
