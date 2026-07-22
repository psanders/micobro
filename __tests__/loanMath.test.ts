/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Flat add-on interest — golden values worked by hand against mikro's
 * `calculateLoanOptions` core (principal × rate, cuota rounded up to
 * CUOTA_ROUNDING_CENTS). See lib/loans/loanMath.ts.
 */
import {
  CUOTA_ROUNDING_CENTS,
  cuotaCents,
  lastCuotaCents,
  loanCostSummary,
  totalInterestCents,
  totalRepayCents
} from "../lib/loans/loanMath";

describe("loanMath", () => {
  it("CUOTA_ROUNDING_CENTS is 50 pesos", () => {
    expect(CUOTA_ROUNDING_CENTS).toBe(5000);
  });

  describe("totalInterestCents", () => {
    it("computes flat interest as principal × rate (bps / 10000)", () => {
      // 1,000,000 cents @ 2000 bps (20%) = 200,000 cents interest.
      expect(totalInterestCents(1000000, 2000)).toBe(200000);
    });

    it("rounds to the nearest cent", () => {
      // 100,033 * 733 / 10000 = 7,332.4189 → 7332.
      expect(totalInterestCents(100033, 733)).toBe(7332);
    });

    it("is zero for a zero rate", () => {
      expect(totalInterestCents(500000, 0)).toBe(0);
    });
  });

  describe("totalRepayCents", () => {
    it("is principal + totalInterestCents", () => {
      // 1,000,000 principal + 200,000 interest = 1,200,000 total repay.
      expect(totalRepayCents(1000000, 2000)).toBe(1200000);
    });

    it("equals principal when the rate is zero", () => {
      expect(totalRepayCents(500000, 0)).toBe(500000);
    });
  });

  describe("cuotaCents", () => {
    it("worked example: principal 1,000,000 cents, 2000 bps, 12 cuotas", () => {
      // totalInterest = 200,000; totalRepay = 1,200,000; raw cuota = 100,000
      // — already a multiple of 5,000, so rounding is a no-op.
      expect(totalInterestCents(1000000, 2000)).toBe(200000);
      expect(totalRepayCents(1000000, 2000)).toBe(1200000);
      expect(cuotaCents(1000000, 2000, 12)).toBe(100000);
    });

    it("rounds a fractional cuota up to the next 50 pesos", () => {
      // totalInterest = round(1,000,000 * 2050 / 10000) = 205,000.
      // totalRepay = 1,205,000; raw cuota = 100,416.67 → rounds up to 105,000.
      expect(totalInterestCents(1000000, 2050)).toBe(205000);
      expect(cuotaCents(1000000, 2050, 12)).toBe(105000);
    });

    it("matches the mock exemplar loan (José Núñez: 2,880,000 @ 1200 bps / 12)", () => {
      // totalInterest = 345,600; totalRepay = 3,225,600; raw cuota = 268,800
      // → rounds up to 270,000.
      expect(cuotaCents(2880000, 1200, 12)).toBe(270000);
    });

    it("rounding can dominate on a small loan (see lib/loans/mora.ts test fixtures)", () => {
      // 120,000 @ 1000 bps / 12: raw cuota is 11,000 but rounds up to 15,000 —
      // the 50-peso increment is large relative to this loan's size.
      expect(cuotaCents(120000, 1000, 12)).toBe(15000);
    });

    it("returns the bare principal-per-term cuota when the rate is zero", () => {
      expect(cuotaCents(1000000, 0, 12)).toBe(85000); // ceil(83,333.3 / 5000) * 5000
    });
  });

  describe("lastCuotaCents", () => {
    it("absorbs the rounding remainder — issue #59 (8,000 @ 2750 bps / 30 daily)", () => {
      // totalRepay = 1,020,000; raw cuota = 34,000 → rounds up to 35,000.
      // 29 cuotas of 35,000 = 1,015,000, so the last cuota shrinks to 5,000.
      expect(cuotaCents(800000, 2750, 30)).toBe(35000);
      expect(lastCuotaCents(800000, 2750, 30)).toBe(5000);
    });

    it("equals cuotaCents when the rounded cuotas divide the repay amount", () => {
      // 1,000,000 @ 2000 bps / 12: cuota 100,000 divides 1,200,000 evenly.
      expect(lastCuotaCents(1000000, 2000, 12)).toBe(100000);
    });

    it("never goes below zero when rounding overshoots the whole repay amount", () => {
      // 120,000 @ 1000 bps / 12: cuota 15,000, but 11 × 15,000 = 165,000 already
      // exceeds the 132,000 repay, so the nominal last cuota clamps at zero.
      expect(lastCuotaCents(120000, 1000, 12)).toBe(0);
    });

    it("invariant: (termCount − 1) cuotas + last cuota reconcile to totalRepayCents", () => {
      // The exact guarantee issue #59 was worried about: the schedule never
      // collects more or less than principal + flat interest.
      const cases: Array<[number, number, number]> = [
        [800000, 2750, 30],
        [1000000, 2050, 12],
        [2880000, 1200, 12]
      ];
      for (const [principal, rate, term] of cases) {
        const scheduled =
          cuotaCents(principal, rate, term) * (term - 1) + lastCuotaCents(principal, rate, term);
        expect(scheduled).toBe(totalRepayCents(principal, rate));
      }
    });
  });

  describe("loanCostSummary", () => {
    it("aggregates principal, interest, repay, and cuota for one loan", () => {
      const summary = loanCostSummary({
        principalCents: 1000000,
        interestRateBps: 2000,
        termCount: 12
      });

      expect(summary).toEqual({
        principalCents: 1000000,
        totalInterestCents: 200000,
        totalRepayCents: 1200000,
        cuotaCents: 100000,
        lastCuotaCents: 100000
      });
    });
  });
});
