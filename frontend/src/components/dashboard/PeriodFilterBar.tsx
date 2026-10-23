"use client";

import React from "react";
import { Calendar, Filter, RotateCcw, Building2, Tag, Clock } from "lucide-react";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Location } from "@/types";

export interface PeriodOption {
  value: string;
  label: string;
}

export const PERIOD_PRESETS: PeriodOption[] = [
  { value: "this_month", label: "هذا الشهر" },
  { value: "today", label: "اليوم" },
  { value: "this_week", label: "هذا الأسبوع" },
  { value: "last_month", label: "الشهر السابق" },
  { value: "last_30_days", label: "آخر 30 يوماً" },
  { value: "this_quarter", label: "هذا الربع" },
  { value: "this_year", label: "هذه السنة" },
  { value: "all", label: "جميع الأوقات" },
  { value: "custom", label: "مخصص..." },
];

export interface PeriodFilterBarProps {
  period: string;
  onPeriodChange: (p: string) => void;
  startDate?: string;
  onStartDateChange?: (d: string) => void;
  endDate?: string;
  onEndDateChange?: (d: string) => void;
  
  // Date calculation basis
  dateBy?: string;
  onDateByChange?: (b: string) => void;
  dateByOptions?: { value: string; label: string }[];

  // Optional Contextual Filters
  locations?: Location[];
  selectedLocationId?: string;
  onLocationChange?: (id: string) => void;

  plans?: { id: number; name: string }[];
  selectedPlanId?: string;
  onPlanChange?: (id: string) => void;

  statuses?: { value: string; label: string }[];
  selectedStatus?: string;
  onStatusChange?: (s: string) => void;

  // Active date display returned from backend summary (e.g. 2026-10-01 to 2026-10-31)
  resolvedStartDate?: string | null;
  resolvedEndDate?: string | null;

  onReset?: () => void;
  isFiltered?: boolean;
  actions?: React.ReactNode;
  className?: string;
}

export function PeriodFilterBar({
  period,
  onPeriodChange,
  startDate = "",
  onStartDateChange,
  endDate = "",
  onEndDateChange,
  dateBy = "created_at",
  onDateByChange,
  dateByOptions,
  locations,
  selectedLocationId = "",
  onLocationChange,
  plans,
  selectedPlanId = "",
  onPlanChange,
  statuses,
  selectedStatus = "",
  onStatusChange,
  resolvedStartDate,
  resolvedEndDate,
  onReset,
  isFiltered = false,
  actions,
  className,
}: PeriodFilterBarProps) {
  const isCustom = period === "custom";

  return (
    <div className={cn("glass-card p-3 sm:p-4 space-y-3 border-white/10", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Period Selector & Context Filters */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[260px]">
          {/* Period Preset Dropdown */}
          <div className="relative min-w-[150px]">
            <Calendar className="w-3.5 h-3.5 text-primary absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
            <Select
              value={period}
              onChange={(e) => onPeriodChange(e.target.value)}
              className="ps-9 pe-8 py-2 text-xs font-bold bg-white/5 border-white/10 h-9"
              aria-label="تصفية حسب المدة الزمنية"
            >
              {PERIOD_PRESETS.map((p) => (
                <option key={p.value} value={p.value} className="bg-slate-900 text-white">
                  {p.label}
                </option>
              ))}
            </Select>
          </div>

          {/* Date Basis (Issue vs Due vs Paid) */}
          {onDateByChange && dateByOptions && (
            <div className="relative min-w-[130px]">
              <Clock className="w-3.5 h-3.5 text-muted-foreground absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
              <Select
                value={dateBy}
                onChange={(e) => onDateByChange(e.target.value)}
                className="ps-9 pe-8 py-2 text-xs font-bold bg-white/5 border-white/10 h-9"
                aria-label="تاريخ الحساب"
              >
                {dateByOptions.map((o) => (
                  <option key={o.value} value={o.value} className="bg-slate-900 text-white">
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {/* Location / Branch Filter */}
          {locations && onLocationChange && (
            <div className="relative min-w-[140px]">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
              <Select
                value={selectedLocationId}
                onChange={(e) => onLocationChange(e.target.value)}
                className="ps-9 pe-8 py-2 text-xs font-bold bg-white/5 border-white/10 h-9"
                aria-label="تصفية حسب الفرع"
              >
                <option value="" className="bg-slate-900 text-white">جميع الفروع</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id} className="bg-slate-900 text-white">
                    {loc.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {/* Plan Filter */}
          {plans && onPlanChange && (
            <div className="relative min-w-[140px]">
              <Tag className="w-3.5 h-3.5 text-muted-foreground absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
              <Select
                value={selectedPlanId}
                onChange={(e) => onPlanChange(e.target.value)}
                className="ps-9 pe-8 py-2 text-xs font-bold bg-white/5 border-white/10 h-9"
                aria-label="تصفية حسب الباقة"
              >
                <option value="" className="bg-slate-900 text-white">جميع الباقات</option>
                {plans.map((pl) => (
                  <option key={pl.id} value={pl.id} className="bg-slate-900 text-white">
                    {pl.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {/* Status Filter */}
          {statuses && onStatusChange && (
            <div className="relative min-w-[130px]">
              <Filter className="w-3.5 h-3.5 text-muted-foreground absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
              <Select
                value={selectedStatus}
                onChange={(e) => onStatusChange(e.target.value)}
                className="ps-9 pe-8 py-2 text-xs font-bold bg-white/5 border-white/10 h-9"
                aria-label="تصفية حسب الحالة"
              >
                <option value="" className="bg-slate-900 text-white">جميع الحالات</option>
                {statuses.map((s) => (
                  <option key={s.value} value={s.value} className="bg-slate-900 text-white">
                    {s.label}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>

        {/* Custom Actions */}
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}

        {/* Reset Filters Button */}
        {isFiltered && onReset && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all active:scale-95"
            title="إعادة ضبط جميع الفلاتر"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>إعادة ضبط</span>
          </button>
        )}
      </div>

      {/* Custom Date Range Inputs (when period === 'custom') */}
      {isCustom && onStartDateChange && onEndDateChange && (
        <div className="pt-2 border-t border-white/5 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="w-3.5 h-3.5 text-primary" />
            <span className="font-bold">فترة مخصصة:</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-bold">من:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-white focus:outline-none focus:border-primary/50"
              aria-label="تاريخ البداية"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-bold">إلى:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-white focus:outline-none focus:border-primary/50"
              aria-label="تاريخ النهاية"
            />
          </div>
        </div>
      )}

      {/* Resolved Period Info Badge */}
      {(resolvedStartDate || resolvedEndDate) && (
        <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground pt-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>نطاق الإحصائيات الفعلي:</span>
          <span className="text-white bg-white/5 px-2 py-0.5 rounded border border-white/10" dir="ltr">
            {resolvedStartDate || "..."} → {resolvedEndDate || "..."}
          </span>
        </div>
      )}
    </div>
  );
}
