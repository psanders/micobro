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
  readRange: jest.fn().mockResolvedValue([])
}));

import { pushPendingMutations } from "../lib/sync/push";
import { appendRow, updateRow, readRange } from "../lib/sync/sheetsClient";
import type { Database } from "../lib/db/client";

const appendRowMock = appendRow as jest.Mock;
const updateRowMock = updateRow as jest.Mock;
const readRangeMock = readRange as jest.Mock;

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
      "Clientes!A3:F3",
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
    expect(appendRowMock).toHaveBeenCalledWith("sheet-1", "Préstamos!A:K", [
      "loan-1",
      "customer-1",
      500000,
      1000,
      12,
      "weekly",
      "2026-01-01T00:00:00.000Z",
      "active",
      "",
      "2026-01-01T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z"
    ]);
    expect(result).toEqual({ pushed: 1, failed: 0 });
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
      "Préstamos!A2:K2",
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
