/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * The one-time move of a lender's existing rows from English enum values to
 * Spanish codes (lib/sync/sheetValuesLayout.ts): only exact English values
 * change, everything is written in one batch, the flag is cached only after
 * a clean run, failures never throw or write, and every rewritten cell still
 * reads back as the same internal value.
 */
jest.mock("../lib/sync/sheetsClient", () => ({
  readRange: jest.fn(),
  writeCells: jest.fn().mockResolvedValue(undefined)
}));

import { SHEET_VALUES_KEY, ensureSheetSpanishValues } from "../lib/sync/sheetValuesLayout";
import { parseSheetRow } from "../lib/sync/sheetRows";
import {
  FREQUENCY_CODES,
  LOAN_STATUS_CODES,
  LOAN_TYPE_CODES,
  PAYMENT_METHOD_CODES,
  VISIT_OUTCOME_CODES
} from "../lib/sync/sheetValues";
import { TAB_HEADERS } from "../lib/sync/sheetHeaders";
import { readRange, writeCells } from "../lib/sync/sheetsClient";
import { createTestDb } from "./helpers/testDb";
import type { Raw } from "./helpers/testDb";

const readRangeMock = readRange as jest.Mock;
const writeCellsMock = writeCells as jest.Mock;

const created = "2026-01-01T00:00:00.000Z";

const LOAN_HEADER = TAB_HEADERS.loan!;
const PAGOS_HEADER = TAB_HEADERS.payment!;
const VISITAS_HEADER = TAB_HEADERS.visit!;

function loanRow(id: string, frequency: string, status: string, loanType: string): string[] {
  return [
    id,
    "c1",
    "100000",
    "1000",
    "4",
    frequency,
    created,
    status,
    "",
    "",
    "",
    "",
    "",
    loanType
  ];
}
const paymentRow = (id: string, method: string) => [id, "l1", "1000", created, method];
const visitRow = (id: string, outcome: string) => [id, "c1", "", outcome];

/** Serves each tab's rows by the range's tab name. */
function serveTabs(tabs: { prestamos?: string[][]; pagos?: string[][]; visitas?: string[][] }) {
  readRangeMock.mockImplementation(async (_sheetId: string, range: string) => {
    if (range.startsWith("Préstamos!")) return tabs.prestamos ?? [LOAN_HEADER];
    if (range.startsWith("Pagos!")) return tabs.pagos ?? [PAGOS_HEADER];
    if (range.startsWith("Visitas!")) return tabs.visitas ?? [VISITAS_HEADER];
    throw new Error(`unexpected range ${range}`);
  });
}

const flag = (raw: Raw) =>
  (raw.prepare("SELECT value FROM sync_meta WHERE key = ?").all(SHEET_VALUES_KEY)[0]?.value as
    string | undefined) ?? null;

const written = () => writeCellsMock.mock.calls[0]![1] as { range: string; values: string[][] }[];

