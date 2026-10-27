/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * "update" mutations are written back to the existing Sheet row in place
 * (findRowNumber + updateRow) rather than appended as a duplicate — see
 * the comment in lib/sync/push.ts. If the row was never pushed (not found
 * by id), push self-heals by appending it as if it were a create.
 */
jest.mock("../lib/sync/config", () => ({
  getSheetId: jest.fn().mockResolvedValue("sheet-1")
}));

jest.mock("../lib/sync/sheetsClient", () => ({
  appendRow: jest.fn().mockResolvedValue(undefined),
  updateRow: jest.fn().mockResolvedValue(undefined),
  readRange: jest.fn().mockResolvedValue([]),
  deleteRows: jest.fn().mockResolvedValue(undefined)
}));

jest.mock("../lib/sync/clientesLayout", () => ({
  ensureClientesLayout: jest.fn().mockResolvedValue(true)
}));

const mockQueueCedulaResend = jest.fn().mockResolvedValue(0);
jest.mock("../lib/sync/queueCedulaResend", () => ({
  createQueueCedulaResend: () => mockQueueCedulaResend
}));

import { pushPendingMutations } from "../lib/sync/push";
import { ensureClientesLayout } from "../lib/sync/clientesLayout";
import { appendRow, updateRow, readRange, deleteRows } from "../lib/sync/sheetsClient";
import { customers, cashCloses, pendingMutations } from "../lib/db/schema";
import type { Database } from "../lib/db/client";

const appendRowMock = appendRow as jest.Mock;
const updateRowMock = updateRow as jest.Mock;
const readRangeMock = readRange as jest.Mock;
const ensureClientesLayoutMock = ensureClientesLayout as jest.Mock;
const deleteRowsMock = deleteRows as jest.Mock;

const basePayload = JSON.stringify({
  id: "customer-1",
  name: "Juana Pérez",
  phone: "8091234567",
  address: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
});

const loanPayload = JSON.stringify({
  id: "loan-1",
  customerId: "customer-1",
  principalCents: 500000,
  interestRateBps: 1000,
  termCount: 12,
  frequency: "weekly",
  startDate: "2026-01-01T00:00:00.000Z",
  status: "active",
  notes: null,
  graceDays: null,
  moraEnabled: null,
  moraRateBps: null,
  skipSundays: null,
  loanType: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
});

const paymentPayload = JSON.stringify({
  id: "payment-1",
  loanId: "loan-1",
  amountCents: 25000,
  paidAt: "2026-01-08T00:00:00.000Z",
  method: null,
  notes: null,
  createdAt: "2026-01-08T00:00:00.000Z"
});

const visitPayload = JSON.stringify({
  id: "visit-1",
  customerId: "customer-1",
  loanId: "loan-1",
  outcome: "promise",
  promiseDate: null,
  promiseAmountCents: null,
  note: null,
  createdAt: "2026-01-08T00:00:00.000Z"
});

const cashClosePayload = JSON.stringify({
  id: "close-1",
  amountCents: 500000,
  periodStart: null,
  closedAt: "2026-01-08T00:00:00.000Z",
  createdAt: "2026-01-08T00:00:00.000Z"
});

function makeDbStub(mutations: Record<string, unknown>[]) {
  const selectWhere = jest.fn().mockResolvedValue(mutations);
  const from = jest.fn().mockReturnValue({ where: selectWhere });
  const select = jest.fn().mockReturnValue({ from });

  const deleteWhere = jest.fn().mockResolvedValue(undefined);
  const del = jest.fn().mockReturnValue({ where: deleteWhere });

  const updateWhere = jest.fn().mockResolvedValue(undefined);
  const set = jest.fn().mockReturnValue({ where: updateWhere });
  const update = jest.fn().mockReturnValue({ set });

  const onConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
  const values = jest.fn().mockReturnValue({ onConflictDoUpdate });
  const insert = jest.fn().mockReturnValue({ values });

  return { select, from, delete: del, update, insert } as unknown as Database;
}

