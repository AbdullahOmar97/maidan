"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Size map ──────────────────────────────────────────────────── */
const SIZE = {
  sm:  "max-w-md",
  md:  "max-w-lg",
  lg:  "max-w-2xl",
  xl:  "max-w-3xl",
  "2xl": "max-w-4xl",
} as const;

export type ModalSize = keyof typeof SIZE;

/* ── Root ──────────────────────────────────────────────────────── */
interface ModalProps {
  open: boolean;
  onClose: () => void;
  size?: ModalSize;
  /** Prevent closing on backdrop click */
  disableBackdropClose?: boolean;
  children: ReactNode;
  className?: string;
}

export function Modal({
  open,
  onClose,
  size = "lg",
  disableBackdropClose = false,
  children,
  className,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  /* Close on Escape */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  /* Prevent body scroll while open */
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={disableBackdropClose ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          "relative w-full flex flex-col",
          "max-h-[85vh] sm:max-h-[90vh]",
          SIZE[size],
          // Glass card style unified
          "bg-card border border-border/60",
          "rounded-2xl shadow-2xl",
          // Entry animation
          "animate-in fade-in zoom-in-95 duration-200",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}

/* ── Header ────────────────────────────────────────────────────── */
interface ModalHeaderProps {
  /** Icon element rendered in the tinted circle */
  icon?: ReactNode;
  /** Icon background colour — defaults to primary tint */
  iconColor?: string;
  title: string;
  subtitle?: string;
  onClose: () => void;
}

export function ModalHeader({ icon, iconColor, title, subtitle, onClose }: ModalHeaderProps) {
  return (
    <div className="shrink-0 flex items-center justify-between gap-4 px-6 py-5 border-b border-border/50 bg-secondary/20 rounded-t-2xl">
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div
            className={cn(
              "shrink-0 w-10 h-10 rounded-xl flex items-center justify-center",
              iconColor ?? "bg-primary/10 text-primary"
            )}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-base font-bold leading-tight truncate">{title}</h2>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="إغلاق"
        className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

/* ── Body ──────────────────────────────────────────────────────── */
interface ModalBodyProps {
  children: ReactNode;
  className?: string;
}

export function ModalBody({ children, className }: ModalBodyProps) {
  return (
    <div className={cn("flex-1 overflow-y-auto custom-scrollbar px-6 pt-5 pb-8", className)}>
      {children}
    </div>
  );
}

/* ── Footer ────────────────────────────────────────────────────── */
interface ModalFooterProps {
  children: ReactNode;
  className?: string;
}

export function ModalFooter({ children, className }: ModalFooterProps) {
  return (
    <div
      className={cn(
        "shrink-0 flex items-center justify-end gap-3",
        "px-6 py-4 pb-safe border-t border-border/50 bg-secondary/10 rounded-b-2xl",
        className
      )}
    >
      {children}
    </div>
  );
}
