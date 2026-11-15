/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Issue #204: a Tradicional payment that isn't exactly one cuota names every
 * cuota it paid — on the receipt at collection, the reprint and the
 * Histórico de Pagos row — from one mapping over the stored rows.
 */
jest.mock("expo-crypto", () => {
  let counter = 0;
  return { randomUUID: () => `uuid-${++counter}` };
});

import { createCollectPayment } from "../lib/payments/collectPayment";
import { buildPaymentHistoryView, buildPaymentReceipt } from "../lib/loans/loanViews";
import { customers, loans, payments } from "../lib/db/schema";
import type { Database } from "../lib/db/client";
import type { Customer } from "../lib/customers/customer.schema";
import type { Loan } from "../lib/loans/loan.schema";
import type { Payment } from "../lib/payments/payment.schema";
import type { ReceiptLine } from "../lib/repo/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const start = new Date("2026-10-01T12:00:00");
const day = (n: number) => new Date(start.getTime() + n * DAY_MS);

// 30 cuotas of RD$500: RD$12,500 at 20% flat repays RD$15,000.
const loan: Loan = {
  id: "loan-1",
  customerId: "customer-1",
  principalCents: 1250000,
  interestRateBps: 2000,
  termCount: 30,
  frequency: "daily",
  startDate: start,
  status: "active",
  notes: null,
  graceDays: null,
  moraEnabled: null,
  moraRateBps: null,
  skipSundays: null,
  loanType: null,
  penaltyCents: null,
  createdAt: start,
  updatedAt: start
};
const customer = { id: "customer-1", name: "José Núñez" } as Customer;

let seq = 0;
const pay = (
  amountCents: number,
  paidAt: Date,
  tipo: Payment["tipo"] = "cuota",
  createdAt: Date = paidAt
): Payment => ({
  id: `p-${++seq}`,
  loanId: loan.id,
  amountCents,
  paidAt,
  method: "cash",
  notes: null,
  tipo,
  createdAt
});

/** Cuotas 1..n paid one per day. */
const paidCuotas = (n: number) => Array.from({ length: n }, (_, i) => pay(50000, day(i + 1)));

function makeDbStub(existing: Payment[], loanRow: Loan = loan) {
  const inserted: Payment[] = [];
  const from = jest.fn((table: unknown) => {
    const rows =
      table === loans
        ? [loanRow]
        : table === customers
          ? [customer]
          : table === payments
            ? existing
            : ([] as unknown[]);
    const promise = Promise.resolve(rows);
    return Object.assign(promise, { where: jest.fn(() => Promise.resolve(rows)) });
  });
  const db = {
    select: jest.fn(() => ({ from })),
    insert: jest.fn(() => ({
      values: jest.fn(async (row: Payment) => {
        inserted.push(row);
      })
    }))
  } as unknown as Database;
  return { db, inserted };
}

/** Collects through the real collectPayment; returns its lines and the reprint's. */
async function collect(existing: Payment[], amountCents: number, moraCents = 0) {
  const { db, inserted } = makeDbStub(existing);
  const receipt = await createCollectPayment({ db })({
    loanId: loan.id,
    amountCents,
    method: "cash",
    moraCents,
    lines: [{ label: "Monto personalizado", amountCents }]
  });
  const created = inserted.filter((row) => "loanId" in row && "amountCents" in row);
  const all = [
    ...existing,
    ...created.map((row) => ({ ...row, paidAt: receipt.paidAt, createdAt: receipt.paidAt }))
  ];
  const reprints = created.map((row) => buildPaymentReceipt(row.id, loan, customer, all)!.lines);
  return { live: receipt.lines, reprints, total: receipt.totalCents };
}

const sum = (lines: ReceiptLine[]) => lines.reduce((s, l) => s + l.amountCents, 0);

