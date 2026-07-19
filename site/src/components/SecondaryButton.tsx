/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { clsx } from "clsx";
import type { ComponentProps, ElementType } from "react";

type SecondaryButtonProps<T extends ElementType = "button"> = {
  as?: T;
  children: React.ReactNode;
  className?: string;
} & Omit<ComponentProps<T>, "className" | "children">;

export function SecondaryButton<T extends ElementType = "button">({
  as,
  children,
  className,
  ...rest
}: SecondaryButtonProps<T>) {
  const Comp = as ?? "button";

  return (
    <Comp
      {...(Comp === "button" ? { type: "button" } : {})}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-full border-[1.5px] border-brand-ink px-7 py-[16px] text-[16px] font-bold text-brand-ink no-underline transition-colors hover:bg-brand-ink/5",
        className
      )}
      {...rest}
    >
      {children}
    </Comp>
  );
}