describe("pushPendingMutations", () => {
  beforeEach(() => {
    appendRowMock.mockClear();
    updateRowMock.mockClear();
    readRangeMock.mockReset().mockResolvedValue([]);
    ensureClientesLayoutMock.mockReset().mockResolvedValue(true);
    mockQueueCedulaResend.mockClear();
  });

  it("writes the customer's cédula formatted, right after the name", async () => {
    const mutation = {
      id: "m-ced",
      entity: "customer",
      entityId: "customer-1",
      operation: "create",
      payload: JSON.stringify({ ...JSON.parse(basePayload), cedula: "00112345678" }),
      status: "pending",
      retryCount: 0
    };

    await pushPendingMutations(makeDbStub([mutation]));

    expect(appendRowMock).toHaveBeenCalledWith("sheet-1", "Clientes!A:G", [
      "customer-1",
      "Juana Pérez",
      "001-1234567-8",
      "8091234567",
      "",
      "2026-01-01T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z"
    ]);
  });

  it("leaves the Cédula cell empty for a customer without one", async () => {
    const mutation = {
      id: "m-noced",
      entity: "customer",
      entityId: "customer-1",
      operation: "create",
      payload: basePayload,
      status: "pending",
      retryCount: 0
    };

    await pushPendingMutations(makeDbStub([mutation]));

    expect(appendRowMock.mock.calls[0][2][2]).toBe("");
  });

  it("queues the one-time cédula re-send before reading the pending queue", async () => {
    const db = makeDbStub([]);

    await pushPendingMutations(db);

    expect(mockQueueCedulaResend).toHaveBeenCalledTimes(1);
    expect(mockQueueCedulaResend.mock.invocationCallOrder[0]).toBeLessThan(
      (db.select as jest.Mock).mock.invocationCallOrder[0]
    );
  });

  it("holds customer mutations, untouched, while the Clientes layout is unconfirmed, and still pushes other entities", async () => {
    ensureClientesLayoutMock.mockResolvedValue(false);
    const customerMutation = {
      id: "m-cust",
      entity: "customer",
      entityId: "customer-1",
      operation: "create",
      payload: basePayload,
      status: "pending",
      retryCount: 0
    };
    const loanMutation = {
      id: "m-loan",
      entity: "loan",
      entityId: "loan-1",
      operation: "create",
      payload: loanPayload,
      status: "pending",
      retryCount: 0
    };
    const db = makeDbStub([customerMutation, loanMutation]);

    const result = await pushPendingMutations(db);

    expect(appendRowMock).toHaveBeenCalledTimes(1);
    expect(appendRowMock.mock.calls[0][1]).toBe("Préstamos!A:P");
    // Only the loan is cleared; the customer's row is neither deleted nor marked failed.
    expect(db.delete).toHaveBeenCalledTimes(1);
    expect(db.update).not.toHaveBeenCalledWith(pendingMutations);
    expect(result).toEqual({ pushed: 1, failed: 0 });
  });

  it("pushes create mutations and clears them from the queue", async () => {
    // Arrange
    const mutation = {
      id: "m1",
      entity: "customer",
      entityId: "customer-1",
      operation: "create",
      payload: basePayload,
      status: "pending",
      retryCount: 0
    };
    const db = makeDbStub([mutation]);

    // Act
    const result = await pushPendingMutations(db);

    // Assert
    expect(appendRowMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ pushed: 1, failed: 0 });
  });

  it("pushes a payment's stored cents to the Sheet unchanged (whole-peso rounding never alters sync)", async () => {
    // Arrange — RD$1,105 stored as 110500 cents
    const mutation = {
      id: "m-pay",
      entity: "payment",
      entityId: "payment-1",
      operation: "create",
      payload: JSON.stringify({ ...JSON.parse(paymentPayload), amountCents: 110500 }),
      status: "pending",
      retryCount: 0
    };
    const db = makeDbStub([mutation]);

    // Act
    await pushPendingMutations(db);

    // Assert — the amount column carries the raw stored value
    const row = appendRowMock.mock.calls[0]![2] as (string | number | null)[];
    expect(row).toContain(110500);
  });

  it("retries a failed mutation below the retry cap instead of leaving it stuck", async () => {
    // Arrange: a row that failed once already, but hasn't exhausted MAX_RETRIES
    const mutation = {
      id: "m-retry",
      entity: "customer",
      entityId: "customer-1",
      operation: "create",
      payload: basePayload,
      status: "failed",
      retryCount: 1
    };
    const db = makeDbStub([mutation]);

    // Act
    const result = await pushPendingMutations(db);

    // Assert: the retryable failed row is retried, not silently skipped
    expect(appendRowMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ pushed: 1, failed: 0 });
  });

  it("updates the existing Sheet row in place for an update mutation", async () => {
    // Arrange: row "customer-1" already lives at sheet row 3 (header + 2 rows above it)
    readRangeMock.mockResolvedValueOnce([["ID"], ["customer-0"], ["customer-1"]]);
    const mutation = {
      id: "m2",
      entity: "customer",
      entityId: "customer-1",
      operation: "update",
      payload: basePayload,
      status: "pending",
      retryCount: 0
    };
    const db = makeDbStub([mutation]);

    // Act
    const result = await pushPendingMutations(db);

    // Assert
    expect(readRangeMock).toHaveBeenCalledWith("sheet-1", "Clientes!A:A");
    expect(updateRowMock).toHaveBeenCalledWith(
      "sheet-1",
      "Clientes!A3:G3",
      expect.arrayContaining(["customer-1"])
    );
    expect(appendRowMock).not.toHaveBeenCalled();
    expect(result).toEqual({ pushed: 1, failed: 0 });
  });

  it("self-heals by appending an update mutation whose row was never pushed", async () => {
    // Arrange: the id column has no row matching this entity's id
    readRangeMock.mockResolvedValueOnce([["ID"], ["customer-0"]]);
    const mutation = {
      id: "m2b",
      entity: "customer",
      entityId: "customer-1",
      operation: "update",
      payload: basePayload,
      status: "pending",
      retryCount: 0
    };
    const db = makeDbStub([mutation]);

    // Act
    const result = await pushPendingMutations(db);

    // Assert
    expect(updateRowMock).not.toHaveBeenCalled();
    expect(appendRowMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ pushed: 1, failed: 0 });
  });

  it("pushes a loan create mutation to the Préstamos range in schema column order", async () => {
    // Arrange
    const mutation = {
      id: "m3",
      entity: "loan",
      entityId: "loan-1",
      operation: "create",
      payload: loanPayload,
      status: "pending",
      retryCount: 0
    };
    const db = makeDbStub([mutation]);

    // Act
    const result = await pushPendingMutations(db);

    // Assert
    expect(appendRowMock).toHaveBeenCalledWith("sheet-1", "Préstamos!A:P", [
      "loan-1",
      "customer-1",
      500000,
      1000,
      12,
      "weekly",
      "2026-01-01T00:00:00.000Z",
      "active",
      "",
      "",
      "",
      "",
      "",
      "",
      "2026-01-01T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z"
    ]);
    expect(result).toEqual({ pushed: 1, failed: 0 });
  });

  it("emits mora columns losslessly for an enabled loan with a custom rate", async () => {
    // Arrange
    const moraLoanPayload = JSON.stringify({
      id: "loan-2",
      customerId: "customer-1",
      principalCents: 500000,
      interestRateBps: 1000,
      termCount: 12,
      frequency: "weekly",
      startDate: "2026-01-01T00:00:00.000Z",
      status: "active",
      notes: null,
      graceDays: null,
      moraEnabled: true,
      moraRateBps: 1500,
      skipSundays: null,
      loanType: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    });
    const mutation = {
      id: "m3c",
      entity: "loan",
      entityId: "loan-2",
      operation: "create",
      payload: moraLoanPayload,
      status: "pending",
      retryCount: 0
    };
    const db = makeDbStub([mutation]);

    // Act
    await pushPendingMutations(db);

    // Assert
    expect(appendRowMock).toHaveBeenCalledWith(
      "sheet-1",
      "Préstamos!A:P",
      expect.arrayContaining(["TRUE", 1500])
    );
  });

  it("emits FALSE for a loan with mora explicitly disabled", async () => {
    // Arrange
    const disabledMoraPayload = JSON.stringify({
      id: "loan-3",
      customerId: "customer-1",
      principalCents: 500000,
      interestRateBps: 1000,
      termCount: 12,
      frequency: "weekly",
      startDate: "2026-01-01T00:00:00.000Z",
      status: "active",
      notes: null,
      graceDays: null,
      moraEnabled: false,
      moraRateBps: null,
      skipSundays: null,
      loanType: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    });
    const mutation = {
      id: "m3d",
      entity: "loan",
      entityId: "loan-3",
      operation: "create",
      payload: disabledMoraPayload,
      status: "pending",
      retryCount: 0
    };
    const db = makeDbStub([mutation]);

    // Act
    await pushPendingMutations(db);

    // Assert
    expect(appendRowMock).toHaveBeenCalledWith(
      "sheet-1",
      "Préstamos!A:P",
      expect.arrayContaining(["FALSE", ""])
    );
  });

  it("emits skip_sundays losslessly for a daily loan with Saltar domingos on", async () => {
    // Arrange
    const skipSundaysPayload = JSON.stringify({
      id: "loan-4",
      customerId: "customer-1",
      principalCents: 500000,
      interestRateBps: 1000,
      termCount: 30,
      frequency: "daily",
      startDate: "2026-01-01T00:00:00.000Z",
      status: "active",
      notes: null,
      graceDays: null,
      moraEnabled: null,
      moraRateBps: null,
      skipSundays: true,
      loanType: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    });
    const mutation = {
      id: "m3e",
      entity: "loan",
      entityId: "loan-4",
      operation: "create",
      payload: skipSundaysPayload,
      status: "pending",
      retryCount: 0
    };
    const db = makeDbStub([mutation]);

    // Act
    await pushPendingMutations(db);

    // Assert
    expect(appendRowMock).toHaveBeenCalledWith(
      "sheet-1",
      "Préstamos!A:P",
      expect.arrayContaining(["TRUE"])
    );
  });

  it("emits blank skip_sundays for a loan that never set it", async () => {
    // Arrange — loanPayload has skipSundays: null, same as an unset loan
    const mutation = {
      id: "m3f",
      entity: "loan",
      entityId: "loan-1",
      operation: "create",
      payload: loanPayload,
      status: "pending",
      retryCount: 0
    };
    const db = makeDbStub([mutation]);

    // Act
    await pushPendingMutations(db);

    // Assert — skip_sundays is the 2nd-to-last column before loanType/createdAt/updatedAt
    const values = appendRowMock.mock.calls[0][2] as unknown[];
    expect(values[values.length - 4]).toBe("");
  });

  it("emits loanType losslessly for an open-credit loan", async () => {
    // Arrange
    const openCreditPayload = JSON.stringify({
      id: "loan-5",
      customerId: "customer-1",
      principalCents: 1000000,
      interestRateBps: 500,
      termCount: 0,
      frequency: "weekly",
      startDate: "2026-01-01T00:00:00.000Z",
      status: "active",
      notes: null,
      graceDays: null,
      moraEnabled: null,
      moraRateBps: null,
      skipSundays: null,
      loanType: "open_credit",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    });
    const mutation = {
      id: "m3g",
      entity: "loan",
      entityId: "loan-5",
      operation: "create",
      payload: openCreditPayload,
      status: "pending",
      retryCount: 0
    };
    const db = makeDbStub([mutation]);

    // Act
    await pushPendingMutations(db);

    // Assert
    expect(appendRowMock).toHaveBeenCalledWith(
      "sheet-1",
      "Préstamos!A:P",
      expect.arrayContaining(["open_credit"])
    );
  });

  it("emits blank loanType for a term loan (loanType: null)", async () => {
    // Arrange — loanPayload has loanType: null, same as an unset (term) loan
    const mutation = {
      id: "m3h",
      entity: "loan",
      entityId: "loan-1",
      operation: "create",
      payload: loanPayload,
      status: "pending",
      retryCount: 0
    };
    const db = makeDbStub([mutation]);

    // Act
    await pushPendingMutations(db);

    // Assert — loanType is the column immediately before createdAt/updatedAt
    const values = appendRowMock.mock.calls[0][2] as unknown[];
    expect(values[values.length - 3]).toBe("");
  });

  it("updates the existing Préstamos row in place for a loan update mutation", async () => {
    // Arrange: "loan-1" already lives at sheet row 2 (header + this one row)
    readRangeMock.mockResolvedValueOnce([["ID"], ["loan-1"]]);
    const mutation = {
      id: "m3b",
      entity: "loan",
      entityId: "loan-1",
      operation: "update",
      payload: loanPayload,
      status: "pending",
      retryCount: 0
    };
    const db = makeDbStub([mutation]);

    // Act
    const result = await pushPendingMutations(db);

    // Assert
    expect(readRangeMock).toHaveBeenCalledWith("sheet-1", "Préstamos!A:A");
    expect(updateRowMock).toHaveBeenCalledWith(
      "sheet-1",
      "Préstamos!A2:P2",
      expect.arrayContaining(["loan-1"])
    );
    expect(appendRowMock).not.toHaveBeenCalled();
    expect(result).toEqual({ pushed: 1, failed: 0 });
  });

  it("pushes a payment create mutation to the Pagos range in schema column order", async () => {
    // Arrange
    const mutation = {
      id: "m4",
      entity: "payment",
      entityId: "payment-1",
      operation: "create",
      payload: paymentPayload,
      status: "pending",
      retryCount: 0
    };
    const db = makeDbStub([mutation]);

    // Act
    const result = await pushPendingMutations(db);

    // Assert
    expect(appendRowMock).toHaveBeenCalledWith("sheet-1", "Pagos!A:G", [
      "payment-1",
      "loan-1",
      25000,
      "2026-01-08T00:00:00.000Z",
      "",
      "",
      "2026-01-08T00:00:00.000Z"
    ]);
    expect(result).toEqual({ pushed: 1, failed: 0 });
  });

  it("pushes a visit create mutation to the Visitas range in schema column order", async () => {
    // Arrange
    const mutation = {
      id: "m5",
      entity: "visit",
      entityId: "visit-1",
      operation: "create",
      payload: visitPayload,
      status: "pending",
      retryCount: 0
    };
    const db = makeDbStub([mutation]);

    // Act
    const result = await pushPendingMutations(db);

    // Assert
    expect(appendRowMock).toHaveBeenCalledWith("sheet-1", "Visitas!A:H", [
      "visit-1",
      "customer-1",
      "loan-1",
      "promise",
      "",
      "",
      "",
      "2026-01-08T00:00:00.000Z"
    ]);
    expect(result).toEqual({ pushed: 1, failed: 0 });
  });

  it("pushes a cashClose create mutation to the Cierres range in schema column order", async () => {
    // Arrange
    const mutation = {
      id: "m7",
      entity: "cashClose",
      entityId: "close-1",
      operation: "create",
      payload: cashClosePayload,
      status: "pending",
      retryCount: 0
    };
    const db = makeDbStub([mutation]);

    // Act
    const result = await pushPendingMutations(db);

    // Assert
    expect(appendRowMock).toHaveBeenCalledWith("sheet-1", "Cierres!A:E", [
      "close-1",
      500000,
      "",
      "2026-01-08T00:00:00.000Z",
      "2026-01-08T00:00:00.000Z"
    ]);
    expect(result).toEqual({ pushed: 1, failed: 0 });
  });

  it.each(["loan", "payment", "visit"] as const)(
    "self-heals a %s update mutation not found remotely by appending it",
    async (entity) => {
      // Arrange: update routing isn't special-cased to "customer" — any
      // entity's update mutation falls back to appendRow when its id isn't
      // found in the sheet (readRange defaults to [] in beforeEach)
      const payloadByEntity = { loan: loanPayload, payment: paymentPayload, visit: visitPayload };
      const mutation = {
        id: "m6",
        entity,
        entityId: `${entity}-1`,
        operation: "update",
        payload: payloadByEntity[entity],
        status: "pending",
        retryCount: 0
      };
      const db = makeDbStub([mutation]);

      // Act
      const result = await pushPendingMutations(db);

      // Assert
      expect(updateRowMock).not.toHaveBeenCalled();
      expect(appendRowMock).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ pushed: 1, failed: 0 });
    }
  );
});

