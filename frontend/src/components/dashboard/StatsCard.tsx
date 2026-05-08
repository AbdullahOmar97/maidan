import React from "react";
import { LucideIcon } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: "primary" | "emerald" | "amber" | "red" | "blue" | "gray";
  badge?: string | number;
  description?: string;
  isCurrency?: boolean;
  currency?: string;
}

export function StatsCard({
  label,
  value,
  icon: Icon,
  color = "primary",
  badge,
  description,
  isCurrency = false,
  currency = "JOD"
}: StatsCardProps) {
  const colorStyles = {
    emerald: {
      text: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      glow: "shadow-emerald-500/20"
    },
    amber: {
      text: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
      glow: "shadow-amber-500/20"
    },
    red: {
      text: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/20",
      glow: "shadow-red-500/20"
    },
    blue: {
      text: "text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
      glow: "shadow-blue-500/20"
    },
    primary: {
      text: "text-primary",
      bg: "bg-primary/10",
      border: "border-primary/20",
      glow: "shadow-primary/20"
    },
    gray: {
      text: "text-muted-foreground",
      bg: "bg-white/5",
      border: "border-white/10",
      glow: "shadow-white/5"
    }
  };

  const style = colorStyles[color];

  return (
    <div className="glass-card p-8 group relative overflow-hidden hover:border-white/20 transition-all duration-500">
      {/* Decorative Glow */}
      <div className={cn(
        "absolute -right-8 -top-8 w-24 h-24 blur-[50px] opacity-20 group-hover:opacity-40 transition-opacity",
        color === "primary" ? "bg-primary" :
        color === "emerald" ? "bg-emerald-500" :
        color === "blue" ? "bg-blue-500" :
        color === "amber" ? "bg-amber-500" :
        color === "red" ? "bg-red-500" : "bg-white"
      )} />

      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center border shadow-xl transition-all duration-500 group-hover:scale-110 group-hover:rotate-3",
          style.bg, style.border, style.text, style.glow
        )}>
          <Icon className="w-6 h-6" />
        </div>
        {badge && (
          <span className={cn(
            "px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-500/20",
            color === "red" ? "bg-red-500/10 text-red-400" : "bg-white/5 text-muted-foreground"
          )}>
            {badge} {label.includes("فواتير") ? "" : "تنبيه"}
          </span>
        )}
      </div>

      <div className="relative z-10">
        <p className="text-4xl font-black tracking-tight text-white mb-2" dir="ltr">
          {isCurrency ? formatCurrency(Number(value), currency) : value}
        </p>
        <p className="text-xs font-black text-white/60 uppercase tracking-widest">{label}</p>
        {description && (
          <p className="text-[10px] font-bold text-muted-foreground/60 mt-2 uppercase tracking-tighter">{description}</p>
        )}
      </div>
    </div>
  );
}
