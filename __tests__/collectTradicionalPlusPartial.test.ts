/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: collect-payment and tradicional-plus-schedule (issue #191 items 2,
 * 3, 6, 7) — "Penalidades + cuota" writes N penalty rows and the next cuota
 * in one cobro; "Cobrar penalidad" takes 1..N; a cuota alone needs nothing
 * owed and its due date. Every rule is re-checked against stored payments,
 * and a refused cobro writes nothing.
 */
jest.mock("expo-crypto", () => {
  let counter = 0;
  return { randomUUID: () => `uuid-${++counter}` };
});

import { createCollectPayment } from "../lib/payments/collectPayment";
import { customers, loans, payments } from "../lib/db/schema";
import { ValidationError } from "../lib/errors/ValidationError";
import { cuotaCents, lastCuotaCents } from "../lib/loans/loanMath";
import { tradicionalPlusDueDates, tradicionalPlusState } from "../lib/loans/tradicionalPlus";
import { buildPaymentReceipt, buildLoanDetailView } from "../lib/loans/loanViews";
import { day, plusLoan, sameDay } from "./helpers/tradicionalPlusFixture";
import type { Database } from "../lib/db/client";
import type { Loan } from "../lib/loans/loan.schema";
import type { Payment } from "../lib/payments/payment.schema";

const customerRow = { id: "customer-1", name: "Ana Pérez" };

function makeDbStub(existing: Payment[] = [], loan: Loan = plusLoan) {
  const inserted: Record<string, unknown>[] = [];
  const from = jest.fn((table: unknown) => {
    const rows =
      table === loans
        ? [loan]
        : table === customers
          ? [customerRow]
          : table === payments
            ? existing
            : ([] as unknown[]);
    return Object.assign(Promise.resolve(rows), { where: jest.fn(() => Promise.resolve(rows)) });
  });
  const db = {
    select: jest.fn(() => ({ from })),
    insert: jest.fn(() => ({
      values: jest.fn(async (row: Record<string, unknown>) => {
        inserted.push(row);
      })
    }))
  } as unknown as Database;
  const paymentRows = () =>
    inserted.filter((row) => "loanId" in row && "amountCents" in row) as unknown as Payment[];
  return { db, paymentRows };
}

const base = { loanId: plusLoan.id, method: "cash" as const, moraCents: 0, lines: [] };

