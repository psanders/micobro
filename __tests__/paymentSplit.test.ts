/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: collect-payment "Application breakdown" — mora is covered first,
 * the remainder applies to the cuota.
 */
import { computePaymentSplit } from "../lib/payments/paymentSplit";

describe("computePaymentSplit", () => {
  it("applies mora first, then the cuota", () => {
    const split = computePaymentSplit({
      amountCents: 315000,
      expectedCuotaCents: 240000,
      accruedMoraCents: 75000
    });
    expect(split.moraPortionCents).toBe(75000);
    expect(split.installmentPortionCents).toBe(240000);
    expect(split.installmentStatus).toBe("completed");
  });

  it("marks the cuota partial when the remainder does not cover it", () => {
    const split = computePaymentSplit({
      amountCents: 100000,
      expectedCuotaCents: 240000,
      accruedMoraCents: 75000
    });
    expect(split.moraPortionCents).toBe(75000);
    expect(split.installmentPortionCents).toBe(25000);
    expect(split.installmentStatus).toBe("partial");
  });

  it("late_fee kind sends everything to mora", () => {
    const split = computePaymentSplit({
      amountCents: 75000,
      expectedCuotaCents: 240000,
      accruedMoraCents: 75000,
      kind: "late_fee"
    });
    expect(split.moraPortionCents).toBe(75000);
    expect(split.installmentPortionCents).toBe(0);
    expect(split.installmentStatus).toBe("completed");
  });

  it("no mora means the whole amount is cuota", () => {
    const split = computePaymentSplit({
      amountCents: 240000,
      expectedCuotaCents: 240000,
      accruedMoraCents: 0
    });
    expect(split.moraPortionCents).toBe(0);
    expect(split.installmentPortionCents).toBe(240000);
  });
});
