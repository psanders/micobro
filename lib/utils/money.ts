/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP"
  }).format(fromCents(cents));
}
