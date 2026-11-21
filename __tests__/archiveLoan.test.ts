/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
jest.mock("expo-crypto", () => {
  let counter = 0;
  return { randomUUID: () => `uuid-${++counter}` };
});

import { createArchiveLoan } from "../lib/loans/archiveLoan";
import { totalRepayCents } from "../lib/loans/loanMath";
import { ValidationError } from "../lib/errors/ValidationError";
import type { Database } from "../lib/db/client";

const existingLoan = {
  id: "loan-1",
  customerId: "customer-1",
  principalCents: 1500000,
  interestRateBps: 1000,
  termCount: 12,
  frequency: "weekly",
  startDate: new Date("2026-10-13T00:00:00Z"),
  status: "active",
  notes: null,
  graceDays: null,
  moraEnabled: false,
  moraRateBps: null,
  skipSundays: null,
  loanType: null,
  createdAt: new Date("2026-10-13T00:00:00Z"),
  updatedAt: new Date("2026-10-13T00:00:00Z")
};

const payment = (amountCents: number, paidAt: Date, tipo = "cuota") => ({
  id: `p-${paidAt.getTime()}-${amountCents}`,
  loanId: "loan-1",
  amountCents,
  paidAt,
  method: "cash",
  notes: null,
  tipo,
  createdAt: paidAt
});

/** Each select(...).where(...) resolves to the next entry of `reads`, in call order. */
function makeDbStub(...reads: unknown[][]) {
  const where = jest.fn();
  for (const rows of reads) where.mockResolvedValueOnce(rows);
  const from = jest.fn().mockReturnValue({ where });
  const select = jest.fn().mockReturnValue({ from });

  const updateWhere = jest.fn().mockResolvedValue(undefined);
  const set = jest.fn().mockReturnValue({ where: updateWhere });
  const update = jest.fn().mockReturnValue({ set });

  const values = jest.fn().mockResolvedValue(undefined);
  const insert = jest.fn().mockReturnValue({ values });

  return { select, update, set, insert, values } as unknown as Database & Record<string, jest.Mock>;
}

describe("createArchiveLoan", () => {
  it("moves the loan from active to cancelled and enqueues a full-row update mutation", async () => {
    // Arrange
    const db = makeDbStub([existingLoan], []);
    const run = createArchiveLoan({ db });

    // Act
    const result = await run({ id: "loan-1" });

    // Assert
    expect(result.status).toBe("cancelled");
    expect(result.principalCents).toBe(existingLoan.principalCents);
    expect(db.set).toHaveBeenCalledWith(expect.objectContaining({ status: "cancelled" }));
    const mutation = (db as unknown as Record<string, jest.Mock>).values!.mock.calls[0][0];
    expect(mutation).toMatchObject({ entity: "loan", entityId: "loan-1", operation: "update" });
    expect(JSON.parse(mutation.payload)).toMatchObject({
      id: "loan-1",
      customerId: "customer-1",
      termCount: 12,
      status: "cancelled"
    });
  });

  it("never deletes anything", async () => {
    // Arrange
    const db = makeDbStub([existingLoan], []);
    const run = createArchiveLoan({ db });

    // Act
    await run({ id: "loan-1" });

    // Assert
    expect((db as unknown as Record<string, unknown>).delete).toBeUndefined();
    expect(db.update).toHaveBeenCalledTimes(1);
  });

  describe("paid or cancelled", () => {
    const archive = async (loan: Record<string, unknown>, payments: unknown[]) => {
      const db = makeDbStub([{ ...existingLoan, ...loan }], payments);
      const result = await createArchiveLoan({ db })({ id: "loan-1" });
      const payload = JSON.parse(
        (db as unknown as Record<string, jest.Mock>).values!.mock.calls[0][0].payload
      );
      return { status: result.status, synced: payload.status };
    };
    const repay = totalRepayCents(existingLoan.principalCents, existingLoan.interestRateBps);
    const paidAt = new Date("2026-11-01T00:00:00Z");

    it("marks a term loan whose cuotas are all paid as paid", async () => {
      expect(await archive({}, [payment(repay, paidAt)])).toEqual({
        status: "paid",
        synced: "paid"
      });
    });

    it("marks a term loan with cuotas left as cancelled", async () => {
      expect(await archive({}, [payment(repay - 1, paidAt)])).toEqual({
        status: "cancelled",
        synced: "cancelled"
      });
    });

    it("doesn't count mora toward paying the loan off", async () => {
      const payments = [payment(repay - 10000, paidAt), payment(10000, paidAt, "mora")];
      expect((await archive({}, payments)).status).toBe("cancelled");
    });

    it("marks a Tradicional Plus loan whose cuotas are all paid as paid", async () => {
      const plus = {
        loanType: "term_plus",
        frequency: "biweekly",
        termCount: 4,
        moraEnabled: false,
        graceDays: 3,
        penaltyCents: 30000
      };
      const payments = [payment(30000, paidAt, "penalidad"), payment(repay, paidAt)];
      expect((await archive(plus, payments)).status).toBe("paid");
      expect((await archive(plus, [payment(30000, paidAt, "penalidad")])).status).toBe("cancelled");
    });

    it("marks a crédito abierto whose capital is paid off as paid", async () => {
      // RD$15,000 @ 10% weekly: one cobro of the RD$1,500 interest plus all the capital.
      const openCredit = { loanType: "open_credit", termCount: 0 };
      const settle = payment(1650000, new Date("2026-10-15T00:00:00Z"));
      expect((await archive(openCredit, [settle])).status).toBe("paid");
    });

    it("marks a crédito abierto with capital left as cancelled", async () => {
      const openCredit = { loanType: "open_credit", termCount: 0 };
      const interestOnly = payment(150000, new Date("2026-10-15T00:00:00Z"));
      expect((await archive(openCredit, [interestOnly])).status).toBe("cancelled");
      expect((await archive(openCredit, [])).status).toBe("cancelled");
    });
  });

  it("refuses a loan already archived as paid", async () => {
    const db = makeDbStub([{ ...existingLoan, status: "paid" }], []);
    await expect(createArchiveLoan({ db })({ id: "loan-1" })).rejects.toThrow("ya está archivado");
    expect(db.update).not.toHaveBeenCalled();
  });

  it("refuses a loan in the wrong state and writes nothing", async () => {
    // Arrange
    const db = makeDbStub([{ ...existingLoan, status: "cancelled" }]);
    const run = createArchiveLoan({ db });

    // Act & Assert
    await expect(run({ id: "loan-1" })).rejects.toThrow("ya está archivado");
    expect(db.update).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("throws a ValidationError for an empty id and never touches the db", async () => {
    // Arrange
    const db = makeDbStub([existingLoan], []);
    const run = createArchiveLoan({ db });

    // Act & Assert
    await expect(run({ id: "" })).rejects.toBeInstanceOf(ValidationError);
    expect(db.select).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });
});
