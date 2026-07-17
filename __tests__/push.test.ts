/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * appendRow can only add rows, so an "update" mutation must stay queued
 * rather than being pushed as a duplicate row — see the comment in
 * lib/sync/push.ts.
 */
jest.mock("../lib/sync/config", () => ({
  getSheetId: jest.fn().mockResolvedValue("sheet-1")
}));

jest.mock("../lib/sync/sheetsClient", () => ({
  appendRow: jest.fn().mockResolvedValue(undefined)
}));

import { pushPendingMutations } from "../lib/sync/push";
import { appendRow } from "../lib/sync/sheetsClient";
import type { Database } from "../lib/db/client";

const appendRowMock = appendRow as jest.Mock;

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

  it("skips update mutations instead of appending a duplicate row", async () => {
    // Arrange
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
    expect(appendRowMock).not.toHaveBeenCalled();
    expect(result).toEqual({ pushed: 0, failed: 0 });
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
    "skips %s update mutations instead of appending a duplicate row",
    async (entity) => {
      // Arrange
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
      expect(appendRowMock).not.toHaveBeenCalled();
      expect(result).toEqual({ pushed: 0, failed: 0 });
    }
  );
});
