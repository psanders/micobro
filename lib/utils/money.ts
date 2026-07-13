/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * Whole-peso amounts render without decimals ("RD$18,240", matching the
 * product designs); fractional amounts keep their cents.
 */
export function formatCurrency(cents: number): string {
  const hasCents = cents % 100 !== 0;
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0
  }).format(fromCents(cents));
}
