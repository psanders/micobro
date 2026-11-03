/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: owner-position — "Capital lent, amount to collect and margin",
 * "Amount at risk from late loans", "To collect by loan type", "This
 * month's outlook". Contract and formulas:
 * openspec/changes/cartera-figures-fix/design.md.
 *
 * Every expected figure below is worked out by hand from the contract (the
 * arithmetic is in the comments); none is derived from the implementation.
 */
import { composePosition } from "../lib/reports/composePosition";
import type { Loan } from "../lib/loans/loan.schema";
import type { Payment } from "../lib/payments/payment.schema";
import type { OwnerPosition } from "../lib/reports/position.schema";

const TODAY = new Date(2026, 9, 20, 12); // 20 Oct 2026, noon

/** A 2026 date at noon (or `hour`) — month is 1-based here for readability. */
function day(month: number, date: number, hour = 12): Date {
  return new Date(2026, month - 1, date, hour);
}

function loan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: "loan-1",
    customerId: "customer-1",
    principalCents: 1000000, // RD$10,000
    interestRateBps: 2000, // 20% flat → repay RD$12,000, interest RD$2,000
    termCount: 4, // cuota RD$3,000
    frequency: "monthly",
    startDate: day(8, 20),
    status: "active",
    notes: null,
    graceDays: 0,
    moraEnabled: null,
    moraRateBps: null,
    skipSundays: null,
    loanType: null,
    penaltyCents: null,
    createdAt: TODAY,
    updatedAt: TODAY,
    ...overrides
  };
}

/** A crédito abierto loan; grace 0 unless overridden (open credit reads null as 5). */
function openCredit(overrides: Partial<Loan> = {}): Loan {
  return loan({ termCount: 0, loanType: "open_credit", graceDays: 0, ...overrides });
}

/** RD$60,000 to repay in 12 monthly cuotas of RD$5,000 (RD$50,000 at 20% flat). */
function sixtyK(overrides: Partial<Loan> = {}): Loan {
  return loan({ principalCents: 5000000, interestRateBps: 2000, termCount: 12, ...overrides });
}

function payment(
  loanId: string,
  amountCents: number,
  paidAt: Date,
  notes: string | null = null
): Payment {
  return {
    id: `p-${loanId}-${paidAt.getTime()}-${amountCents}`,
    loanId,
    amountCents,
    paidAt,
    method: "cash",
    notes,
    createdAt: paidAt
  };
}

function expectSplitAddsUp(position: OwnerPosition) {
  expect(position.capitalCents + position.interestCents).toBe(position.receivableCents);
  expect(position.byType.term.outstandingCents + position.byType.openCredit.outstandingCents).toBe(
    position.receivableCents
  );
}

