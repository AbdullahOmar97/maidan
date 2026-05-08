import React from "react";
import Link from "next/link";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type ColorKey = "primary" | "emerald" | "amber" | "red" | "blue" | "gray";

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: ColorKey;
  /** Small badge shown beside the icon (e.g. overdue count) */
  badge?: string | number;
  description?: string;
  /** Format value as currency using formatCurrency() */
  isCurrency?: boolean;
  currency?: string;

  // ── Trend / KPI props (merged from KPICard) ──
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  /** If provided, the card becomes a Next.js Link */
  href?: string;
  /** Shows a shimmer skeleton instead of content */
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Color map — single source of truth
// ---------------------------------------------------------------------------
const COLOR_STYLES: Record<ColorKey, {
  text: string;
  bg: string;
  border: string;
  glow: string;
  blobBg: string;
}> = {
  primary: {
    text:   "text-primary",
    bg:     "bg-primary/10",
    border: "border-primary/20",
    glow:   "shadow-primary/20",
    blobBg: "bg-primary",
  },
  emerald: {
    text:   "text-emerald-400",
    bg:     "bg-emerald-500/10",
    border: "border-emerald-500/20",
    glow:   "shadow-emerald-500/20",
    blobBg: "bg-emerald-500",
  },
  amber: {
    text:   "text-amber-400",
    bg:     "bg-amber-500/10",
    border: "border-amber-500/20",
    glow:   "shadow-amber-500/20",
    blobBg: "bg-amber-500",
  },
  red: {
    text:   "text-red-400",
    bg:     "bg-red-500/10",
    border: "border-red-500/20",
    glow:   "shadow-red-500/20",
    blobBg: "bg-red-500",
  },
  blue: {
    text:   "text-blue-400",
    bg:     "bg-blue-500/10",
    border: "border-blue-500/20",
    glow:   "shadow-blue-500/20",
    blobBg: "bg-blue-500",
  },
  gray: {
    text:   "text-muted-foreground",
    bg:     "bg-white/5",
    border: "border-white/10",
    glow:   "shadow-white/5",
    blobBg: "bg-white",
  },
};

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function StatsCardSkeleton() {
  return (
    <div className="glass-card p-5 md:p-8 space-y-5">
      <div className="shimmer h-12 w-12 rounded-2xl" />
      <div className="space-y-2">
        <div className="shimmer h-8 w-24" />
        <div className="shimmer h-4 w-32" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function StatsCard({
  label,
  value,
  icon: Icon,
  color = "primary",
  badge,
  description,
  isCurrency = false,
  currency = "JOD",
  subtitle,
  trend,
  trendValue,
  href,
  loading = false,
}: StatsCardProps) {
  if (loading) return <StatsCardSkeleton />;

  const style      = COLOR_STYLES[color];
  const formatted  = isCurrency ? formatCurrency(Number(value), currency) : value;

  const card = (
    <div className="glass-card p-5 md:p-8 group relative overflow-hidden hover:border-white/20 transition-all duration-500 hover:-translate-y-0.5">
      {/* Decorative blob */}
      <div
        className={cn(
          "absolute -right-8 -top-8 w-24 h-24 blur-[50px] opacity-20 group-hover:opacity-40 transition-opacity",
          style.blobBg
        )}
        aria-hidden="true"
      />

      {/* Top row: icon + badge OR trend pill */}
      <div className="flex items-start justify-between mb-5 relative z-10">
        <div
          className={cn(
            "w-11 h-11 md:w-12 md:h-12 rounded-2xl flex items-center justify-center border shadow-xl transition-all duration-500 group-hover:scale-110 group-hover:rotate-3",
            style.bg, style.border, style.text, style.glow
          )}
        >
          <Icon className="w-5 h-5 md:w-6 md:h-6" aria-hidden="true" />
        </div>

        {/* Trend pill (KPI mode) */}
        {trend && trendValue && (
          <div
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
              trend === "up"
                ? "bg-emerald-500/10 text-emerald-400"
                : trend === "down"
                ? "bg-red-500/10 text-red-400"
                : "bg-white/5 text-muted-foreground"
            )}
          >
            {trend === "up"   && <TrendingUp   className="w-3 h-3" aria-hidden="true" />}
            {trend === "down" && <TrendingDown className="w-3 h-3" aria-hidden="true" />}
            {trendValue}
          </div>
        )}

        {/* Badge (stats mode) */}
        {!trend && badge != null && (
          <span
            className={cn(
              "px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-500/20",
              color === "red" ? "bg-red-500/10 text-red-400" : "bg-white/5 text-muted-foreground"
            )}
          >
            {badge}
          </span>
        )}
      </div>

      {/* Value + labels */}
      <div className="relative z-10">
        <p className="text-3xl md:text-4xl font-black tracking-tight text-white mb-1.5 text-gradient" dir="ltr">
          {formatted}
        </p>
        <p className="text-sm font-bold text-white group-hover:text-primary transition-colors">
          {label}
        </p>
        {(subtitle ?? description) && (
          <p className="text-xs font-medium text-muted-foreground/70 mt-1.5">
            {subtitle ?? description}
          </p>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-2xl">
        {card}
      </Link>
    );
  }
  return card;
}
