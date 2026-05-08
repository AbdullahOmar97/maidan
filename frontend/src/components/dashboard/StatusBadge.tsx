import React from "react";
import { getStatusBadgeClass, getStatusLabel, cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
  showLabel?: boolean;
}

export function StatusBadge({ status, className, showLabel = true }: StatusBadgeProps) {
  if (!status) return null;

  return (
    <span 
      className={cn(
        "px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border shrink-0 shadow-sm transition-all",
        getStatusBadgeClass(status),
        className
      )}
    >
      {showLabel ? getStatusLabel(status) : status}
    </span>
  );
}
