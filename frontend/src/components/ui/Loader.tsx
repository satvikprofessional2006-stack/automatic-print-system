import React from "react";
import { cn } from "@/lib/utils";

interface LoaderProps {
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  text?: string;
  subtext?: string;
}

const sizeConfig = {
  xs: { size: "h-3.5 w-3.5", stroke: 2.8, dot: "h-1 w-1" },
  sm: { size: "h-5 w-5", stroke: 2.6, dot: "h-1.5 w-1.5" },
  md: { size: "h-7 w-7", stroke: 2.2, dot: "h-2 w-2" },
  lg: { size: "h-10 w-10", stroke: 2, dot: "h-2.5 w-2.5" },
  xl: { size: "h-14 w-14", stroke: 1.8, dot: "h-3.5 w-3.5" },
};

export const Loader: React.FC<LoaderProps> = ({
  className,
  size = "md",
  text,
  subtext,
}) => {
  const cfg = sizeConfig[size] || sizeConfig.md;

  return (
    <div className={cn("flex flex-col items-center justify-center gap-2", className)}>
      <div className={cn("relative flex items-center justify-center shrink-0", cfg.size)}>
        {/* Subtle glowing ambient backdrop */}
        <div className="absolute inset-0 rounded-full bg-primary/10 blur-xs pointer-events-none" />

        {/* Minimalist Circular SVG Loader */}
        <svg
          className="w-full h-full animate-spin text-primary"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Background track circle */}
          <circle
            cx="16"
            cy="16"
            r="13"
            stroke="currentColor"
            strokeWidth={cfg.stroke}
            className="opacity-15"
          />
          {/* Animated active spinning arc with smooth rounded cap */}
          <circle
            cx="16"
            cy="16"
            r="13"
            stroke="currentColor"
            strokeWidth={cfg.stroke}
            strokeDasharray="81.68"
            strokeDashoffset="54.45"
            strokeLinecap="round"
          />
        </svg>

        {/* Subtle minimalist breathing core dot */}
        <div
          className={cn(
            "absolute rounded-full bg-primary/80 animate-pulse pointer-events-none",
            cfg.dot
          )}
        />
      </div>

      {/* Optional minimalist text */}
      {text && (
        <span className="text-xs font-medium text-foreground tracking-tight select-none">
          {text}
        </span>
      )}
      {subtext && (
        <span className="text-[10px] font-mono text-muted-foreground select-none">
          {subtext}
        </span>
      )}
    </div>
  );
};

export default Loader;
