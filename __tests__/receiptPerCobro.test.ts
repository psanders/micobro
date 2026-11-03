/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: collect-payment "One receipt number per cobro with penalties" (issue
 * #191 item 8) — a cobro containing a penalty row takes one number, the live
 * receipt equals the reprint, and every other cobro keeps the number it
 * printed before.
 */
jest.mock("expo-crypto", () => {
  let counter = 0;
  return { randomUUID: () => `uuid-${++counter}` };
});

import { createCollectPayment } from "../lib/payments/collectPayment";
import { customers, loans, payments } from "../lib/db/schema";
import {
  buildPaymentReceipt,
  buildReceiptNumberIndex,
  canonicalReceiptNumbers
} from "../lib/loans/loanViews";
import { day, plusLoan } from "./helpers/tradicionalPlusFixture";
import type { Database } from "../lib/db/client";
import type { Loan } from "../lib/loans/loan.schema";
import type { Payment } from "../lib/payments/payment.schema";

const customer = { id: "customer-1", name: "Ana Pérez" };
const tradicional: Loan = { ...plusLoan, id: "loan-trad", loanType: null, penaltyCents: null };

function row(id: string, loanId: string, at: Date, tipo: Payment["tipo"], cents: number): Payment {
  return {
    id,
    loanId,
    amountCents: cents,
    paidAt: at,
    method: "cash",
    notes: null,
    tipo,
    createdAt: at
  };
}

// Two earlier cobros on a Tradicional loan: mora + cuota (R-00001, R-00002 → prints R-00001), then a cuota (R-00003).
const earlier = [
  row("t-mora", tradicional.id, day(3, 2), "mora", 5_000),
  row("t-cuota", tradicional.id, day(3, 2), "cuota", 130_000),
  row("t-cuota-2", tradicional.id, day(3, 17), "cuota", 130_000)
];

function makeDbStub(existing: Payment[]) {
  const inserted: Payment[] = [];
  const from = jest.fn((table: unknown) => {
    const rows =
      table === loans
        ? [plusLoan]
        : table === customers
          ? [customer]
          : table === payments
            ? existing
            : ([] as unknown[]);
    return Object.assign(Promise.resolve(rows), { where: jest.fn(() => Promise.resolve(rows)) });
  });
  const db = {
    select: jest.fn(() => ({ from })),
    insert: jest.fn(() => ({
      values: jest.fn(async (r: Record<string, unknown>) => {
        if ("loanId" in r && "amountCents" in r) inserted.push(r as unknown as Payment);
      })
    }))
  } as unknown as Database;
  return { db, inserted };
}

const reprint = (all: Payment[], id: string) => {
  const target = all.find((p) => p.id === id)!;
  const loan = target.loanId === plusLoan.id ? plusLoan : tradicional;
  return buildPaymentReceipt(id, loan, customer as never, all)?.receiptNumber;
};

describe("receipt numbers per cobro", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("gives a 3-row penalty cobro one number, equal to every row's reprint", async () => {
    jest.setSystemTime(day(3, 20));
    const { db, inserted } = makeDbStub(earlier);

    const receipt = await createCollectPayment({ db })({
      loanId: plusLoan.id,
      amountCents: 190_000,
      method: "cash",
      moraCents: 0,
      lines: [],
      penaltyCount: 2,
      withCuota: true
    });

    const all = [...earlier, ...inserted];
    expect(inserted).toHaveLength(3);
    expect(receipt.receiptNumber).toBe("R-00004");
    for (const p of inserted) expect(reprint(all, p.id)).toBe(receipt.receiptNumber);
  });

  it("keeps the earlier cobros' numbers", async () => {
    jest.setSystemTime(day(3, 20));
    const { db, inserted } = makeDbStub(earlier);
    await createCollectPayment({ db })({
      loanId: plusLoan.id,
      amountCents: 190_000,
      method: "cash",
      moraCents: 0,
      lines: [],
      penaltyCount: 2,
      withCuota: true
    });

    const all = [...earlier, ...inserted];
    expect(reprint(all, "t-mora")).toBe("R-00001");
    expect(reprint(all, "t-cuota")).toBe("R-00001");
    expect(reprint(all, "t-cuota-2")).toBe("R-00003");
  });

  it("leaves no gap after a penalty cobro", () => {
    const penaltyCobro = [
      row("pen-1", plusLoan.id, day(3, 20), "penalidad", 30_000),
      row("pen-2", plusLoan.id, day(3, 20), "penalidad", 30_000)
    ];
    const next = row("next", tradicional.id, day(3, 21), "cuota", 130_000);
    const all = [...earlier, ...penaltyCobro, next];

    const index = buildReceiptNumberIndex(all);

    expect(index.get("pen-1")).toBe("R-00004");
    expect(index.get("pen-2")).toBe("R-00004");
    expect(index.get("next")).toBe("R-00005");
    expect(
      canonicalReceiptNumbers(
        all.filter((p) => p.loanId === tradicional.id),
        index
      ).get("next")
    ).toBe("R-00005");
  });
});
