import React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface InputWrapperProps {
  label: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}

export const InputWrapper = ({ label, icon: Icon, children, className }: InputWrapperProps) => (
  <div className={cn("space-y-2 group", className)}>
    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ms-1 flex items-center gap-2 group-focus-within:text-primary transition-colors">
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </label>
    <div className="relative">
      {children}
    </div>
  </div>
);
