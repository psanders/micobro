/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: tradicional-plus-schedule "A cuota is collectable only on or after
 * its due date" and loan-detail "Nothing due today" (issue #191 item 5) — a
 * Tradicional Plus cuota isn't owed before its date, so "Total a pagar hoy"
 * reads RD$ 0 with the next date, while other loan types are unchanged.
 */
import { tradicionalPlusState } from "../lib/loans/tradicionalPlus";
import { buildCustomerLoanSummary } from "../lib/loans/loanViews";
import { day, penalty, plusLoan, sameDay, viewAt } from "./helpers/tradicionalPlusFixture";

describe("Tradicional Plus — cuota due only on or after its date", () => {
  it("can't collect the cuota on 24 Feb, before cuota 1's date", () => {
    const state = tradicionalPlusState(plusLoan, [], day(2, 24));

    expect(state.isDue).toBe(false);
    expect(state.canCollectCuota).toBe(false);
  });

  it("can't collect the moved cuota on 2 Mar after a penalty paid on 1 Mar", () => {
    const state = tradicionalPlusState(plusLoan, [penalty(day(3, 1))], day(3, 2));

    expect(state.owedPenalties).toBe(0);
    expect(sameDay(state.nextDueDate, day(3, 16))).toBe(true);
    expect(state.canCollectCuota).toBe(false);
  });

  it("can collect the cuota on its date and within the grace days", () => {
    expect(tradicionalPlusState(plusLoan, [], day(3, 1)).canCollectCuota).toBe(true);
    expect(tradicionalPlusState(plusLoan, [], day(3, 3)).canCollectCuota).toBe(true);
  });

  it("shows nothing in Total a pagar hoy before the date, with the next date and amount", () => {
    for (const [payments, today, next] of [
      [[], day(2, 24), day(3, 1)],
      [[penalty(day(3, 1))], day(3, 2), day(3, 16)]
    ] as const) {
      const view = viewAt([...payments], today);

      expect(view.dueTodayLines).toEqual([]);
      expect(view.dueTodayCents).toBe(0);
      expect(sameDay(view.tradicionalPlus?.nextDueDate, next)).toBe(true);
      expect(view.tradicionalPlus?.nextCuotaCents).toBe(130_000);
      expect(view.tradicionalPlus?.nextCuotaNumber).toBe(1);
    }
  });

  it("keeps the next cuota's amount on the customer card", () => {
    const view = viewAt([], day(2, 24));

    const summary = buildCustomerLoanSummary(view, plusLoan);

    expect(summary.nextAmountCents).toBe(130_000);
    expect(sameDay(summary.nextDueDate, day(3, 1))).toBe(true);
  });

  it("leaves a Tradicional loan with the same dates unchanged", () => {
    const tradicional = { ...plusLoan, loanType: null, penaltyCents: null };

    const view = viewAt([], day(2, 24), tradicional);

    expect(view.dueTodayLines).toEqual([
      expect.objectContaining({ kind: "installment", installmentNumber: 1, amountCents: 130_000 })
    ]);
    expect(view.dueTodayCents).toBe(130_000);
  });
});
