"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
  ariaLabel?: string;
  ariaLabelledBy?: string;
}

export function Modal({
  open,
  onClose,
  size = "lg",
  disableBackdropClose = false,
  children,
  className,
  ariaLabel,
  ariaLabelledBy,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  /* Save trigger element and restore focus on unmount/close */
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement | null;
    } else if (triggerRef.current) {
      triggerRef.current.focus?.();
    }
  }, [open]);

  /* Close on Escape and handle Tab trapping */
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab" && panelRef.current) {
        const focusableElements = panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  /* Focus first element on open */
  useEffect(() => {
    if (!open || !panelRef.current) return;
    const timer = setTimeout(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      focusable?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [open]);

  /* Prevent body scroll while open */
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
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
          "max-h-[88vh] sm:max-h-[90vh]",
          SIZE[size],
          // Dark-mode card style with glowing border
          "bg-card/95 backdrop-blur-2xl border border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.3)]",
          "rounded-2xl sm:rounded-[2rem] overflow-hidden",
          // Entry animation
          "animate-in fade-in zoom-in-95 duration-300 ease-out",
          className
        )}
      >
        {/* Top accent line */}
        <div className="absolute top-0 inset-x-0 h-[3px] gradient-brand opacity-80" aria-hidden="true" />
        
        {children}
      </div>
    </div>,
    document.body
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
  id?: string;
}

export function ModalHeader({ icon, iconColor, title, subtitle, onClose, id }: ModalHeaderProps) {
  return (
    <div className="shrink-0 flex items-center justify-between gap-4 px-5 sm:px-8 pt-6 sm:pt-8 pb-4 sm:pb-5 border-b border-white/[0.05] bg-white/[0.01]">
      <div className="flex items-center gap-3.5 min-w-0">
        {icon && (
          <div
            className={cn(
              "shrink-0 w-10 sm:w-11 h-10 sm:h-11 rounded-2xl flex items-center justify-center shadow-lg transition-transform hover:scale-105",
              iconColor ?? "gradient-brand text-white shadow-primary/15"
            )}
            aria-hidden="true"
          >
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h2 id={id} className="text-base sm:text-lg font-black leading-tight tracking-tight text-white">{title}</h2>
          {subtitle && (
            <p className="text-xs font-semibold text-muted-foreground mt-1 truncate">{subtitle}</p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="إغلاق النافذة"
        className="shrink-0 touch-target w-11 h-11 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-white/5 hover:text-white transition-all active:scale-90 border border-transparent hover:border-white/[0.05]"
      >
        <X className="w-5 h-5 pointer-events-none" aria-hidden="true" />
      </button>
    </div>
  );
}

/* ── Body ──────────────────────────────────────────────────────── */
interface ModalBodyProps {
  children: ReactNode;
  className?: string;
  dir?: "rtl" | "ltr" | "auto";
}

export function ModalBody({ children, className, dir }: ModalBodyProps) {
  return (
    <div dir={dir} className={cn("flex-1 overflow-y-auto custom-scrollbar px-5 sm:px-8 pt-5 sm:pt-6 pb-6 sm:pb-8", className)}>
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
        "px-5 sm:px-8 py-4 sm:py-6 pb-6 sm:pb-8 border-t border-white/[0.05] bg-white/[0.01]",
        className
      )}
    >
      {children}
    </div>
  );
}
