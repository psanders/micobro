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
 * Parses a lender-typed peso amount into cents, or `null` when it isn't a
 * valid amount. Accepts either `.` or `,` as the decimal mark ("1105.50",
 * "1105,50") plus thousands separators ("1,105.50", "1.105,50"): when both
 * marks appear the last one is the decimal; a lone mark followed by exactly
 * three digits ("1,105") is a thousands separator, otherwise it's decimal.
 * Works on the digit string, not floats, so cents are exact.
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
  if (!/^\d{0,2}$/.test(fracPart)) return null;
  const intPart = rawInt.replace(/[.,]/g, "");
  if (intPart === "" && fracPart === "") return null;

  return Number(intPart || "0") * 100 + Number(fracPart.padEnd(2, "0"));
}

/** Peso amount without the currency symbol, keeping cents only when present ("1,105.50", "18,240"). */
export function formatAmount(cents: number): string {
  const hasCents = cents % 100 !== 0;
  return fromCents(cents).toLocaleString("es-DO", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0
  });
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
