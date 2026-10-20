/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { parseAmountToCents, formatAmount } from "../lib/utils/money";

describe("parseAmountToCents", () => {
  it.each([
    ["1105.50", 110550],
    ["1105,50", 110550],
    ["1,105.50", 110550],
    ["1.105,50", 110550],
    ["1105.5", 110550],
    ["1105,5", 110550],
    ["1105", 110500],
    ["1106", 110600],
    ["110550", 11055000],
    ["1,105", 110500],
    ["1.105", 110500],
    ["1,000,000", 100000000],
    ["1.000.000,25", 100000025],
    ["0.50", 50],
    [".50", 50],
    ["1105.", 110500],
    [" RD$ 1,105.50 ", 110550],
    ["0", 0]
  ])("parses %p as %p cents", (text, cents) => {
    expect(parseAmountToCents(text)).toBe(cents);
  });

  it.each(["", "   ", "abc", "12a", "1105.505", "-5", ".", "1.2.3,4.5"])("rejects %p", (text) => {
    expect(parseAmountToCents(text)).toBeNull();
  });

  it("keeps cents exact where float math would drift", () => {
    expect(parseAmountToCents("0.29")).toBe(29);
    expect(parseAmountToCents("1105.55")).toBe(110555);
  });
});

describe("formatAmount", () => {
  it("keeps both cent digits when the amount has cents", () => {
    expect(formatAmount(110550)).toBe("1,105.50");
  });

  it("drops decimals for whole-peso amounts", () => {
    expect(formatAmount(1824000)).toBe("18,240");
  });
});
