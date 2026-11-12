/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: sync "The Pagos tab moves to the Tipo layout once" (issue #191 items
 * 10, 12) — decided from the Sheet (H1 "Tipo"), H filled from Notas' legacy
 * flags with H1 written last, column H protected, the flag cached only once
 * everything succeeded, and the notice raised only for a tab that had data.
 */
jest.mock("../lib/sync/sheetsClient", () => ({
  readRange: jest.fn(),
  writeCells: jest.fn().mockResolvedValue(undefined),
  ensureColumnProtection: jest.fn().mockResolvedValue(undefined)
}));

import {
  PAGOS_ADOPT_TIPO_KEY,
  PAGOS_LAYOUT_KEY,
  PAGOS_TIPO_NOTICE_KEY,
  ensurePagosLayout,
  isPagosTipoNoticePending
} from "../lib/sync/pagosLayout";
import { ensureColumnProtection, readRange, writeCells } from "../lib/sync/sheetsClient";
import { createTestDb } from "./helpers/testDb";
import type { Raw } from "./helpers/testDb";

const readRangeMock = readRange as jest.Mock;
const writeCellsMock = writeCells as jest.Mock;
const protectMock = ensureColumnProtection as jest.Mock;

const OLD_HEADER = ["ID", "Préstamo ID", "Monto (centavos)", "Pagado", "Método", "Notas", "Creado"];
const NEW_HEADER = [...OLD_HEADER, "Tipo"];
const dataRow = (id: string, notes: string, tipo = "") => [
  id,
  "l1",
  "1000",
  "2026-03-01T10:00:00.000Z",
  "cash",
  notes,
  "2026-03-01T10:00:00.000Z",
  tipo
];

const meta = (raw: Raw, key: string) =>
  (raw.prepare("SELECT value FROM sync_meta WHERE key = ?").all(key)[0]?.value as string) ?? null;

