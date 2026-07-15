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
});
