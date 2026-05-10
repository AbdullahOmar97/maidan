"use client";

import { type ReactNode, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/* ── FormField wrapper ─────────────────────────────────────────── */
interface FormFieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  className?: string;
}

export function FormField({ label, required, hint, children, className }: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {label}
        {required && <span className="text-destructive me-1">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

/* ── Input ─────────────────────────────────────────────────────── */
const inputBase =
  "w-full px-4 py-2.5 rounded-xl text-sm font-medium " +
  "bg-secondary/40 border border-border " +
  "placeholder:text-muted-foreground/50 text-foreground " +
  "focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/50 " +
  "hover:border-border/80 " +
  "transition-all duration-200 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  className?: string;
};

export function Input({ className, ...props }: InputProps) {
  return <input className={cn(inputBase, className)} {...props} />;
}

/* ── Textarea ──────────────────────────────────────────────────── */
export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  className?: string;
};

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(inputBase, "resize-none leading-relaxed", className)}
      {...props}
    />
  );
}

/* ── ErrorBanner ───────────────────────────────────────────────── */
interface ErrorBannerProps {
  message?: string | null;
  className?: string;
}

export function ErrorBanner({ message, className }: ErrorBannerProps) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2.5 px-4 py-3 rounded-xl",
        "bg-destructive/10 border border-destructive/20 text-destructive text-sm",
        "animate-in slide-in-from-top-2 duration-200",
        className
      )}
    >
      <span className="shrink-0 mt-0.5">⚠</span>
      <span>{message}</span>
    </div>
  );
}

/* ── InfoBanner ────────────────────────────────────────────────── */
interface InfoBannerProps {
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function InfoBanner({ icon, children, className }: InfoBannerProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3 rounded-xl",
        "bg-primary/5 border border-primary/10 text-muted-foreground text-xs leading-relaxed",
        className
      )}
    >
      {icon && <span className="shrink-0 mt-0.5 text-primary">{icon}</span>}
      <span>{children}</span>
    </div>
  );
}
