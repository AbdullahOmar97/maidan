"use client";

import React, {
  useId,
  type ReactNode,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type SelectHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

/* ── FormField wrapper ─────────────────────────────────────────── */
interface FormFieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string | ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}

export function FormField({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
  className,
}: FormFieldProps) {
  const autoId = useId();
  const fieldId = htmlFor || autoId;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;

  // Describe by error if present, otherwise hint if present
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className={cn("space-y-2", className)}>
      <label
        htmlFor={fieldId}
        className="block text-xs font-bold text-muted-foreground/80 uppercase tracking-wider cursor-pointer"
      >
        {label}
        {required && (
          <span className="text-destructive ms-1" aria-hidden="true">
            *
          </span>
        )}
        {required && <span className="sr-only"> (مطلوب)</span>}
      </label>

      {/* Automatically attach id and aria attributes to single child if compatible */}
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<any>, {
            id: (children.props as any).id || fieldId,
            "aria-describedby":
              (children.props as any)["aria-describedby"] || describedBy,
            "aria-invalid": (children.props as any)["aria-invalid"] ?? Boolean(error),
            "aria-required": (children.props as any)["aria-required"] ?? required,
          })
        : children}

      {error && (
        <p id={errorId} role="alert" aria-live="polite" className="text-xs font-semibold text-destructive">
          {error}
        </p>
      )}
      {hint && !error && (
        <div id={hintId} className="text-[10px] font-bold text-muted-foreground/60">
          {hint}
        </div>
      )}
    </div>
  );
}

/* ── Input ─────────────────────────────────────────────────────── */
const inputBase =
  "w-full px-4 py-3 rounded-xl text-sm font-medium " +
  "bg-background/50 border border-border/80 " +
  "placeholder:text-muted-foreground/40 text-foreground " +
  "focus:outline-none focus:ring-4 focus:ring-primary/15 focus:border-primary focus:bg-background " +
  "hover:border-primary/30 " +
  "transition-all duration-300 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  className?: string;
  error?: boolean;
};

export function Input({ className, error, ...props }: InputProps) {
  return (
    <input
      aria-invalid={props["aria-invalid"] ?? Boolean(error)}
      className={cn(
        inputBase,
        error && "border-destructive/50 focus:border-destructive focus:ring-destructive/10",
        className
      )}
      {...props}
    />
  );
}

/* ── Textarea ──────────────────────────────────────────────────── */
export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  className?: string;
  error?: boolean;
};

export function Textarea({ className, error, ...props }: TextareaProps) {
  return (
    <textarea
      aria-invalid={props["aria-invalid"] ?? Boolean(error)}
      className={cn(
        inputBase,
        "resize-none leading-relaxed",
        error && "border-destructive/50 focus:border-destructive focus:ring-destructive/10",
        className
      )}
      {...props}
    />
  );
}

/* ── Select ────────────────────────────────────────────────────── */
export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  className?: string;
  error?: boolean;
};

export function Select({ className, error, ...props }: SelectProps) {
  return (
    <select
      aria-invalid={props["aria-invalid"] ?? Boolean(error)}
      className={cn(
        inputBase,
        error && "border-destructive/50 focus:border-destructive focus:ring-destructive/10",
        className
      )}
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
      <span className="shrink-0 mt-0.5" aria-hidden="true">⚠</span>
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
      {icon && <span className="shrink-0 mt-0.5 text-primary" aria-hidden="true">{icon}</span>}
      <span>{children}</span>
    </div>
  );
}
