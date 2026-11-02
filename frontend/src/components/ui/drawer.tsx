"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Optional title shown in the drawer header */
  title?: string;
  /** Additional class names for the panel */
  className?: string;
}

/**
 * RTL-friendly slide-in drawer from the right.
 * Pure React + CSS — no external dependencies.
 * Manages focus trap and Escape key dismissal.
 */
export function Drawer({ open, onClose, children, title, className }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Focus first focusable element when opened
  useEffect(() => {
    if (open && panelRef.current) {
      const focusable = panelRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusable?.focus();
    }
  }, [open]);

  if (!open) return null;

  const content = (
    <>
      {/* Backdrop */}
      <div
        className="drawer-overlay"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? "القائمة"}
        className={cn("drawer-panel", className)}
      >
        {/* Drawer header with close button */}
        <div className="flex items-center justify-between px-5 min-h-[calc(4.5rem+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)] shrink-0 border-b border-white/[0.05]">
          {title && (
            <span className="text-sm font-black text-muted-foreground uppercase tracking-widest">
              {title}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="me-auto touch-manipulation w-11 h-11 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/20 active:opacity-75 flex items-center justify-center text-muted-foreground hover:text-white transition-colors cursor-pointer select-none"
            aria-label="إغلاق القائمة"
          >
            <X className="w-5 h-5 pointer-events-none" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pb-[env(safe-area-inset-bottom,0px)]">
          {children}
        </div>
      </div>
    </>
  );

  // Portal to document.body to avoid stacking context issues
  if (typeof document !== "undefined") {
    return createPortal(content, document.body);
  }
  return null;
}
