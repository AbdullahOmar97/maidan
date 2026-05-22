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
        className="absolute inset-0 bg-black/75 backdrop-blur-[6px] transition-all duration-300"
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
          // Beautiful dark-mode premium card style with glowing border
          "bg-card/95 backdrop-blur-2xl border border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.3)]",
          "rounded-[2rem] overflow-hidden",
          // Entry animation
          "animate-in fade-in zoom-in-95 duration-300 ease-out",
          className
        )}
      >
        {/* Top accent line */}
        <div className="absolute top-0 inset-x-0 h-[3px] gradient-brand opacity-80" />
        
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
    <div className="shrink-0 flex items-center justify-between gap-4 px-6 pt-6 pb-5 border-b border-white/[0.05] bg-white/[0.01]">
      <div className="flex items-center gap-3.5 min-w-0">
        {icon && (
          <div
            className={cn(
              "shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg transition-transform hover:scale-105",
              iconColor ?? "gradient-brand text-white shadow-primary/15"
            )}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-lg font-black leading-tight tracking-tight text-white">{title}</h2>
          {subtitle && (
            <p className="text-xs font-semibold text-muted-foreground mt-1 truncate">{subtitle}</p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="إغلاق"
        className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-white/5 hover:text-white transition-all active:scale-90 border border-transparent hover:border-white/[0.05]"
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
    <div className={cn("flex-1 overflow-y-auto custom-scrollbar px-6 pt-6 pb-8", className)}>
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
        "px-6 py-5 pb-safe border-t border-white/[0.05] bg-white/[0.01]",
        className
      )}
    >
      {children}
    </div>
  );
}
