"use client";

import { forwardRef, SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Wrapper className – applies to the outer div */
  wrapperClassName?: string;
}

/**
 * Styled `<select>` wrapper that matches the Maidan design system.
 * Renders a full-width select with a custom chevron indicator and
 * consistent focus / hover states.
 */
const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, wrapperClassName, children, ...props }, ref) => {
    return (
      <div className={cn("relative group", wrapperClassName)}>
        <select
          ref={ref}
          className={cn(
            // Layout
            "w-full appearance-none cursor-pointer",
            // Spacing
            "px-4 py-2.5 pe-10",
            // Typography
            "text-sm font-medium",
            // Background & border
            "bg-white/[0.04] border border-white/[0.08]",
            // Shape
            "rounded-xl",
            // Colors
            "text-foreground",
            // Hover
            "hover:bg-white/[0.06] hover:border-white/[0.14]",
            // Focus
            "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 focus:bg-white/[0.06]",
            // Transition
            "transition-all duration-200",
            // Option colors (browser-native fallback)
            "[&>option]:bg-[hsl(var(--card))] [&>option]:text-foreground",
            className
          )}
          {...props}
        >
          {children}
        </select>

        {/* Custom chevron */}
        <ChevronDown
          className={cn(
            "pointer-events-none absolute top-1/2 -translate-y-1/2",
            "ltr:right-3 rtl:left-3",
            "w-4 h-4 text-muted-foreground",
            "group-focus-within:text-primary group-focus-within:rotate-180",
            "transition-all duration-200"
          )}
          aria-hidden="true"
        />
      </div>
    );
  }
);

Select.displayName = "Select";

export { Select };
