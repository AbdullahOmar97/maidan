"use client";

import * as React from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Option {
  id: number;
  name: string;
}

interface MultiSelectProps {
  options: Option[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
  className?: string;
}

/**
 * A premium multi-select dropdown component for the Maidan design system.
 */
export function MultiSelect({
  options,
  selectedIds,
  onChange,
  placeholder = "اختر الفروع...",
  className,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOptions = options.filter((opt) => selectedIds.includes(opt.id));

  const toggleOption = (id: number) => {
    const newIds = selectedIds.includes(id)
      ? selectedIds.filter((item) => item !== id)
      : [...selectedIds, id];
    onChange(newIds);
  };

  const removeOption = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    onChange(selectedIds.filter((item) => item !== id));
  };

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "min-h-[44px] w-full px-4 py-2 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-2",
          "bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06] hover:border-white/[0.14]",
          isOpen && "border-primary/40 ring-2 ring-primary/20 bg-white/[0.06]"
        )}
      >
        <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
          {selectedOptions.length > 0 ? (
            selectedOptions.map((opt) => (
              <span
                key={opt.id}
                className="bg-primary/10 text-primary text-[11px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 border border-primary/20 animate-in fade-in zoom-in-95"
              >
                {opt.name}
                <X
                  className="w-3 h-3 cursor-pointer hover:text-primary/70 transition-colors"
                  onClick={(e) => removeOption(e, opt.id)}
                />
              </span>
            ))
          ) : (
            <span className="text-muted-foreground text-sm">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-300 shrink-0", isOpen && "rotate-180 text-primary")} />
      </div>

      {isOpen && (
        <div className="absolute z-[100] w-full mt-2 py-2 bg-[#1a1a1e] border border-white/10 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-top-2 duration-300 backdrop-blur-xl">
          <div className="max-h-[220px] overflow-y-auto px-2 space-y-0.5 custom-scrollbar">
            {options.map((opt) => {
              const isSelected = selectedIds.includes(opt.id);
              return (
                <div
                  key={opt.id}
                  onClick={() => toggleOption(opt.id)}
                  className={cn(
                    "flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all group",
                    isSelected 
                      ? "bg-primary/15 text-primary" 
                      : "hover:bg-white/5 text-foreground/70 hover:text-foreground"
                  )}
                >
                  <span className="text-sm font-medium">{opt.name}</span>
                  <div className={cn(
                    "w-5 h-5 rounded-md border flex items-center justify-center transition-all",
                    isSelected 
                      ? "bg-primary border-primary text-white" 
                      : "border-white/10 group-hover:border-white/20"
                  )}>
                    {isSelected && <Check className="w-3 h-3" />}
                  </div>
                </div>
              );
            })}
            {options.length === 0 && (
              <div className="px-3 py-8 text-center">
                <p className="text-xs text-muted-foreground">لا يوجد فروع مضافة</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
