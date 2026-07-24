/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Flat add-on interest — golden values worked by hand against mikro's
 * `calculateLoanOptions` core (principal × rate, cuota rounded to the
 * nearest whole peso). See lib/loans/loanMath.ts.
 */
import {
  PESO_CENTS,
  cuotaCents,
  lastCuotaCents,
  loanCostSummary,
  totalInterestCents,
  totalRepayCents
} from "../lib/loans/loanMath";

describe("loanMath", () => {
  it("PESO_CENTS is one peso", () => {
    expect(PESO_CENTS).toBe(100);
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
      // — already a whole-peso amount, so rounding is a no-op.
      expect(totalInterestCents(1000000, 2000)).toBe(200000);
      expect(totalRepayCents(1000000, 2000)).toBe(1200000);
      expect(cuotaCents(1000000, 2000, 12)).toBe(100000);
    });

    it("rounds a fractional cuota to the nearest whole peso", () => {
      // totalInterest = round(1,000,000 * 2050 / 10000) = 205,000.
      // totalRepay = 1,205,000; raw cuota = 100,416.67 → rounds to 100,400.
      expect(totalInterestCents(1000000, 2050)).toBe(205000);
      expect(cuotaCents(1000000, 2050, 12)).toBe(100400);
    });

    it("matches the mock exemplar loan (José Núñez: 2,880,000 @ 1200 bps / 12)", () => {
      // totalInterest = 345,600; totalRepay = 3,225,600; raw cuota = 268,800
      // — already a whole-peso amount.
      expect(cuotaCents(2880000, 1200, 12)).toBe(268800);
    });

    it("stays a small, exact peso amount even on a small loan", () => {
      // 120,000 @ 1000 bps / 12: totalRepay = 132,000, raw cuota = 11,000
      // — a whole-peso amount already, unlike the old 50-peso rounding
      // increment which used to inflate this to 15,000.
      expect(cuotaCents(120000, 1000, 12)).toBe(11000);
    });

    it("returns the bare principal-per-term cuota when the rate is zero", () => {
      // 1,000,000 / 12 = 83,333.33 → rounds to the nearest whole peso, 83,300.
      expect(cuotaCents(1000000, 0, 12)).toBe(83300);
    });
  });

  describe("lastCuotaCents", () => {
    it("absorbs the rounding remainder so the schedule reconciles exactly", () => {
      // 1,000,000 @ 2050 bps / 12: cuota rounds to 100,400 (see cuotaCents
      // above). 11 cuotas of 100,400 = 1,104,400, so the last cuota picks
      // up the remaining 100,600 to reach the full 1,205,000 repay.
      expect(cuotaCents(1000000, 2050, 12)).toBe(100400);
      expect(lastCuotaCents(1000000, 2050, 12)).toBe(100600);
    });

    it("equals cuotaCents when the rounded cuota already divides the repay amount", () => {
      // 1,000,000 @ 2000 bps / 12: cuota 100,000 divides 1,200,000 evenly.
      expect(lastCuotaCents(1000000, 2000, 12)).toBe(100000);
    });

    it("never goes below zero when rounding overshoots the whole repay amount", () => {
      // 1,050 @ 0 bps / 21: raw cuota is 50 cents, rounds to 100 (Math.round
      // ties up), but 20 × 100 = 2,000 already exceeds the 1,050 repay, so
      // the nominal last cuota clamps at zero.
      expect(cuotaCents(1050, 0, 21)).toBe(100);
      expect(lastCuotaCents(1050, 0, 21)).toBe(0);
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
