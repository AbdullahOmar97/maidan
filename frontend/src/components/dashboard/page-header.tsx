import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children?: React.ReactNode;
  className?: string;
  animate?: boolean;
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  children,
  className,
  animate = true,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 mb-8 md:mb-10",
        // On md+ screens lay title and actions side by side
        "md:flex-row md:items-center md:justify-between",
        animate && "page-enter",
        className
      )}
    >
      {/* Title block */}
      <div className="relative min-w-0">
        {/* Subtle background glow */}
        <div
          className="absolute -start-10 -top-10 w-40 h-40 bg-primary/5 blur-[80px] rounded-full pointer-events-none -z-10"
          aria-hidden="true"
        />

        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-3 md:gap-5 text-2xl sm:text-3xl md:text-4xl font-black tracking-tighter text-white leading-tight">
            {Icon && (
              <div className="relative shrink-0 group">
                <div
                  className="absolute inset-0 bg-primary/20 blur-xl rounded-3xl group-hover:bg-primary/30 transition-colors"
                  aria-hidden="true"
                />
                <div className="relative w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-[1.25rem] md:rounded-[1.5rem] gradient-brand flex items-center justify-center shadow-2xl shadow-primary/40 rotate-3 group-hover:rotate-6 transition-transform duration-500">
                  <Icon
                    className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-white"
                    aria-hidden="true"
                  />
                </div>
              </div>
            )}
            <span className="text-gradient truncate">{title}</span>
          </h1>

          {description && (
            <p className="text-muted-foreground text-sm md:text-base font-bold mt-2 max-w-2xl leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Actions slot */}
      {children && (
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
          {children}
        </div>
      )}
    </div>
  );
}