describe("composePosition", () => {
  describe("capital and interest to collect", () => {
    it("splits a term and an open-credit loan into capital and interest (spec scenario)", () => {
      const position = composePosition({
        today: TODAY,
        loans: [
          loan({ id: "a" }),
          openCredit({
            id: "oc",
            principalCents: 500000, // RD$5,000
            interestRateBps: 1000, // 10% per cycle
            startDate: day(9, 25) // cycle 1 ends 25 Oct — not ended yet
          })
        ],
        payments: [payment("a", 300000, day(9, 21)), payment("a", 300000, day(10, 5))]
      });

      // term: balance 1,200,000 − 600,000 = 600,000;
      //   interest = 600,000 × 200,000 / 1,200,000 = 100,000; capital 500,000
      // oc: capital pendiente 500,000, intereses sumados 0 (cycle-1 RD$500 not counted)
      expect(position.capitalCents).toBe(1000000);
      expect(position.receivableCents).toBe(1100000);
      expect(position.interestCents).toBe(100000);
      expect(position.byType.term).toEqual({ loanCount: 1, outstandingCents: 600000 });
      expect(position.byType.openCredit).toEqual({ loanCount: 1, outstandingCents: 500000 });
      expectSplitAddsUp(position);
    });

    it("gives RD$10,000 at 20% with RD$6,000 paid RD$1,000 interest and RD$5,000 capital", () => {
      const position = composePosition({
        today: TODAY,
        loans: [loan({ id: "a", startDate: day(9, 15) })],
        payments: [payment("a", 600000, day(10, 1))]
      });

      // balance 6,000 → interest 6,000 × 2,000 / 12,000 = 1,000; capital 5,000
      expect(position.receivableCents).toBe(600000);
      expect(position.interestCents).toBe(100000);
      expect(position.capitalCents).toBe(500000);
    });

    it("counts a crédito abierto's intereses sumados as interest, never the next cycle's", () => {
      const position = composePosition({
        today: TODAY,
        loans: [
          openCredit({
            id: "oc",
            principalCents: 1000000, // RD$10,000
            interestRateBps: 1000, // 10% per cycle
            startDate: day(9, 10) // cycle 1 ended 10 Oct unpaid; cycle 2 runs to 10 Nov
          })
        ],
        payments: []
      });

      // cycle 1 interest 100,000 capitalized → balance 1,100,000
      // cycle 2's 110,000 (10% of 1,100,000) is still in progress → not counted
      // atraso = intereses sumados 100,000; round(100,000 / 1,100,000 × 100 = 9.09) = 9
      expect(position.receivableCents).toBe(1100000);
      expect(position.capitalCents).toBe(1000000);
      expect(position.interestCents).toBe(100000);
      expect(position.overdue).toEqual({ cents: 100000, loanCount: 1, percent: 9 });
      expectSplitAddsUp(position);
    });

    it("keeps capital + interest equal to por cobrar over awkward amounts and partial payments", () => {
      const position = composePosition({
        today: TODAY,
        loans: [
          loan({
            id: "t1",
            principalCents: 733300, // RD$7,333
            interestRateBps: 1750, // 17.5%
            termCount: 7,
            frequency: "weekly",
            startDate: day(10, 1),
            graceDays: 7
          }),
          loan({
            id: "t2",
            principalCents: 1234500, // RD$12,345
            interestRateBps: 2333, // 23.33%
            termCount: 9,
            frequency: "biweekly",
            startDate: day(9, 3),
            graceDays: null
          }),
          openCredit({
            id: "oc",
            principalCents: 987600, // RD$9,876
            interestRateBps: 733, // 7.33% per cycle
            startDate: day(8, 7)
          })
        ],
        payments: [
          payment("t1", 123400, day(10, 9)),
          payment("t2", 77700, day(9, 18)),
          payment("t2", 5000, day(10, 2), "mora"),
          payment("oc", 30000, day(8, 20)),
          payment("oc", 100000, day(9, 25))
        ]
      });

      // t1: interest = roundToPeso(733,300 × 0.175 = 128,327.5) = 128,300; repay 861,600
      //     balance 861,600 − 123,400 = 738,200
      //     interest share = roundToPeso(738,200 × 128,300 / 861,600 = 109,924.6) = 109,900
      //     capital 738,200 − 109,900 = 628,300
      // t2: interest = roundToPeso(1,234,500 × 0.2333 = 288,008.85) = 288,000; repay 1,522,500
      //     balance 1,522,500 − 77,700 = 1,444,800 (the mora row pays nothing)
      //     interest share = roundToPeso(1,444,800 × 288,000 / 1,522,500 = 273,302.1) = 273,300
      //     capital 1,444,800 − 273,300 = 1,171,500
      // oc: cycle 1 (7 Aug–7 Sep) interest roundToPeso(987,600 × 0.0733) = 72,400;
      //     paid 30,000 → 42,400 capitalized → balance 1,030,000
      //     cycle 2 (to 7 Oct) interest roundToPeso(1,030,000 × 0.0733) = 75,500;
      //     paid 100,000 → 24,500 clears intereses sumados first → 17,900 left
      //     balance 1,005,500 = capital 987,600 + intereses sumados 17,900
      expect(position.receivableCents).toBe(738200 + 1444800 + 1005500);
      expect(position.interestCents).toBe(109900 + 273300 + 17900);
      expect(position.capitalCents).toBe(628300 + 1171500 + 987600);
      expect(position.byType.term).toEqual({ loanCount: 2, outstandingCents: 738200 + 1444800 });
      expect(position.byType.openCredit).toEqual({ loanCount: 1, outstandingCents: 1005500 });
      expectSplitAddsUp(position);

      // atraso (term cuotas are past due the day after their due date; grace ignored):
      // t1 (grace 7, ignored): cuota roundToPeso(861,600 / 7) = 123,100; due 8 Oct and
      //     15 Oct are before 20 Oct, 22 Oct is not → 246,200 − paid 123,400 = 122,800
      // t2 (grace null, ignored): cuota roundToPeso(1,522,500 / 9) = 169,200; due 18 Sep,
      //     3 Oct and 18 Oct are before 20 Oct → 507,600 − 77,700 = 429,900
      // oc: intereses sumados 17,900
      // total 122,800 + 429,900 + 17,900 = 570,600 over 3 late loans
      // percent = round(570,600 / 3,188,500 × 100 = 17.90) = 18
      expect(position.overdue).toEqual({ cents: 570600, loanCount: 3, percent: 18 });

      // cobrado: every October payment, mora included: 123,400 + 5,000
      expect(position.month.collectedCents).toBe(128400);
    });
  });

  describe("en atraso", () => {
    it("counts only the past-due cuota of a big loan, not its whole balance", () => {
      const position = composePosition({
        today: TODAY,
        // first cuota 1 Oct < 20 Oct → past due; next due 1 Nov
        loans: [sixtyK({ id: "a", startDate: day(9, 1), graceDays: 7 })],
        payments: []
      });

      // pastDue = 500,000; percent round(500,000 / 6,000,000 × 100 = 8.33) = 8
      expect(position.receivableCents).toBe(6000000);
      expect(position.overdue).toEqual({ cents: 500000, loanCount: 1, percent: 8 });
    });

    it("shows the spec's one late loan out of four as RD$15,000 and 15%", () => {
      const notYetDue = (id: string) =>
        // repay RD$15,000 in 3 cuotas; first due 15 Nov
        loan({ id, principalCents: 1250000, termCount: 3, startDate: day(10, 15), graceDays: 7 });
      const position = composePosition({
        today: TODAY,
        loans: [
          // cuotas 1 Jul, 1 Aug, 1 Sep, 1 Oct all before 20 Oct → past due (grace ignored)
          sixtyK({ id: "late", startDate: day(6, 1), graceDays: 7 }),
          notYetDue("b"),
          notYetDue("c"),
          notYetDue("d")
        ],
        payments: [payment("late", 500000, day(7, 2))]
      });

      // late: balance 6,000,000 − 500,000 = 5,500,000; pastDue 4 × 500,000 − 500,000 = 1,500,000
      // total 5,500,000 + 3 × 1,500,000 = 10,000,000 → 15%
      expect(position.receivableCents).toBe(10000000);
      expect(position.overdue).toEqual({ cents: 1500000, loanCount: 1, percent: 15 });
    });

    it("counts a cuota due yesterday as late even with 7 grace days (spec scenario)", () => {
      const position = composePosition({
        today: TODAY,
        loans: [sixtyK({ id: "a", startDate: day(9, 19), graceDays: 7 })], // due 19 Oct
        payments: []
      });

      // 19 Oct < 20 Oct → past due; grace is ignored for term atraso
      // 500,000; round(500,000 / 6,000,000 × 100 = 8.33) = 8
      expect(position.overdue).toEqual({ cents: 500000, loanCount: 1, percent: 8 });
    });

    it.each([null, 0, 7])(
      "counts a cuota due yesterday the same whatever the grace days (graceDays %p)",
      (graceDays) => {
        const position = composePosition({
          today: TODAY,
          loans: [sixtyK({ id: "a", startDate: day(9, 19), graceDays })], // due 19 Oct
          payments: []
        });

        // 19 Oct < 20 Oct → 500,000; round(500,000 / 6,000,000 × 100 = 8.33) = 8
        expect(position.overdue).toEqual({ cents: 500000, loanCount: 1, percent: 8 });
      }
    );

    it.each([null, 0, 7])(
      "does not count a cuota due today as late, whatever the grace days (graceDays %p)",
      (graceDays) => {
        const position = composePosition({
          today: TODAY,
          loans: [sixtyK({ id: "a", startDate: day(9, 20), graceDays })], // due 20 Oct
          payments: []
        });

        // 20 Oct is not before 20 Oct → not late
        expect(position.overdue).toEqual({ cents: 0, loanCount: 0, percent: 0 });
      }
    );

    it("makes no difference between grace values null, 0 and 7 across a portfolio", () => {
      const position = composePosition({
        today: TODAY,
        loans: [
          // all due 13 Oct — within the old 7-day grace for null/7, late now for all
          sixtyK({ id: "null", startDate: day(9, 13), graceDays: null }),
          sixtyK({ id: "zero", startDate: day(9, 13), graceDays: 0 }),
          sixtyK({ id: "seven", startDate: day(9, 13), graceDays: 7 })
        ],
        payments: []
      });

      // 3 × 500,000 = 1,500,000 over 18,000,000; round(8.33) = 8
      expect(position.receivableCents).toBe(18000000);
      expect(position.overdue).toEqual({ cents: 1500000, loanCount: 3, percent: 8 });
    });

    it("does not let a mora payment pay a past-due cuota", () => {
      const position = composePosition({
        today: TODAY,
        loans: [sixtyK({ id: "a", startDate: day(9, 1), graceDays: 7 })],
        payments: [payment("a", 50000, day(10, 15), "mora")]
      });

      // mora rows pay no cuota: balance and pastDue unchanged
      expect(position.receivableCents).toBe(6000000);
      expect(position.overdue).toEqual({ cents: 500000, loanCount: 1, percent: 8 });
    });

    it("reduces the past-due amount by a partial payment", () => {
      const position = composePosition({
        today: TODAY,
        loans: [sixtyK({ id: "a", startDate: day(9, 1), graceDays: 7 })],
        payments: [payment("a", 200000, day(10, 15))]
      });

      // pastDue 500,000 − 200,000 = 300,000; balance 5,800,000
      // percent round(300,000 / 5,800,000 × 100 = 5.17) = 5
      expect(position.receivableCents).toBe(5800000);
      expect(position.overdue).toEqual({ cents: 300000, loanCount: 1, percent: 5 });
    });

    it("counts a crédito abierto's intereses sumados over several cycles as past due, rounding the share", () => {
      const position = composePosition({
        today: TODAY,
        loans: [
          openCredit({
            id: "oc",
            principalCents: 1000000,
            interestRateBps: 1000,
            startDate: day(7, 15) // cycles end 15 Aug, 15 Sep, 15 Oct; cycle 4 to 15 Nov
          })
        ],
        payments: []
      });

      // capitalized 100,000 + 110,000 + 121,000 = 331,000 → balance 1,331,000
      // cycle 4's 133,100 is not counted
      // percent round(331,000 / 1,331,000 × 100 = 24.87) = 25
      expect(position.receivableCents).toBe(1331000);
      expect(position.capitalCents).toBe(1000000);
      expect(position.interestCents).toBe(331000);
      expect(position.overdue).toEqual({ cents: 331000, loanCount: 1, percent: 25 });
    });

    it("does not count a crédito abierto whose cycle is still in grace as late", () => {
      const position = composePosition({
        today: TODAY,
        loans: [
          openCredit({
            id: "oc",
            principalCents: 1000000,
            interestRateBps: 1000,
            startDate: day(9, 17), // cycle 1 due 17 Oct, grace 5 → ends after 22 Oct
            graceDays: 5
          })
        ],
        payments: []
      });

      expect(position.overdue).toEqual({ cents: 0, loanCount: 0, percent: 0 });
      expect(position.interestCents).toBe(0);
    });

    it("counts only past-due cuotas net of payments across term loans", () => {
      const position = composePosition({
        today: TODAY,
        loans: [
          loan({ id: "on-time", startDate: day(9, 20) }), // only cuota due 20 Oct (today)
          loan({ id: "late", startDate: day(7, 20) }) // due 20 Aug, 20 Sep past; 20 Oct today
        ],
        payments: [payment("on-time", 300000, day(10, 1))]
      });

      // on-time: 1,200,000 − 300,000 = 900,000, past due 0
      // late: 1,200,000, past due 600,000
      // percent round(600,000 / 2,100,000 × 100 = 28.57) = 29
      expect(position.receivableCents).toBe(2100000);
      expect(position.overdue).toEqual({ cents: 600000, loanCount: 1, percent: 29 });
    });

    it("reports nothing late when every loan is current", () => {
      const position = composePosition({
        today: TODAY,
        // first cuotas due 25 Oct and 1 Nov
        loans: [loan({ id: "a", startDate: day(9, 25) }), loan({ id: "b", startDate: day(10, 1) })],
        payments: []
      });

      expect(position.receivableCents).toBe(2400000);
      expect(position.overdue).toEqual({ cents: 0, loanCount: 0, percent: 0 });
    });
  });

  describe("cobrado este mes", () => {
    it("reports this month's collected, still due and best-case total", () => {
      const position = composePosition({
        today: TODAY,
        loans: [
          loan({ id: "paid-up" }),
          loan({ id: "late", startDate: day(7, 20) }),
          openCredit({
            id: "oc",
            principalCents: 500000,
            interestRateBps: 1000,
            startDate: day(9, 25)
          })
        ],
        payments: [payment("paid-up", 300000, day(9, 21)), payment("paid-up", 300000, day(10, 5))]
      });

      // collected: only the 5 Oct payment = 300,000
      // paid-up: due by month end 600,000 − paid 600,000 = 0
      // late: cuotas due 20 Aug, 20 Sep, 20 Oct = 900,000, nothing paid
      // oc: next interest due 25 Oct = 50,000
      expect(position.month.collectedCents).toBe(300000);
      expect(position.month.remainingCents).toBe(950000);
      expect(position.month.expectedCents).toBe(1250000);
      expect(position.month.progress).toBeCloseTo(300000 / 1250000);
    });

    it("counts a payment that settled a loan this month", () => {
      const position = composePosition({
        today: TODAY,
        loans: [loan({ id: "settled", startDate: day(7, 20) })],
        payments: [payment("settled", 300000, day(8, 20)), payment("settled", 900000, day(10, 10))]
      });

      // balance 1,200,000 − 1,200,000 = 0 → not counted, but its RD$9,000 is cobrado
      expect(position.receivableCents).toBe(0);
      expect(position.month.collectedCents).toBe(900000);
    });

    it("counts this month's payments on an archived loan", () => {
      const position = composePosition({
        today: TODAY,
        loans: [loan({ id: "archived", status: "cancelled" })],
        payments: [payment("archived", 300000, day(10, 3))]
      });

      expect(position.receivableCents).toBe(0);
      expect(position.month.collectedCents).toBe(300000);
    });

    it("counts this month's payments whose loan is not in the list", () => {
      const position = composePosition({
        today: TODAY,
        loans: [],
        payments: [payment("gone", 250000, day(10, 4))]
      });

      expect(position.month.collectedCents).toBe(250000);
    });

    it("counts mora payments in this month's collected without changing what is to collect", () => {
      const position = composePosition({
        today: TODAY,
        loans: [loan({ id: "a", startDate: day(9, 20) })],
        payments: [payment("a", 20000, day(10, 10), "mora")]
      });

      expect(position.month.collectedCents).toBe(20000);
      expect(position.receivableCents).toBe(1200000);
    });

    it("leaves last month's payments out, by calendar month", () => {
      const position = composePosition({
        today: TODAY,
        loans: [loan({ id: "a", startDate: day(8, 20) })],
        payments: [
          payment("a", 100000, day(9, 30, 23)), // 30 Sep, 23:00 — last month
          payment("a", 200000, day(10, 1, 8)) // 1 Oct, 08:00 — this month
        ]
      });

      expect(position.month.collectedCents).toBe(200000);
    });
  });

  describe("left out", () => {
    it("leaves archived and fully paid loans out of capital, interest, por cobrar, atraso and byType", () => {
      const position = composePosition({
        today: TODAY,
        loans: [
          // would be late (cuotas due 20 Jun … 20 Sep) if it counted
          loan({ id: "archived", status: "cancelled", startDate: day(5, 20) }),
          loan({ id: "settled", startDate: day(5, 20) }),
          // would have intereses sumados if it counted
          openCredit({
            id: "oc-archived",
            status: "cancelled",
            principalCents: 1000000,
            interestRateBps: 1000,
            startDate: day(7, 15)
          })
        ],
        payments: [payment("settled", 1200000, day(9, 1))]
      });

      expect(position.capitalCents).toBe(0);
      expect(position.interestCents).toBe(0);
      expect(position.receivableCents).toBe(0);
      expect(position.overdue).toEqual({ cents: 0, loanCount: 0, percent: 0 });
      expect(position.byType.term).toEqual({ loanCount: 0, outstandingCents: 0 });
      expect(position.byType.openCredit).toEqual({ loanCount: 0, outstandingCents: 0 });
    });

    it("is all zeros with no loans, with a 0% late share", () => {
      const position = composePosition({ today: TODAY, loans: [], payments: [] });

      expect(position.capitalCents).toBe(0);
      expect(position.interestCents).toBe(0);
      expect(position.receivableCents).toBe(0);
      expect(position.overdue).toEqual({ cents: 0, loanCount: 0, percent: 0 });
      expect(position.month).toEqual({
        collectedCents: 0,
        remainingCents: 0,
        expectedCents: 0,
        progress: 0
      });
    });
  });

  it("counts a Tradicional Plus loan as término fijo, late on a missed cycle, without penalties in to-collect", () => {
    // Arrange — quincenal RD$10,000 at 20% (4 × RD$3,000), first cycle due 5 Oct
    const plus = loan({
      id: "plus",
      frequency: "biweekly",
      startDate: new Date(2026, 8, 20),
      loanType: "term_plus",
      moraEnabled: false,
      penaltyCents: 30000
    });
    const penalty = payment("plus", 30000, new Date(2026, 9, 5, 10), "penalidad");

    // Act
    const late = composePosition({ loans: [plus], payments: [], today: TODAY });
    const moved = composePosition({ loans: [plus], payments: [penalty], today: TODAY });

    // Assert — unpaid: late; after a penalty: al día, nothing collected toward the balance
    expect(late.byType.term.loanCount).toBe(1);
    expect(late.overdue.loanCount).toBe(1);
    expect(moved.overdue.loanCount).toBe(0);
    expect(moved.receivableCents).toBe(1200000);
  });
});