describe("ensurePagosLayout", () => {
  beforeEach(() => {
    readRangeMock.mockReset();
    writeCellsMock.mockReset().mockResolvedValue(undefined);
    protectMock.mockReset().mockResolvedValue(undefined);
  });

  it("fills H from F, clears the flags from F, writes H1 last, protects H and raises the notice", async () => {
    const { db, raw } = createTestDb();
    readRangeMock.mockResolvedValue([
      OLD_HEADER,
      dataRow("p1", "mora"),
      dataRow("p2", "penalidad"),
      dataRow("p3", "pagó tarde"),
      dataRow("p4", " mora "),
      ["", "", ""]
    ]);

    const ready = await ensurePagosLayout(db, "sheet-1");

    expect(ready).toBe(true);
    expect(readRangeMock).toHaveBeenCalledWith("sheet-1", "Pagos!A1:H");
    expect(writeCellsMock).toHaveBeenCalledTimes(1);
    expect(writeCellsMock.mock.calls[0]![1]).toEqual([
      { range: "Pagos!H2", values: [["mora"]] },
      { range: "Pagos!F2", values: [[""]] },
      { range: "Pagos!H3", values: [["penalidad"]] },
      { range: "Pagos!F3", values: [[""]] },
      { range: "Pagos!H4", values: [["cuota"]] },
      { range: "Pagos!H5", values: [["mora"]] },
      { range: "Pagos!F5", values: [[""]] },
      { range: "Pagos!H1", values: [["Tipo"]] }
    ]);
    expect(protectMock).toHaveBeenCalledWith("sheet-1", "Pagos", 7, "micobro:protected:tipo");
    expect(meta(raw, PAGOS_LAYOUT_KEY)).toBe("1");
    expect(meta(raw, PAGOS_TIPO_NOTICE_KEY)).toBe("pending");
    expect(await isPagosTipoNoticePending(db)).toBe(true);
    expect(meta(raw, PAGOS_ADOPT_TIPO_KEY)).toBeNull();
  });

  it("writes nothing on a Sheet another phone migrated, raises no notice and adopts H once", async () => {
    const { db, raw } = createTestDb();
    readRangeMock.mockResolvedValue([NEW_HEADER, dataRow("p1", "", "mora")]);

    const ready = await ensurePagosLayout(db, "sheet-1");

    expect(ready).toBe(true);
    expect(writeCellsMock).not.toHaveBeenCalled();
    expect(protectMock).toHaveBeenCalledTimes(1);
    expect(meta(raw, PAGOS_TIPO_NOTICE_KEY)).toBeNull();
    expect(meta(raw, PAGOS_ADOPT_TIPO_KEY)).toBe("1");
    expect(meta(raw, PAGOS_LAYOUT_KEY)).toBe("1");
  });

  it("skips the Sheet once the layout is cached on this phone", async () => {
    const { db, raw } = createTestDb();
    raw.exec(`INSERT INTO sync_meta (key, value) VALUES ('${PAGOS_LAYOUT_KEY}', '1')`);

    expect(await ensurePagosLayout(db, "sheet-1")).toBe(true);
    expect(readRangeMock).not.toHaveBeenCalled();
    expect(writeCellsMock).not.toHaveBeenCalled();
  });

  it("returns false and caches nothing when the Sheet can't be reached", async () => {
    const { db, raw } = createTestDb();
    readRangeMock.mockRejectedValue(new Error("Network request failed"));

    expect(await ensurePagosLayout(db, "sheet-1")).toBe(false);
    expect(meta(raw, PAGOS_LAYOUT_KEY)).toBeNull();
    expect(meta(raw, PAGOS_TIPO_NOTICE_KEY)).toBeNull();
  });

  it("finishes a partial migration without turning any row into a cuota", async () => {
    const { db, raw } = createTestDb();
    // A failed write caches nothing…
    readRangeMock.mockResolvedValueOnce([OLD_HEADER, dataRow("p1", "mora")]);
    writeCellsMock.mockRejectedValueOnce(new Error("Sheets values batchUpdate failed (500)"));
    expect(await ensurePagosLayout(db, "sheet-1")).toBe(false);
    expect(meta(raw, PAGOS_LAYOUT_KEY)).toBeNull();

    // …and a rerun over a half-written Sheet (p1 already moved to H, H1 still empty)
    // keeps every non-empty H and only finishes what's left.
    readRangeMock.mockResolvedValueOnce([
      OLD_HEADER,
      dataRow("p1", "", "mora"),
      dataRow("p2", "penalidad")
    ]);
    expect(await ensurePagosLayout(db, "sheet-1")).toBe(true);
    expect(writeCellsMock.mock.calls[1]![1]).toEqual([
      { range: "Pagos!H3", values: [["penalidad"]] },
      { range: "Pagos!F3", values: [[""]] },
      { range: "Pagos!H1", values: [["Tipo"]] }
    ]);
    expect(meta(raw, PAGOS_LAYOUT_KEY)).toBe("1");
  });

  it("after the cells were rewritten but protection failed, reruns with no writes and keeps the notice", async () => {
    const { db, raw } = createTestDb();
    readRangeMock.mockResolvedValueOnce([OLD_HEADER, dataRow("p1", "mora")]);
    protectMock.mockRejectedValueOnce(new Error("Sheets protect column failed (500)"));

    expect(await ensurePagosLayout(db, "sheet-1")).toBe(false);
    expect(meta(raw, PAGOS_LAYOUT_KEY)).toBeNull();
    expect(meta(raw, PAGOS_TIPO_NOTICE_KEY)).toBe("pending");

    readRangeMock.mockResolvedValueOnce([NEW_HEADER, dataRow("p1", "", "mora")]);
    expect(await ensurePagosLayout(db, "sheet-1")).toBe(true);
    expect(writeCellsMock).toHaveBeenCalledTimes(1);
    expect(protectMock).toHaveBeenCalledTimes(2);
    expect(meta(raw, PAGOS_LAYOUT_KEY)).toBe("1");
    expect(meta(raw, PAGOS_TIPO_NOTICE_KEY)).toBe("pending");
  });

  it("needs no migration and raises no notice on a new Sheet", async () => {
    const { db, raw } = createTestDb();
    readRangeMock.mockResolvedValue([NEW_HEADER]);

    expect(await ensurePagosLayout(db, "sheet-1")).toBe(true);
    expect(writeCellsMock).not.toHaveBeenCalled();
    expect(meta(raw, PAGOS_TIPO_NOTICE_KEY)).toBeNull();
  });

  it("raises no notice when an old tab had no data rows", async () => {
    const { db, raw } = createTestDb();
    readRangeMock.mockResolvedValue([OLD_HEADER]);

    expect(await ensurePagosLayout(db, "sheet-1")).toBe(true);
    expect(writeCellsMock.mock.calls[0]![1]).toEqual([{ range: "Pagos!H1", values: [["Tipo"]] }]);
    expect(meta(raw, PAGOS_TIPO_NOTICE_KEY)).toBeNull();
  });
});
