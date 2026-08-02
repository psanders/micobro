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
    expect(split.advancePortionCents).toBe(0);
  });

  describe("advancePortionCents (issue #80 — over-cuota receipt split)", () => {
    it("caps the installment portion at one cuota and breaks the rest out as an advance", () => {
      const split = computePaymentSplit({
        amountCents: 250000, // $2,500
        expectedCuotaCents: 200000, // $2,000
        accruedMoraCents: 0
      });
      expect(split.moraPortionCents).toBe(0);
      expect(split.installmentPortionCents).toBe(200000);
      expect(split.advancePortionCents).toBe(50000); // $500
      expect(split.installmentStatus).toBe("completed");
    });

    it("caps the installment portion after mora is covered first", () => {
      const split = computePaymentSplit({
        amountCents: 300000,
        expectedCuotaCents: 200000,
        accruedMoraCents: 50000
      });
      expect(split.moraPortionCents).toBe(50000);
      expect(split.installmentPortionCents).toBe(200000);
      expect(split.advancePortionCents).toBe(50000);
    });

    it("does not cap or produce an advance when the payment exactly matches the cuota", () => {
      const split = computePaymentSplit({
        amountCents: 200000,
        expectedCuotaCents: 200000,
        accruedMoraCents: 0
      });
      expect(split.installmentPortionCents).toBe(200000);
      expect(split.advancePortionCents).toBe(0);
      expect(split.installmentStatus).toBe("completed");
    });

    it("does not produce an advance for a partial (under-cuota) payment", () => {
      const split = computePaymentSplit({
        amountCents: 150000,
        expectedCuotaCents: 200000,
        accruedMoraCents: 0
      });
      expect(split.installmentPortionCents).toBe(150000);
      expect(split.advancePortionCents).toBe(0);
      expect(split.installmentStatus).toBe("partial");
    });

    it("puts an advance spanning more than one future cuota into a single advancePortionCents figure", () => {
      const split = computePaymentSplit({
        amountCents: 450000, // 2.25x the cuota
        expectedCuotaCents: 200000,
        accruedMoraCents: 0
      });
      expect(split.installmentPortionCents).toBe(200000);
      expect(split.advancePortionCents).toBe(250000);
    });

    it("late_fee kind never produces an advance, regardless of amount vs. cuota", () => {
      const split = computePaymentSplit({
        amountCents: 500000,
        expectedCuotaCents: 200000,
        accruedMoraCents: 500000,
        kind: "late_fee"
      });
      expect(split.moraPortionCents).toBe(500000);
      expect(split.installmentPortionCents).toBe(0);
      expect(split.advancePortionCents).toBe(0);
    });
  });
});