describe("pushPendingMutations — pushedAt and delete mutations", () => {
  function makeTrackingDb(mutations: Record<string, unknown>[]) {
    const db = makeDbStub(mutations) as unknown as {
      update: jest.Mock;
      delete: jest.Mock;
    };
    const sets: { table: unknown; values: Record<string, unknown> }[] = [];
    db.update.mockImplementation((table: unknown) => ({
      set: (values: Record<string, unknown>) => {
        sets.push({ table, values });
        return { where: jest.fn().mockResolvedValue(undefined) };
      }
    }));
    return { db: db as unknown as Database, sets, deleteMock: db.delete };
  }

  const mutation = (overrides: Record<string, unknown>) => ({
    id: "m1",
    entity: "customer",
    entityId: "customer-1",
    operation: "create",
    payload: basePayload,
    status: "pending",
    retryCount: 0,
    ...overrides
  });

  beforeEach(() => {
    appendRowMock.mockReset().mockResolvedValue(undefined);
    updateRowMock.mockReset().mockResolvedValue(undefined);
    deleteRowsMock.mockReset().mockResolvedValue(undefined);
    readRangeMock.mockReset().mockResolvedValue([]);
  });

  it("stamps pushedAt on the local row after a successful push", async () => {
    // Arrange
    const { db, sets } = makeTrackingDb([mutation({})]);

    // Act
    await pushPendingMutations(db);

    // Assert
    const stamp = sets.find((s) => s.table === customers);
    expect(stamp?.values.pushedAt).toBeInstanceOf(Date);
  });

  it("does not stamp pushedAt when the push fails", async () => {
    // Arrange
    appendRowMock.mockRejectedValueOnce(new Error("offline"));
    const { db, sets } = makeTrackingDb([mutation({})]);

    // Act
    const result = await pushPendingMutations(db);

    // Assert — the only update is the mutation's failed status
    expect(result).toEqual({ pushed: 0, failed: 1 });
    expect(sets.some((s) => s.table === customers)).toBe(false);
    expect(sets.find((s) => s.table === pendingMutations)?.values.status).toBe("failed");
  });

  it("never stamps a cash close (push-only, no pushedAt)", async () => {
    // Arrange
    const { db, sets } = makeTrackingDb([
      mutation({ entity: "cashClose", entityId: "close-1", payload: cashClosePayload })
    ]);

    // Act
    await pushPendingMutations(db);

    // Assert
    expect(sets.some((s) => s.table === cashCloses)).toBe(false);
  });

  it("deletes the Sheet row for a delete mutation", async () => {
    // Arrange: customer-1 sits at sheet row 3
    readRangeMock.mockResolvedValueOnce([["ID"], ["customer-0"], ["customer-1"]]);
    const { db } = makeTrackingDb([mutation({ operation: "delete", payload: "{}" })]);

    // Act
    const result = await pushPendingMutations(db);

    // Assert
    expect(deleteRowsMock).toHaveBeenCalledWith("sheet-1", "Clientes", [3]);
    expect(appendRowMock).not.toHaveBeenCalled();
    expect(result).toEqual({ pushed: 1, failed: 0 });
  });

  it("counts a delete as done when the row is already gone", async () => {
    // Arrange: readRange returns no matching id
    const { db, deleteMock } = makeTrackingDb([mutation({ operation: "delete", payload: "{}" })]);

    // Act
    const result = await pushPendingMutations(db);

    // Assert
    expect(deleteRowsMock).not.toHaveBeenCalled();
    expect(deleteMock).toHaveBeenCalledWith(pendingMutations);
    expect(result).toEqual({ pushed: 1, failed: 0 });
  });

  it("keeps a failed delete queued for a retry", async () => {
    // Arrange
    readRangeMock.mockResolvedValueOnce([["ID"], ["customer-1"]]);
    deleteRowsMock.mockRejectedValueOnce(new Error("503"));
    const { db, sets } = makeTrackingDb([mutation({ operation: "delete", payload: "{}" })]);

    // Act
    const result = await pushPendingMutations(db);

    // Assert
    expect(result).toEqual({ pushed: 0, failed: 1 });
    expect(sets.find((s) => s.table === pendingMutations)?.values).toMatchObject({
      status: "failed",
      retryCount: 1
    });
  });

  it("sends the row as it is locally for an empty-payload resend", async () => {
    // Arrange: first select is the queue, second is the customer row
    const row = {
      id: "customer-1",
      name: "Juana Restaurada",
      cedula: null,
      phone: "8091234567",
      address: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-03T00:00:00.000Z")
    };
    const { db } = makeTrackingDb([mutation({ operation: "update", payload: "" })]);
    const where = jest
      .fn()
      .mockResolvedValueOnce([mutation({ operation: "update", payload: "" })])
      .mockResolvedValueOnce([row]);
    (db as unknown as { select: jest.Mock }).select.mockReturnValue({
      from: () => ({ where })
    });

    // Act
    const result = await pushPendingMutations(db);

    // Assert — readRange defaults to [] so the update self-heals by appending
    expect(appendRowMock).toHaveBeenCalledWith(
      "sheet-1",
      "Clientes!A:G",
      expect.arrayContaining(["customer-1", "Juana Restaurada", "2026-01-03T00:00:00.000Z"])
    );
    expect(result).toEqual({ pushed: 1, failed: 0 });
  });

  it("drops an empty-payload resend whose row no longer exists", async () => {
    // Arrange
    const { db, deleteMock } = makeTrackingDb([]);
    const where = jest
      .fn()
      .mockResolvedValueOnce([mutation({ operation: "update", payload: "" })])
      .mockResolvedValueOnce([]);
    (db as unknown as { select: jest.Mock }).select.mockReturnValue({
      from: () => ({ where })
    });

    // Act
    const result = await pushPendingMutations(db);

    // Assert
    expect(appendRowMock).not.toHaveBeenCalled();
    expect(deleteMock).toHaveBeenCalledWith(pendingMutations);
    expect(result).toEqual({ pushed: 1, failed: 0 });
  });
});
