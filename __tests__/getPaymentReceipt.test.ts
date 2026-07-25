/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: payment-history "Ver recibo desde el historial" — the DB-wiring
 * layer around the pure `buildPaymentReceipt` builder (already covered in
 * loanViews.test.ts): the payment/loan/customer lookups and their
 * null-fallback branches.
 */
import { createGetPaymentReceipt } from "../lib/payments/getPaymentReceipt";
import { ValidationError } from "../lib/errors/ValidationError";
import { loans, payments } from "../lib/db/schema";
import type { Database } from "../lib/db/client";

const paidAt = new Date("2026-07-17T22:41:00");

const loanRow = {
  id: "loan-1",
  customerId: "customer-1",
  principalCents: 2880000,
  interestRateBps: 1000,
  termCount: 12,
  frequency: "weekly",
  startDate: new Date("2026-06-26T00:00:00"),
  status: "active",
  notes: null,
  createdAt: new Date("2026-06-26T00:00:00"),
  updatedAt: new Date("2026-06-26T00:00:00")
};

const customerRow = { id: "customer-1", name: "María Rosa Peralta" };

const paymentRow = {
  id: "payment-1",
  loanId: "loan-1",
  amountCents: 264000,
  paidAt,
  method: "cash",
  notes: null,
  createdAt: paidAt
};

function makeDbStub({
  paymentRows = [] as unknown[],
  loanRows = [] as unknown[],
  customerRows = [] as unknown[]
}) {
  const from = jest.fn((table: unknown) => {
    const rows = table === payments ? paymentRows : table === loans ? loanRows : customerRows;
    const result = Promise.resolve(rows) as Promise<unknown[]> & { where: jest.Mock };
    result.where = jest.fn().mockResolvedValue(rows);
    return result;
  });
  return { select: jest.fn(() => ({ from })), from } as unknown as Database & {
    select: jest.Mock;
    from: jest.Mock;
  };
}

describe("createGetPaymentReceipt", () => {
  it("resolves the payment's loan and customer into a full receipt", async () => {
    const db = makeDbStub({
      paymentRows: [paymentRow],
      loanRows: [loanRow],
      customerRows: [customerRow]
    });
    const getPaymentReceipt = createGetPaymentReceipt({ db: db as unknown as Database });

    const receipt = await getPaymentReceipt({ paymentId: "payment-1" });

    expect(receipt).not.toBeNull();
    expect(receipt!.customerName).toBe("María Rosa Peralta");
    expect(receipt!.totalCents).toBe(264000);
    expect(receipt!.lines).toEqual([{ label: "Cuota 1/12", amountCents: 264000 }]);
  });

  it("returns null when no payment matches the id", async () => {
    const db = makeDbStub({ paymentRows: [], loanRows: [loanRow], customerRows: [customerRow] });
    const getPaymentReceipt = createGetPaymentReceipt({ db: db as unknown as Database });

    expect(await getPaymentReceipt({ paymentId: "does-not-exist" })).toBeNull();
  });

  it("returns null when the payment's loan can't be found", async () => {
    const db = makeDbStub({ paymentRows: [paymentRow], loanRows: [], customerRows: [customerRow] });
    const getPaymentReceipt = createGetPaymentReceipt({ db: db as unknown as Database });

    expect(await getPaymentReceipt({ paymentId: "payment-1" })).toBeNull();
  });

  it("returns null when the loan's customer can't be found", async () => {
    const db = makeDbStub({ paymentRows: [paymentRow], loanRows: [loanRow], customerRows: [] });
    const getPaymentReceipt = createGetPaymentReceipt({ db: db as unknown as Database });

    expect(await getPaymentReceipt({ paymentId: "payment-1" })).toBeNull();
  });

  it("throws ValidationError and never touches the database for an empty paymentId", async () => {
    const db = makeDbStub({});
    const getPaymentReceipt = createGetPaymentReceipt({ db: db as unknown as Database });

    await expect(getPaymentReceipt({ paymentId: "" })).rejects.toBeInstanceOf(ValidationError);
    expect(db.select).not.toHaveBeenCalled();
  });
});
