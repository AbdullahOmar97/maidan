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
    <div className={cn(
      "flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-10",
      animate && "page-enter",
      className
    )}>
      <div className="relative">
        {/* Subtle background glow for the header area */}
        <div className="absolute -left-10 -top-10 w-40 h-40 bg-primary/5 blur-[80px] rounded-full pointer-events-none -z-10" />
        
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-white flex items-center gap-5">
            {Icon && (
              <div className="relative shrink-0 group">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-3xl group-hover:bg-primary/30 transition-colors" />
                <div className="relative w-14 h-14 md:w-16 md:h-16 rounded-[1.5rem] gradient-brand flex items-center justify-center shadow-2xl shadow-primary/40 rotate-3 group-hover:rotate-6 transition-transform duration-500">
                  <Icon className="w-7 h-7 md:w-8 md:h-8 text-white" />
                </div>
              </div>
            )}
            <span className="text-gradient">{title}</span>
          </h1>
          
          {description && (
            <p className="text-muted-foreground text-sm md:text-base font-bold mt-3 max-w-2xl leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>

      {children && (
        <div className="flex flex-wrap items-center gap-4 shrink-0">
          {children}
        </div>
      )}
    </div>
  );
}