describe("ensureSheetSpanishValues", () => {
  beforeEach(() => {
    readRangeMock.mockReset();
    writeCellsMock.mockReset().mockResolvedValue(undefined);
  });

  it("rewrites every English enum cell in Préstamos, Pagos and Visitas in one batch", async () => {
    const { db, raw } = createTestDb();
    serveTabs({
      prestamos: [
        LOAN_HEADER,
        loanRow("l1", "weekly", "active", "open_credit"),
        loanRow("l2", "biweekly", "cancelled", "term_plus"),
        loanRow("l3", "daily", "paid", "term"),
        loanRow("l4", "monthly", "defaulted", "")
      ],
      pagos: [PAGOS_HEADER, paymentRow("p1", "cash"), paymentRow("p2", "transfer")],
      visitas: [
        VISITAS_HEADER,
        visitRow("v1", "promise"),
        visitRow("v2", "no_contact"),
        visitRow("v3", "refused"),
        visitRow("v4", "reschedule")
      ]
    });

    await ensureSheetSpanishValues(db, "sheet-1");

    expect(readRangeMock.mock.calls.map((c) => c[1])).toEqual([
      "Préstamos!A1:N",
      "Pagos!A1:E",
      "Visitas!A1:D"
    ]);
    expect(writeCellsMock).toHaveBeenCalledTimes(1);
    expect(writeCellsMock.mock.calls[0]![0]).toBe("sheet-1");
    expect(written()).toEqual([
      { range: "Préstamos!F2", values: [["semanal"]] },
      { range: "Préstamos!F3", values: [["quincenal"]] },
      { range: "Préstamos!F4", values: [["diario"]] },
      { range: "Préstamos!F5", values: [["mensual"]] },
      { range: "Préstamos!H2", values: [["activo"]] },
      { range: "Préstamos!H3", values: [["cancelado"]] },
      { range: "Préstamos!H4", values: [["saldado"]] },
      { range: "Préstamos!H5", values: [["incobrable"]] },
      { range: "Préstamos!N2", values: [["credito_abierto"]] },
      { range: "Préstamos!N3", values: [["tradicional_plus"]] },
      { range: "Préstamos!N4", values: [["tradicional"]] },
      { range: "Pagos!E2", values: [["efectivo"]] },
      { range: "Pagos!E3", values: [["transferencia"]] },
      { range: "Visitas!D2", values: [["promesa"]] },
      { range: "Visitas!D3", values: [["sin_contacto"]] },
      { range: "Visitas!D4", values: [["se_nego"]] },
      { range: "Visitas!D5", values: [["reagendar"]] }
    ]);
    expect(flag(raw)).toBe("1");
  });

  it("matches English values whatever their case or surrounding spaces", async () => {
    const { db } = createTestDb();
    serveTabs({
      prestamos: [LOAN_HEADER, loanRow("l1", " Weekly ", "ACTIVE", "Open_Credit")],
      pagos: [PAGOS_HEADER, paymentRow("p1", "Cash ")]
    });

    await ensureSheetSpanishValues(db, "sheet-1");

    expect(written()).toEqual([
      { range: "Préstamos!F2", values: [["semanal"]] },
      { range: "Préstamos!H2", values: [["activo"]] },
      { range: "Préstamos!N2", values: [["credito_abierto"]] },
      { range: "Pagos!E2", values: [["efectivo"]] }
    ]);
  });

  it("leaves Spanish codes, empty cells, blank rows and unknown text alone", async () => {
    const { db, raw } = createTestDb();
    serveTabs({
      prestamos: [
        LOAN_HEADER,
        loanRow("l1", "semanal", "activo", "credito_abierto"),
        loanRow("l2", "cada semana", "", ""),
        [],
        ["", "", "", "", "", "", "", "", ""],
        // Object keys that aren't values: never treated as known.
        loanRow("l3", "constructor", "__proto__", "toString")
      ],
      pagos: [PAGOS_HEADER, paymentRow("p1", ""), paymentRow("p2", "efectivo")],
      visitas: [VISITAS_HEADER, visitRow("v1", "llamar luego")]
    });

    await ensureSheetSpanishValues(db, "sheet-1");

    expect(written()).toEqual([]);
    expect(flag(raw)).toBe("1");
  });

  it("handles ragged rows the Sheets API trims short", async () => {
    const { db } = createTestDb();
    serveTabs({
      // Trailing empty cells are dropped by the API: no Tipo, no Estado.
      prestamos: [LOAN_HEADER, ["l1", "c1", "1", "1", "1", "weekly"]],
      pagos: [PAGOS_HEADER, ["p1", "l1", "1000"]]
    });

    await ensureSheetSpanishValues(db, "sheet-1");

    expect(written()).toEqual([{ range: "Préstamos!F2", values: [["semanal"]] }]);
  });

  it("runs once: a cached flag skips reading the Sheet at all", async () => {
    const { db } = createTestDb();
    serveTabs({ prestamos: [LOAN_HEADER, loanRow("l1", "weekly", "active", "")] });

    await ensureSheetSpanishValues(db, "sheet-1");
    readRangeMock.mockClear();
    writeCellsMock.mockClear();
    await ensureSheetSpanishValues(db, "sheet-1");

    expect(readRangeMock).not.toHaveBeenCalled();
    expect(writeCellsMock).not.toHaveBeenCalled();
  });

  it("is a no-op on a Sheet another phone already moved", async () => {
    const { db, raw } = createTestDb();
    serveTabs({
      prestamos: [LOAN_HEADER, loanRow("l1", "semanal", "activo", "tradicional_plus")],
      pagos: [PAGOS_HEADER, paymentRow("p1", "transferencia")],
      visitas: [VISITAS_HEADER, visitRow("v1", "promesa")]
    });

    await ensureSheetSpanishValues(db, "sheet-1");

    expect(written()).toEqual([]);
    expect(flag(raw)).toBe("1");
  });

  it("writes nothing and caches nothing when any tab can't be read, then retries", async () => {
    const { db, raw } = createTestDb();
    readRangeMock.mockImplementation(async (_sheetId: string, range: string) => {
      if (range.startsWith("Préstamos!")) return [LOAN_HEADER, loanRow("l1", "weekly", "", "")];
      throw new Error("Network request failed");
    });

    await expect(ensureSheetSpanishValues(db, "sheet-1")).resolves.toBeUndefined();
    expect(writeCellsMock).not.toHaveBeenCalled();
    expect(flag(raw)).toBeNull();

    // Next push, back online.
    serveTabs({ prestamos: [LOAN_HEADER, loanRow("l1", "weekly", "", "")] });
    await ensureSheetSpanishValues(db, "sheet-1");

    expect(written()).toEqual([{ range: "Préstamos!F2", values: [["semanal"]] }]);
    expect(flag(raw)).toBe("1");
  });

  it("caches nothing when the write fails, and never throws", async () => {
    const { db, raw } = createTestDb();
    serveTabs({ prestamos: [LOAN_HEADER, loanRow("l1", "weekly", "", "")] });
    writeCellsMock.mockRejectedValueOnce(new Error("Sheets values batchUpdate failed (500)"));

    await expect(ensureSheetSpanishValues(db, "sheet-1")).resolves.toBeUndefined();

    expect(flag(raw)).toBeNull();
  });

  it("skips a column under an unexpected header and retries once the header is fixed", async () => {
    const { db, raw } = createTestDb();
    // A lender inserted a column before F: every label from F on has shifted.
    const shifted = [...LOAN_HEADER.slice(0, 5), "Mi columna", ...LOAN_HEADER.slice(5)];
    serveTabs({
      prestamos: [shifted, ["l1", "c1", "1", "1", "1", "x", "weekly", created, "active"]],
      pagos: [PAGOS_HEADER, paymentRow("p1", "cash")]
    });

    await ensureSheetSpanishValues(db, "sheet-1");

    // Nothing written into the shifted Préstamos columns; Pagos still moved.
    expect(written()).toEqual([{ range: "Pagos!E2", values: [["efectivo"]] }]);
    expect(flag(raw)).toBeNull();

    // The lender removes the extra column; the rerun finishes the job.
    writeCellsMock.mockClear();
    serveTabs({
      prestamos: [LOAN_HEADER, loanRow("l1", "weekly", "active", "")],
      pagos: [PAGOS_HEADER, paymentRow("p1", "efectivo")]
    });
    await ensureSheetSpanishValues(db, "sheet-1");

    expect(written()).toEqual([
      { range: "Préstamos!F2", values: [["semanal"]] },
      { range: "Préstamos!H2", values: [["activo"]] }
    ]);
    expect(flag(raw)).toBe("1");
  });

  it("rewrites a column whose header cell is still empty on an older Sheet", async () => {
    const { db, raw } = createTestDb();
    // Provisioned before the Tipo column existed: N1 was never labeled, but
    // push has been appending full rows, Tipo included.
    const older = [...LOAN_HEADER.slice(0, 13)];
    serveTabs({ prestamos: [older, loanRow("l1", "weekly", "active", "open_credit")] });

    await ensureSheetSpanishValues(db, "sheet-1");

    expect(written()).toContainEqual({ range: "Préstamos!N2", values: [["credito_abierto"]] });
    expect(flag(raw)).toBe("1");
  });
});