describe("multi-cuota receipt lines (live and reprint)", () => {
  it("AC1: RD$2,000 at cuota 5/30 lists cuotas 5 to 8", async () => {
    const { live, reprints } = await collect(paidCuotas(4), 200000);
    expect(live).toEqual([
      { label: "Cuota 5/30", amountCents: 50000 },
      { label: "Cuota 6/30", amountCents: 50000 },
      { label: "Cuota 7/30", amountCents: 50000 },
      { label: "Cuota 8/30", amountCents: 50000 }
    ]);
    expect(reprints[0]).toEqual(live);
  });

  it("AC2: RD$2,200 adds the partial remainder on cuota 9", async () => {
    const { live, reprints } = await collect(paidCuotas(4), 220000);
    expect(live.map((l) => l.label)).toEqual([
      "Cuota 5/30",
      "Cuota 6/30",
      "Cuota 7/30",
      "Cuota 8/30",
      "Abono a cuota 9/30"
    ]);
    expect(live[4]!.amountCents).toBe(20000);
    expect(reprints[0]).toEqual(live);
  });

  it("AC3: below one cuota names the cuota, with mora first", async () => {
    const plain = await collect(paidCuotas(4), 30000);
    expect(plain.live).toEqual([{ label: "Abono a cuota 5/30", amountCents: 30000 }]);
    expect(plain.reprints[0]).toEqual(plain.live);

    const withMora = await collect(paidCuotas(4), 30000, 10000);
    expect(withMora.live).toEqual([
      { label: "Mora (prioridad)", amountCents: 10000 },
      { label: "Abono a cuota 5/30", amountCents: 20000 }
    ]);
    for (const reprint of withMora.reprints) expect(reprint).toEqual(withMora.live);
  });

  it("AC4: finishing a cuota an earlier abono started reads Cuota N/T", async () => {
    const { live, reprints } = await collect([...paidCuotas(4), pay(20000, day(5))], 50000);
    expect(live).toEqual([
      { label: "Cuota 5/30", amountCents: 30000 },
      { label: "Abono a cuota 6/30", amountCents: 20000 }
    ]);
    expect(reprints[0]).toEqual(live);
  });

  it("AC5: stops at the last cuota and puts the rest in Abono adicional", async () => {
    const { live, total } = await collect(paidCuotas(28), 120000);
    expect(live).toEqual([
      { label: "Cuota 29/30", amountCents: 50000 },
      { label: "Cuota 30/30", amountCents: 50000 },
      { label: "Abono adicional", amountCents: 20000 }
    ]);
    expect(sum(live)).toBe(total);
  });

  it("AC6: exactly one cuota is unchanged", async () => {
    const { live } = await collect(paidCuotas(4), 50000);
    expect(live).toEqual([{ label: "Cuota 5/30", amountCents: 50000 }]);
  });

  it("AC7: lines always add up to the cobro total", async () => {
    for (const [amount, mora] of [
      [220000, 0],
      [230000, 30000],
      [10000, 0]
    ] as const) {
      const { live, reprints, total } = await collect(paidCuotas(4), amount, mora);
      expect(sum(live)).toBe(total);
      for (const reprint of reprints) expect(reprint).toEqual(live);
    }
  });

  it("AC9: Saldar collapses a run of 7+ cuotas; 6 still list one line each", async () => {
    const settle = await collect(paidCuotas(4), 1300000);
    expect(settle.live).toEqual([{ label: "Cuotas 5-30/30", amountCents: 1300000 }]);
    expect(settle.reprints[0]).toEqual(settle.live);

    const six = await collect(paidCuotas(4), 300000);
    expect(six.live.map((l) => l.label)).toEqual([
      "Cuota 5/30",
      "Cuota 6/30",
      "Cuota 7/30",
      "Cuota 8/30",
      "Cuota 9/30",
      "Cuota 10/30"
    ]);
  });
});

describe("Histórico de Pagos", () => {
  it("AC8: titles, second lines and cuotas pagadas follow the #204 table", () => {
    const rows = [
      pay(200000, day(1)),
      pay(220000, day(8)),
      pay(30000, day(12)),
      pay(20000, day(15), "cuota")
    ];
    const view = buildPaymentHistoryView(loan, rows);
    expect(view.installmentsPaid).toBe(9);
    expect(view.entries.map((e) => [e.label, e.subLabel.replace(/ · Recibo #R-\d+/, "")])).toEqual([
      ["Abono a cuota 10", "Abono parcial · Efectivo"],
      ["Cuota 9", "Completa la cuota · Efectivo"],
      ["Cuotas 5–8 + abono", "4 cuotas + RD$200 · Efectivo"],
      ["Cuotas 1–4", "4 cuotas · Efectivo"]
    ]);
  });

  it("AC10: a multi-cuota payment no longer shifts later numbering", () => {
    const weekly: Loan = {
      ...loan,
      id: "loan-w",
      principalCents: 2880000,
      interestRateBps: 1000,
      termCount: 12,
      frequency: "weekly"
    };
    const rows = [264000, 1056000, 264000].map((amount, i) => ({
      ...pay(amount, day(7 * (i + 1))),
      loanId: weekly.id
    }));
    const view = buildPaymentHistoryView(weekly, rows);
    expect(view.installmentsPaid).toBe(6);
    expect(view.entries.map((e) => e.label)).toEqual(["Cuota 6", "Cuotas 2–5", "Cuota 1"]);

    const reprint = buildPaymentReceipt(rows[1]!.id, weekly, customer, rows)!;
    expect(reprint.lines).toEqual([
      { label: "Cuota 2/12", amountCents: 264000 },
      { label: "Cuota 3/12", amountCents: 264000 },
      { label: "Cuota 4/12", amountCents: 264000 },
      { label: "Cuota 5/12", amountCents: 264000 }
    ]);
    expect(buildPaymentReceipt(rows[2]!.id, weekly, customer, rows)!.lines).toEqual([
      { label: "Cuota 6/12", amountCents: 264000 }
    ]);
  });

  it("AC11: two principal rows on the same paidAt are ordered by createdAt and both covered", () => {
    const at = day(5);
    const later = pay(50000, at, "cuota", new Date(at.getTime() + 1000));
    const earlier = pay(30000, at, "cuota", at);
    const rows = [...paidCuotas(4), later, earlier];
    const reprint = buildPaymentReceipt(later.id, loan, customer, rows)!;
    expect(reprint.lines).toEqual([
      { label: "Cuota 5/30", amountCents: 50000 },
      { label: "Abono a cuota 6/30", amountCents: 30000 }
    ]);
    const view = buildPaymentHistoryView(loan, rows);
    const byId = new Map(view.entries.map((e) => [e.id, e.label]));
    expect(byId.get(earlier.id)).toBe("Abono a cuota 5");
    expect(byId.get(later.id)).toBe("Cuota 5 + abono");
  });
});
