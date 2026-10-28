/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Tradicional Plus design §5: the Penalidad column is appended at Préstamos!Q,
 * so older Sheets only need Q1 labeled — written once when it's empty
 * (decided from the Sheet), never moving a cell, and never throwing.
 */
jest.mock("../lib/sync/sheetsClient", () => ({
  readRange: jest.fn(),
  writeHeaderRow: jest.fn().mockResolvedValue(undefined)
}));

import { ensurePenaltyHeader } from "../lib/sync/prestamosLayout";
import { readRange, writeHeaderRow } from "../lib/sync/sheetsClient";
import type { Database } from "../lib/db/client";

const readRangeMock = readRange as jest.Mock;
const writeMock = writeHeaderRow as jest.Mock;

/** `flag` is the stored prestamosPenaltyHeader value, or null when never confirmed. */
function makeDbStub(flag: string | null) {
  const where = jest.fn().mockResolvedValue(flag === null ? [] : [{ value: flag }]);
  const select = jest.fn().mockReturnValue({ from: jest.fn().mockReturnValue({ where }) });
  const onConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
  const values = jest.fn().mockReturnValue({ onConflictDoUpdate });
  const insert = jest.fn().mockReturnValue({ values });
  return { db: { select, insert } as unknown as Database, values };
}

describe("ensurePenaltyHeader", () => {
  beforeEach(() => {
    readRangeMock.mockReset();
    writeMock.mockReset().mockResolvedValue(undefined);
  });

  it("labels an empty Q1 on an older Sheet and records it", async () => {
    readRangeMock.mockResolvedValue([]);
    const { db, values } = makeDbStub(null);

    await ensurePenaltyHeader(db, "sheet-1");

    expect(readRangeMock).toHaveBeenCalledWith("sheet-1", "Préstamos!Q1:Q1");
    expect(writeMock).toHaveBeenCalledWith("sheet-1", "Préstamos!Q1", ["Penalidad (centavos)"]);
    expect(values).toHaveBeenCalledWith({ key: "prestamosPenaltyHeader", value: "1" });
  });

  it("leaves an already-labeled Q1 alone", async () => {
    readRangeMock.mockResolvedValue([["Penalidad (centavos)"]]);
    const { db, values } = makeDbStub(null);

    await ensurePenaltyHeader(db, "sheet-1");

    expect(writeMock).not.toHaveBeenCalled();
    expect(values).toHaveBeenCalled();
  });

  it("skips the Sheet once confirmed on this device", async () => {
    const { db } = makeDbStub("1");

    await ensurePenaltyHeader(db, "sheet-1");

    expect(readRangeMock).not.toHaveBeenCalled();
  });

  it("doesn't throw or record anything when the Sheet can't be reached", async () => {
    readRangeMock.mockRejectedValue(new Error("offline"));
    const { db, values } = makeDbStub(null);

    await expect(ensurePenaltyHeader(db, "sheet-1")).resolves.toBeUndefined();
    expect(values).not.toHaveBeenCalled();
  });
});
