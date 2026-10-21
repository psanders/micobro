/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
/** One peso in cents — every amount in the app is a whole number of these. */
export const PESO_CENTS = 100;

/**
 * The one rounding rule for money: the nearest whole peso, halves up.
 * Applied wherever an amount is computed so no centavos ever reach storage.
 */
export function roundToPeso(cents: number): number {
  return Math.round(cents / PESO_CENTS) * PESO_CENTS;
}

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * Parses a lender-typed peso amount into cents, or `null` when it isn't a
 * valid whole-peso amount. Thousands separators are accepted ("1,105",
 * "1.105", "1,105,000"); any decimal part ("1105.50", "1105,50") is
 * rejected — amounts are whole pesos, never rounded silently. A lone mark
 * followed by exactly three digits ("1,105") is a thousands separator,
 * otherwise it's a decimal mark. Works on the digit string, not floats.
 */
export function parseAmountToCents(text: string): number | null {
  const cleaned = text.replace(/RD\$|\s/g, "");
  if (cleaned === "") return null;

  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  let decimalIndex = Math.max(lastDot, lastComma);
  if (decimalIndex !== -1 && (lastDot === -1 || lastComma === -1)) {
    const mark = cleaned[decimalIndex]!;
    const isRepeated = cleaned.indexOf(mark) !== decimalIndex;
    const digitsAfter = cleaned.length - decimalIndex - 1;
    if (isRepeated || digitsAfter === 3) decimalIndex = -1;
  }

  const rawInt = decimalIndex === -1 ? cleaned : cleaned.slice(0, decimalIndex);
  const fracPart = decimalIndex === -1 ? "" : cleaned.slice(decimalIndex + 1);
  // Thousands separators only between proper 3-digit groups ("1,105", not "1.2.3").
  if (!/^\d*$/.test(rawInt) && !/^\d{1,3}([.,]\d{3})+$/.test(rawInt)) return null;
  if (fracPart !== "") return null;
  const intPart = rawInt.replace(/[.,]/g, "");
  if (intPart === "") return null;

  return Number(intPart) * PESO_CENTS;
}

/**
 * Whether `text` looks like an amount with centavos ("1105.50", "12,5") —
 * lets a form say "solo pesos enteros" instead of silently reading it as 0.
 */
export function hasCentavos(text: string): boolean {
  const cleaned = text.replace(/RD\$|\s/g, "");
  return /\d[.,]\d{1,2}$/.test(cleaned) && parseAmountToCents(cleaned) === null;
}

/** The Spanish message every amount input shows for a value with centavos. */
export const WHOLE_PESOS_ONLY_MESSAGE = "Solo pesos enteros, sin centavos.";

/** Whole-peso amount without the currency symbol ("1,105", "18,240"). */
export function formatAmount(cents: number): string {
  return fromCents(cents).toLocaleString("es-DO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

/** Whole-peso amount with the currency symbol, no decimals ("RD$18,240"). */
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(fromCents(cents));
}