// The rewrite must never change what a row means: for every enum value, the
// row as it was (English) and as rewritten (Spanish) parse to the same record.
describe("rewritten rows read back unchanged", () => {
  beforeEach(() => {
    readRangeMock.mockReset();
    writeCellsMock.mockReset().mockResolvedValue(undefined);
  });

  async function rewrite(tabs: Parameters<typeof serveTabs>[0]) {
    const { db } = createTestDb();
    serveTabs(tabs);
    await ensureSheetSpanishValues(db, "sheet-1");
    return written();
  }

  /** Applies the written cells to a copy of `rows` (row 1 is the header). */
  function apply(rows: string[][], cells: { range: string; values: string[][] }[], tab: string) {
    const copy = rows.map((r) => [...r]);
    for (const { range, values } of cells) {
      if (!range.startsWith(`${tab}!`)) continue;
      const [, ref] = range.split("!");
      const col = ref!.charCodeAt(0) - "A".charCodeAt(0);
      const row = Number(ref!.slice(1)) - 1;
      copy[row]![col] = values[0]![0]!;
    }
    return copy;
  }

  it("keeps every loan's frequency, status and type", async () => {
    const frequencies = Object.keys(FREQUENCY_CODES);
    const statuses = Object.keys(LOAN_STATUS_CODES);
    const types = Object.keys(LOAN_TYPE_CODES);
    const rows = [LOAN_HEADER];
    frequencies.forEach((f, i) =>
      rows.push([
        ...loanRow(`l${i}`, f, statuses[i % statuses.length]!, types[i % types.length]!),
        created,
        created
      ])
    );

    const after = apply(rows, await rewrite({ prestamos: rows }), "Préstamos");

    rows.slice(1).forEach((before, i) => {
      const old = parseSheetRow("loan", before);
      const now = parseSheetRow("loan", after[i + 1]!);
      expect(old.ok).toBe(true);
      expect(now).toEqual(old);
      expect(after[i + 1]![5]).not.toBe(before[5]); // it really was rewritten
    });
  });

  it("keeps every payment's method and every visit's outcome", async () => {
    const pagos = [
      PAGOS_HEADER,
      ...Object.keys(PAYMENT_METHOD_CODES).map((m, i) => [
        ...paymentRow(`p${i}`, m),
        "",
        created,
        "cuota"
      ])
    ];
    const visitas = [
      VISITAS_HEADER,
      ...Object.keys(VISIT_OUTCOME_CODES).map((o, i) => [
        ...visitRow(`v${i}`, o),
        "",
        "",
        "",
        created
      ])
    ];

    const cells = await rewrite({ pagos, visitas });
    const pagosAfter = apply(pagos, cells, "Pagos");
    const visitasAfter = apply(visitas, cells, "Visitas");

    pagos.slice(1).forEach((before, i) => {
      expect(parseSheetRow("payment", pagosAfter[i + 1]!)).toEqual(
        parseSheetRow("payment", before)
      );
    });
    visitas.slice(1).forEach((before, i) => {
      expect(parseSheetRow("visit", visitasAfter[i + 1]!)).toEqual(parseSheetRow("visit", before));
    });
    expect(cells).toHaveLength(
      Object.keys(PAYMENT_METHOD_CODES).length + Object.keys(VISIT_OUTCOME_CODES).length
    );
  });
});
