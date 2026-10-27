/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: google-connect "An existing Clientes tab is moved to the Cédula
 * layout once" and pull-two-way-sync "Customer sync waits for the Cédula
 * layout" — the column is inserted only when C1 isn't "Cédula" (decided from
 * the Sheet, so a reinstall can't insert it twice), and a failure leaves the
 * layout unconfirmed instead of throwing.
 */
jest.mock("../lib/sync/sheetsClient", () => ({
  readRange: jest.fn(),
  insertColumnWithHeader: jest.fn().mockResolvedValue(undefined)
}));

import { ensureClientesLayout, isClientesLayoutReady } from "../lib/sync/clientesLayout";
import { insertColumnWithHeader, readRange } from "../lib/sync/sheetsClient";
import type { Database } from "../lib/db/client";

const readRangeMock = readRange as jest.Mock;
const insertMock = insertColumnWithHeader as jest.Mock;

/** `flag` is the stored clientesLayoutVersion, or null when never confirmed. */
function makeDbStub(flag: string | null) {
  const where = jest.fn().mockResolvedValue(flag === null ? [] : [{ value: flag }]);
  const select = jest.fn().mockReturnValue({ from: jest.fn().mockReturnValue({ where }) });
  const onConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
  const values = jest.fn().mockReturnValue({ onConflictDoUpdate });
  const insert = jest.fn().mockReturnValue({ values });
  return { db: { select, insert } as unknown as Database, values };
}

describe("ensureClientesLayout", () => {
  beforeEach(() => {
    readRangeMock.mockReset();
    insertMock.mockReset().mockResolvedValue(undefined);
  });

  it("inserts the Cédula column into a pre-Cédula tab and records it", async () => {
    readRangeMock.mockResolvedValue([["Teléfono"]]);
    const { db, values } = makeDbStub(null);

    const ready = await ensureClientesLayout(db, "sheet-1");

    expect(readRangeMock).toHaveBeenCalledWith("sheet-1", "Clientes!C1:C1");
    expect(insertMock).toHaveBeenCalledWith("sheet-1", "Clientes", 2, "Cédula");
    expect(values).toHaveBeenCalledWith({ key: "clientesLayoutVersion", value: "1" });
    expect(ready).toBe(true);
  });

  it("never inserts when C1 already reads Cédula, even with no local record", async () => {
    readRangeMock.mockResolvedValue([["Cédula"]]);
    const { db, values } = makeDbStub(null);

    const ready = await ensureClientesLayout(db, "sheet-1");

    expect(insertMock).not.toHaveBeenCalled();
    expect(values).toHaveBeenCalledWith({ key: "clientesLayoutVersion", value: "1" });
    expect(ready).toBe(true);
  });

  it("skips the Sheet entirely once the layout is confirmed on this device", async () => {
    const { db } = makeDbStub("1");

    const ready = await ensureClientesLayout(db, "sheet-1");

    expect(readRangeMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
    expect(ready).toBe(true);
  });

  it("returns false and records nothing when the Sheet can't be reached", async () => {
    readRangeMock.mockRejectedValue(new Error("Network request failed"));
    const { db, values } = makeDbStub(null);

    const ready = await ensureClientesLayout(db, "sheet-1");

    expect(ready).toBe(false);
    expect(values).not.toHaveBeenCalled();
  });

  it("returns false and records nothing when the insert fails", async () => {
    readRangeMock.mockResolvedValue([["Teléfono"]]);
    insertMock.mockRejectedValue(new Error("Sheets batchUpdate failed (500)"));
    const { db, values } = makeDbStub(null);

    const ready = await ensureClientesLayout(db, "sheet-1");

    expect(ready).toBe(false);
    expect(values).not.toHaveBeenCalled();
  });
});

describe("isClientesLayoutReady", () => {
  it("is false until the layout has been confirmed", async () => {
    expect(await isClientesLayoutReady(makeDbStub(null).db)).toBe(false);
    expect(await isClientesLayoutReady(makeDbStub("1").db)).toBe(true);
  });
});
