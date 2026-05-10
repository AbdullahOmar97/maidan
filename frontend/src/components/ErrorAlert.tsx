import React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorAlertProps {
  error: string | null;
  title?: string;
  subtitle?: string;
  variant?: "large" | "compact";
  className?: string;
}

export function ErrorAlert({ 
  error, 
  title = "فشل العملية", 
  subtitle = "خطأ في البيانات",
  variant = "large",
  className 
}: ErrorAlertProps) {
  if (!error) return null;

  const roundedClass = variant === "compact" ? "rounded-xl" : "rounded-2xl";

  return (
    <div className={cn("relative group animate-shake", className)}>
      {/* Subtle Outer Glow */}
      <div className="absolute -inset-0.5 bg-red-500/20 rounded-[1.2rem] blur-xl opacity-100 animate-pulse pointer-events-none" />
      
      <div className={cn("relative overflow-hidden border border-red-500/40 bg-red-950/60 backdrop-blur-3xl shadow-xl shadow-black/40", roundedClass)}>
        {/* Side Glow Bar */}
        <div className="absolute inset-y-0 end-0 w-1 bg-gradient-to-b from-red-400 via-red-600 to-red-400" />

        {variant === "compact" ? (
          <div className="relative p-3 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500 text-white shrink-0">
              <AlertCircle className="h-4 h-4 animate-pulse" />
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-widest text-red-300/80 leading-none mb-0.5">{title}</span>
              <p className="text-xs font-bold text-white leading-tight">{error}</p>
            </div>
          </div>
        ) : (
          <div className="relative p-5 flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-red-700 text-white shadow-lg shadow-red-500/20 border border-white/20 shrink-0 mt-0.5">
              <AlertCircle className="h-6 w-6 animate-pulse" />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight text-white">{title}</h3>
                <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-red-200 ring-1 ring-white/10">
                  {subtitle}
                </span>
              </div>
              <p className="text-sm font-bold text-red-50/80 leading-relaxed">
                {error}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
