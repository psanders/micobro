/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { Sparkles } from "lucide-react";
import { clsx } from "clsx";

interface CreativeMarkProps {
  className?: string;
}

/**
 * The decorated "creative" badge treatment of the flat m-mark — gradient tile,
 * soft glow, floating accent dots, sparkle, and a ring outline. Sized via the
 * className width (aspect-square); all children are positioned in percentages
 * of that box so it scales cleanly at any breakpoint.
 */
export function CreativeMark({ className }: CreativeMarkProps) {
  return (
    <div className={clsx("relative aspect-square", className)}>
      <div
        className="absolute rounded-full border-[3px] border-brand-orange-primary-2"
        style={{ left: "7.62%", top: "7.62%", width: "84.76%", height: "84.76%" }}
      />

      <div
        className="absolute flex items-center justify-center overflow-hidden rounded-[15%] shadow-[0_20px_45px_-5px_#0B4F4A66]"
        style={{
          left: "19.05%",
          top: "19.05%",
          width: "61.9%",
          height: "61.9%",
          background: "linear-gradient(-45deg, #34C9A6 0%, #0B4F4A 100%)"
        }}
      >
        <div
          className="absolute rounded-full bg-white/22 blur-xl"
          style={{ left: "15.4%", top: "12.3%", width: "55.4%", height: "35.4%" }}
        />
        <span
          className="rotate-[0.27deg] font-bold leading-none text-white"
          style={{ fontFamily: "var(--font-logo)", fontSize: "38%" }}
        >
          m
        </span>
      </div>

      <div
        className="absolute rounded-full bg-brand-orange-deep-2"
        style={{ left: "84.76%", top: "30.48%", width: "9.52%", height: "9.52%" }}
      />
      <div
        className="absolute rounded-full bg-brand-yellow-accent-2"
        style={{ left: "21.9%", top: "80.95%", width: "7.62%", height: "7.62%" }}
      />
      <div
        className="absolute rounded-full bg-brand-blue-sky"
        style={{ left: "7.14%", top: "32.86%", width: "5.71%", height: "5.71%" }}
      />
      <Sparkles
        className="absolute fill-brand-yellow-accent-2 text-brand-yellow-accent-2"
        style={{ left: "71.43%", top: "-1.9%", width: "21.9%", height: "21.9%" }}
      />
      <div
        className="absolute rounded-[18%] bg-brand-orange-primary-2 opacity-90"
        style={{ left: "2.38%", top: "66.67%", width: "6.67%", height: "6.67%", rotate: "18deg" }}
      />
    </div>
  );
}
