/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: whole-peso-amounts "Entered amounts are whole pesos" and "Amounts
 * display without decimals".
 */
import {
  formatAmount,
  formatCurrency,
  hasCentavos,
  parseAmountToCents,
  roundToPeso
} from "../lib/utils/money";

describe("parseAmountToCents", () => {
  it.each([
    ["1105", 110500],
    ["1106", 110600],
    ["110550", 11055000],
    ["1,105", 110500],
    ["1.105", 110500],
    ["1,000,000", 100000000],
    ["1.000.000", 100000000],
    ["1105.", 110500],
    [" RD$ 1,105 ", 110500],
    ["RD$1,105", 110500],
    ["0", 0]
  ])("parses %p as %p cents", (text, cents) => {
    expect(parseAmountToCents(text)).toBe(cents);
  });

  it.each([
    "",
    "   ",
    "abc",
    "12a",
    "-5",
    ".",
    "1.2.3,4.5",
    // Amounts with centavos are rejected, never rounded silently.
    "1105.50",
    "1105,50",
    "1,105.50",
    "1.105,50",
    "1105.5",
    "0.50",
    ".50",
    "1105.505"
  ])("rejects %p", (text) => {
    expect(parseAmountToCents(text)).toBeNull();
  });
});

describe("hasCentavos", () => {
  it.each(["1105.50", "1105,50", "1,105.50", "12.5", " RD$ 0.50 "])("flags %p", (text) => {
    expect(hasCentavos(text)).toBe(true);
  });

  it.each(["", "1105", "1,105", "1.105", "1,000,000", "abc", "1105."])(
    "does not flag %p",
    (text) => {
      expect(hasCentavos(text)).toBe(false);
    }
  );
});

describe("roundToPeso", () => {
  it("rounds to the nearest peso, halves up", () => {
    expect(roundToPeso(12549)).toBe(12500);
    expect(roundToPeso(12550)).toBe(12600);
    expect(roundToPeso(12501)).toBe(12500);
    expect(roundToPeso(0)).toBe(0);
  });

  it("leaves whole pesos alone", () => {
    expect(roundToPeso(110500)).toBe(110500);
  });
});

describe("formatAmount / formatCurrency", () => {
  it("never shows decimals", () => {
    expect(formatAmount(1824000)).toBe("18,240");
    expect(formatCurrency(1824000)).toMatch(/18,240$/);
    expect(formatAmount(110500)).not.toMatch(/[.,]\d{2}$/);
  });
});
