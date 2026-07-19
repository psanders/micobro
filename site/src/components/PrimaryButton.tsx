/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { Download } from "lucide-react";
import { clsx } from "clsx";
import type { ComponentProps, ElementType } from "react";

type PrimaryButtonProps<T extends ElementType = "button"> = {
  as?: T;
  children: React.ReactNode;
  className?: string;
  size?: "default" | "nav";
} & Omit<ComponentProps<T>, "className" | "children">;

export function PrimaryButton<T extends ElementType = "button">({
  as,
  children,
  className,
  size = "default",
  ...rest
}: PrimaryButtonProps<T>) {
  const Comp = as ?? "button";

  return (
    <Comp
      {...(Comp === "button" ? { type: "button" } : {})}
      className={clsx(
        "inline-flex items-center justify-center gap-2.5 rounded-full bg-brand-blue-deep font-bold text-white no-underline transition-colors duration-200 hover:bg-[#0a4640] active:bg-[#083733]",
        size === "nav" ? "px-5 py-3 text-[14px]" : "px-7 py-[17px] text-[16px]",
        className
      )}
      {...rest}
    >
      <Download className={size === "nav" ? "h-4 w-4" : "h-[18px] w-[18px]"} strokeWidth={2} />
      {children}
    </Comp>
  );
}
