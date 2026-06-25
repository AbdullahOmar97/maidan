import { LucideIcon, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children?: React.ReactNode;
  className?: string;
  animate?: boolean;
  backHref?: string;
  backLabel?: string;
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  children,
  className,
  animate = true,
  backHref,
  backLabel,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:gap-4 mb-6 sm:mb-8 md:mb-10",
        "md:flex-row md:items-center md:justify-between",
        animate && "page-enter",
        className
      )}
    >
      {/* Title block */}
      <div className="relative min-w-0 flex-1">
        {/* Subtle background glow */}
        <div
          className="absolute -start-10 -top-10 w-40 h-40 bg-primary/5 blur-[80px] rounded-full pointer-events-none -z-10"
          aria-hidden="true"
        />

        <div className="flex items-start gap-4">
          {backHref && (
            <Link
              href={backHref}
              className="touch-target w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-white transition-all active:scale-90 shadow-xl shrink-0 mt-1"
              aria-label={backLabel || "العودة"}
            >
              <ArrowRight className="w-5 h-5" aria-hidden="true" />
            </Link>
          )}

          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <h1 className="flex items-center gap-2 sm:gap-3 md:gap-5 text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tighter text-white leading-tight">
              {Icon && (
                <div className="relative shrink-0 group">
                  <div
                    className="absolute inset-0 bg-primary/20 blur-xl rounded-3xl group-hover:bg-primary/30 transition-colors"
                    aria-hidden="true"
                  />
                  <div className="relative w-9 h-9 sm:w-11 sm:h-11 md:w-14 md:h-14 rounded-[1rem] sm:rounded-[1.25rem] md:rounded-[1.5rem] gradient-brand flex items-center justify-center shadow-2xl shadow-primary/40 rotate-3 group-hover:rotate-6 transition-transform duration-300">
                    <Icon
                      className="w-4 h-4 sm:w-5 sm:h-5 md:w-7 md:h-7 text-white"
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