describe("collectPayment — Tradicional Plus partial penalties and combo", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("writes N penalty rows and the cuota in one cobro, and moves the plan", async () => {
    jest.setSystemTime(day(3, 20));
    const { db, paymentRows } = makeDbStub();

    await createCollectPayment({ db })({
      ...base,
      amountCents: 190_000,
      penaltyCount: 2,
      withCuota: true
    });

    const rows = paymentRows();
    expect(rows.map((r) => [r.tipo, r.amountCents])).toEqual([
      ["penalidad", 30_000],
      ["penalidad", 30_000],
      ["cuota", 130_000]
    ]);
    expect(new Set(rows.map((r) => r.paidAt.getTime())).size).toBe(1);

    const state = tradicionalPlusState(plusLoan, rows, day(3, 20));
    expect(state.installmentsPaid).toBe(1);
    expect(state.timesMoved).toBe(2);
    expect(state.owedPenalties).toBe(0);
    // Cuota 2 is due at cycle 4: 15 Apr.
    expect(sameDay(state.nextDueDate, day(4, 15))).toBe(true);
  });

  it("prints the penalty line and Cuota 1/10 on the combo's receipt", async () => {
    jest.setSystemTime(day(3, 20));
    const { db } = makeDbStub();

    const receipt = await createCollectPayment({ db })({
      ...base,
      amountCents: 190_000,
      penaltyCount: 2,
      withCuota: true
    });

    expect(receipt.lines).toEqual([
      { label: "Penalidades (2) · Cuota 1 pasa al 31/03", amountCents: 60_000 },
      { label: "Cuota 1/10", amountCents: 130_000 }
    ]);
    expect(receipt.totalCents).toBe(190_000);
  });

  it("refuses the combo with fewer than every owed penalty, or a wrong amount", async () => {
    jest.setSystemTime(day(3, 20));
    const { db, paymentRows } = makeDbStub();
    const collect = createCollectPayment({ db });

    await expect(
      collect({ ...base, amountCents: 160_000, penaltyCount: 1, withCuota: true })
    ).rejects.toThrow("Para cobrar la cuota debe incluir las 2 penalidades.");
    await expect(
      collect({ ...base, amountCents: 180_000, penaltyCount: 2, withCuota: true })
    ).rejects.toThrow("El monto no coincide con la penalidad de este préstamo.");
    expect(paymentRows()).toHaveLength(0);
  });

  it("says 'la penalidad' when the combo misses the only owed one", async () => {
    jest.setSystemTime(day(3, 5));
    const { db } = makeDbStub();

    await expect(
      createCollectPayment({ db })({ ...base, amountCents: 130_000, withCuota: true })
    ).rejects.toThrow("Para cobrar la cuota debe incluir la penalidad.");
  });

  it("takes the last cuota's own amount in a combo and pays the loan off", async () => {
    const loan = { ...plusLoan, principalCents: 1_005_000 };
    const regular = cuotaCents(loan.principalCents, loan.interestRateBps, loan.termCount);
    const last = lastCuotaCents(loan.principalCents, loan.interestRateBps, loan.termCount);
    expect(last).not.toBe(regular);
    // Cuotas 1–9 paid on their dates; cuota 10 is due 14 Jul and past its grace on 20 Jul.
    const nine: Payment[] = Array.from({ length: 9 }, (_, i) => ({
      id: `c${i + 1}`,
      loanId: loan.id,
      amountCents: regular,
      paidAt: new Date(2026, 2, 1 + 15 * i, 10),
      method: "cash",
      notes: null,
      tipo: "cuota",
      createdAt: new Date(2026, 2, 1 + 15 * i, 10)
    }));
    jest.setSystemTime(new Date(2026, 6, 20, 10));
    expect(tradicionalPlusState(loan, nine, new Date(2026, 6, 20, 10)).owedPenalties).toBe(1);
    const { db, paymentRows } = makeDbStub(nine, loan);

    await createCollectPayment({ db })({
      ...base,
      amountCents: 30_000 + last,
      penaltyCount: 1,
      withCuota: true
    });

    const rows = paymentRows();
    expect(rows.map((r) => [r.tipo, r.amountCents])).toEqual([
      ["penalidad", 30_000],
      ["cuota", last]
    ]);
    expect(tradicionalPlusState(loan, [...nine, ...rows], new Date(2026, 6, 20, 10)).paidOff).toBe(
      true
    );
  });

  it("gives the same state, schedule and receipt whatever order the cobro's rows are in", async () => {
    jest.setSystemTime(day(3, 20));
    const { db, paymentRows } = makeDbStub();
    await createCollectPayment({ db })({
      ...base,
      amountCents: 190_000,
      penaltyCount: 2,
      withCuota: true
    });
    const rows = paymentRows();
    const reversed = [...rows].reverse();
    const customer = { ...customerRow } as never;

    for (const today of [day(3, 20), day(4, 20)]) {
      expect(tradicionalPlusState(plusLoan, reversed, today)).toEqual(
        tradicionalPlusState(plusLoan, rows, today)
      );
    }
    expect(tradicionalPlusDueDates(plusLoan, reversed)).toEqual(
      tradicionalPlusDueDates(plusLoan, rows)
    );
    const view = (ps: Payment[]) =>
      buildLoanDetailView({
        loan: plusLoan,
        customerName: "",
        business: null,
        payments: ps,
        today: day(3, 20)
      }).schedule;
    expect(view(reversed)).toEqual(view(rows));
    expect(buildPaymentReceipt(rows[2]!.id, plusLoan, customer, reversed)?.lines).toEqual(
      buildPaymentReceipt(rows[2]!.id, plusLoan, customer, rows)?.lines
    );
  });

  it("collects 1 of 2 penalties: one row, the plan moves 1, 1 still owed and overdue", async () => {
    jest.setSystemTime(day(3, 20));
    const { db, paymentRows } = makeDbStub();

    await createCollectPayment({ db })({ ...base, amountCents: 30_000, penaltyCount: 1 });

    const rows = paymentRows();
    expect(rows.map((r) => [r.tipo, r.amountCents])).toEqual([["penalidad", 30_000]]);
    const state = tradicionalPlusState(plusLoan, rows, day(3, 20));
    expect(state.timesMoved).toBe(1);
    expect(state.owedPenalties).toBe(1);
    expect(state.isOverdue).toBe(true);
  });

  it("refuses k = 0 as a ValidationError and k = 3 of 2, writing nothing", async () => {
    jest.setSystemTime(day(3, 20));
    const { db, paymentRows } = makeDbStub();
    const collect = createCollectPayment({ db });

    await expect(collect({ ...base, amountCents: 30_000, penaltyCount: 0 })).rejects.toThrow(
      ValidationError
    );
    await expect(collect({ ...base, amountCents: 90_000, penaltyCount: 3 })).rejects.toThrow(
      "Debe cobrar entre 1 y 2 penalidades."
    );
    expect(paymentRows()).toHaveLength(0);
  });

  it("refuses a cuota before its due date: 24 Feb, and 2 Mar after a penalty", async () => {
    jest.setSystemTime(day(2, 24));
    const first = makeDbStub();
    await expect(
      createCollectPayment({ db: first.db })({ ...base, amountCents: 130_000 })
    ).rejects.toThrow("La cuota vence el 01/03.");
    expect(first.paymentRows()).toHaveLength(0);

    jest.setSystemTime(day(3, 2));
    const paid: Payment = {
      id: "pen-1",
      loanId: plusLoan.id,
      amountCents: 30_000,
      paidAt: day(3, 1),
      method: "cash",
      notes: null,
      tipo: "penalidad",
      createdAt: day(3, 1)
    };
    const second = makeDbStub([paid]);
    await expect(
      createCollectPayment({ db: second.db })({ ...base, amountCents: 130_000 })
    ).rejects.toThrow("La cuota vence el 16/03.");
    expect(second.paymentRows()).toHaveLength(0);
  });

  it("refuses 2 penalties when nothing is owed and the cuota is due", async () => {
    for (const today of [day(3, 1), day(3, 3)]) {
      jest.setSystemTime(today);
      const { db, paymentRows } = makeDbStub();

      await expect(
        createCollectPayment({ db })({ ...base, amountCents: 60_000, penaltyCount: 2 })
      ).rejects.toThrow("Solo se puede cobrar 1 penalidad.");
      expect(paymentRows()).toHaveLength(0);
    }
  });
});
