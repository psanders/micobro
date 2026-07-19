/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { clsx } from "clsx";

interface LogoProps {
  /** Footer variant: white mark on dark background */
  inverted?: boolean;
  compact?: boolean;
  className?: string;
}

export function Logo({ inverted = false, compact = false, className }: LogoProps) {
  const markSize = compact ? "h-8 w-8" : "h-10 w-10";
  const markRadius = compact ? "rounded-[9px]" : "rounded-[11px]";
  const mSize = compact ? "text-lg" : "text-xl";
  const wordSize = compact ? "text-lg" : "text-xl";

  return (
    <div className={clsx("flex items-center gap-2.5", className)}>
      <div
        className={clsx(
          markSize,
          markRadius,
          "flex items-center justify-center",
          inverted ? "bg-white" : "bg-brand-blue-deep"
        )}
      >
        <span
          className={clsx(
            mSize,
            "-translate-y-[0.125em] rotate-[0.27deg] font-bold leading-none",
            inverted ? "text-brand-blue-deep" : "text-white"
          )}
        >
          m
        </span>
      </div>
      <span
        className={clsx(
          wordSize,
          "font-bold tracking-tight",
          inverted ? "text-white" : "text-brand-blue-deep"
        )}
        style={{ fontFamily: "var(--font-logo)" }}
      >
        micobro
      </span>
    </div>
  );
}
