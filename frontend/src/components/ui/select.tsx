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
            "px-4 py-3 pe-10",
            // Typography
            "text-sm font-medium",
            // Background & border
            "bg-background/50 border border-border/80",
            // Shape
            "rounded-xl",
            // Colors
            "text-foreground",
            // Hover
            "hover:border-primary/30",
            // Focus
            "focus:outline-none focus:ring-4 focus:ring-primary/15 focus:border-primary focus:bg-background",
            // Transition
            "transition-all duration-300",
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
            "end-3",
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
