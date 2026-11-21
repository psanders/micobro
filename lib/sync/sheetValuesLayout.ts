/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * One-time rewrite of a lender's existing rows from the app's English enum
 * values to the Spanish codes push now writes (see sheetValues.ts):
 * Préstamos Frecuencia (F), Estado (H) and Tipo (N), Pagos Método (E) and
 * Visitas Resultado (D).
 *
 * Only a cell holding exactly an English value (any case, surrounding
 * spaces ignored) is rewritten. Spanish codes, empty cells and anything the
 * lender typed that isn't a known value are left alone, so a rerun, a
 * partial earlier run or a Sheet another phone already migrated changes
 * nothing. A column whose header cell holds something other than the
 * expected label is skipped, so this never writes into a shifted column
 * (pull reports that tab as broken anyway), and the run isn't cached, so it
 * tries again once the header is fixed. An empty header cell counts as the
 * expected column: older Sheets can lack a later column's label (pull
 * accepts a shorter header) while push already wrote values under it.
 *
 * Nothing is read differently because of this: pull accepts both forms, so
 * rows are correct before, during and after the rewrite. It runs from push,
 * never throws, writes every tab in one batch, and caches its `sync_meta`
 * flag only once that write succeeded; any failure retries on the next push.
 */
import { eq } from "drizzle-orm";
import { syncMeta } from "../db/schema";
import { readRange, writeCells } from "./sheetsClient";
import { TAB_HEADERS } from "./sheetHeaders";
import {
  FREQUENCY_CODES,
  LOAN_STATUS_CODES,
  LOAN_TYPE_CODES,
  PAYMENT_METHOD_CODES,
  VISIT_OUTCOME_CODES
} from "./sheetValues";
import { logger } from "../logger";
import type { Database } from "../db/client";

export const SHEET_VALUES_KEY = "sheetSpanishValues";
const SHEET_VALUES_VERSION = "1";

interface EnumColumn {
  index: number;
  header: string;
  codes: Record<string, string>;
}

interface TabSpec {
  tab: string;
  columns: EnumColumn[];
}

const column = (letter: string) => letter.charCodeAt(0) - "A".charCodeAt(0);
const LETTERS = (index: number) => String.fromCharCode("A".charCodeAt(0) + index);

export const SHEET_VALUE_TABS: TabSpec[] = [
  {
    tab: "Préstamos",
    columns: [
      { index: column("F"), header: TAB_HEADERS.loan[5]!, codes: FREQUENCY_CODES },
      { index: column("H"), header: TAB_HEADERS.loan[7]!, codes: LOAN_STATUS_CODES },
      { index: column("N"), header: TAB_HEADERS.loan[13]!, codes: LOAN_TYPE_CODES }
    ]
  },
  {
    tab: "Pagos",
    columns: [{ index: column("E"), header: TAB_HEADERS.payment[4]!, codes: PAYMENT_METHOD_CODES }]
  },
  {
    tab: "Visitas",
    columns: [{ index: column("D"), header: TAB_HEADERS.visit[3]!, codes: VISIT_OUTCOME_CODES }]
  }
];

function lastColumn(spec: TabSpec): string {
  return LETTERS(Math.max(...spec.columns.map((c) => c.index)));
}

/**
 * The cells that move one tab's English enum values to Spanish codes.
 * `rows` is the tab read from A1 (`rows[0]` is the header); rows are 1-based.
 */
export function sheetValueCells(
  spec: TabSpec,
  rows: string[][]
): { cells: { range: string; values: string[][] }[]; skippedColumns: number } {
  const header = rows[0] ?? [];
  const cells: { range: string; values: string[][] }[] = [];
  let skippedColumns = 0;
  for (const col of spec.columns) {
    const label = (header[col.index] ?? "").trim();
    if (label && label !== col.header) {
      skippedColumns += 1;
      continue;
    }
    rows.slice(1).forEach((row, index) => {
      const value = (row[col.index] ?? "").trim().toLowerCase();
      if (!value || !Object.prototype.hasOwnProperty.call(col.codes, value)) return;
      cells.push({
        range: `${spec.tab}!${LETTERS(col.index)}${index + 2}`,
        values: [[col.codes[value]!]]
      });
    });
  }
  return { cells, skippedColumns };
}

/**
 * Rewrites the Sheet's English enum cells once. Never throws: on any
 * failure (e.g. offline) it logs, caches nothing, and tries again next push.
 */
export async function ensureSheetSpanishValues(db: Database, sheetId: string): Promise<void> {
  const flag = await db.select().from(syncMeta).where(eq(syncMeta.key, SHEET_VALUES_KEY));
  if (flag[0]?.value === SHEET_VALUES_VERSION) return;

  try {
    // Read every tab before writing anything, so a failed read writes nothing.
    const cells: { range: string; values: string[][] }[] = [];
    let skippedColumns = 0;
    for (const spec of SHEET_VALUE_TABS) {
      const rows = await readRange(sheetId, `${spec.tab}!A1:${lastColumn(spec)}`);
      const tab = sheetValueCells(spec, rows);
      cells.push(...tab.cells);
      skippedColumns += tab.skippedColumns;
    }
    await writeCells(sheetId, cells);
    logger.info("moved the Sheet's values to Spanish", { sheetId, cells: cells.length });
    if (skippedColumns > 0) {
      // Leave the flag unset: the rest is done, and a rerun only rewrites
      // what's still English once the header is fixed.
      logger.warn("skipped Sheet columns with an unexpected header", { skippedColumns });
      return;
    }
  } catch (err) {
    logger.warn("could not move the Sheet's values to Spanish", { error: String(err) });
    return;
  }

  await db
    .insert(syncMeta)
    .values({ key: SHEET_VALUES_KEY, value: SHEET_VALUES_VERSION })
    .onConflictDoUpdate({ target: syncMeta.key, set: { value: SHEET_VALUES_VERSION } });
}
