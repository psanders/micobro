/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * One-time move of a lender's existing `Pagos` tab to the Tipo layout. Before
 * it, a payment's kind lived in Notas (F) as the exact text "mora" or
 * "penalidad", so editing a note turned a late fee or a penalty into
 * principal. Now the kind lives in a new column H, "Tipo" (cuota | mora |
 * penalidad), that only the app fills; F is free text.
 *
 * The decision comes from the Sheet (is H1 "Tipo"?), never from the local
 * flag alone, and H1 is written last, in the same request as the data: a
 * Sheet whose H1 reads "Tipo" is fully migrated. A rerun after a partial
 * write keeps every non-empty H, so it never turns a row into a cuota.
 * Payment pushes and the Pagos pull wait until this has confirmed the layout.
 */
import { eq } from "drizzle-orm";
import { syncMeta } from "../db/schema";
import { ensureColumnProtection, readRange, writeCells } from "./sheetsClient";
import { TAB_HEADERS } from "./sheetHeaders";
import { legacyPaymentKind } from "../payments/paymentNotes";
import { logger } from "../logger";
import type { Database } from "../db/client";

export const PAGOS_LAYOUT_KEY = "pagosLayoutVersion";
/** "pending" until the lender taps "Entendido" on the notice (SyncProvider). */
export const PAGOS_TIPO_NOTICE_KEY = "pagosTipoNotice";
/** Set when this phone first confirms a Sheet another phone migrated: pull adopts H once. */
export const PAGOS_ADOPT_TIPO_KEY = "pagosAdoptTipo";
export const TIPO_PROTECTION_DESCRIPTION = "micobro:protected:tipo";

const PAGOS_LAYOUT_VERSION = "1";
const PAGOS_TAB = "Pagos";
const NOTES_INDEX = 5;
const TIPO_INDEX = 7;
const TIPO_HEADER = TAB_HEADERS.payment[TIPO_INDEX]!;

async function readMeta(db: Database, key: string): Promise<string | null> {
  const rows = await db.select().from(syncMeta).where(eq(syncMeta.key, key));
  return rows[0]?.value ?? null;
}

async function writeMeta(db: Database, key: string, value: string): Promise<void> {
  await db
    .insert(syncMeta)
    .values({ key, value })
    .onConflictDoUpdate({ target: syncMeta.key, set: { value } });
}

/** True once this device has confirmed the Sheet's Pagos tab has the Tipo column. */
export async function isPagosLayoutReady(db: Database): Promise<boolean> {
  return (await readMeta(db, PAGOS_LAYOUT_KEY)) === PAGOS_LAYOUT_VERSION;
}

/**
 * The cells that move a pre-Tipo Pagos tab to the Tipo layout: each data
 * row's empty H from F's legacy flag (else "cuota"), each flag cleared from
 * F, and H1 "Tipo" last. Rows are 1-based Sheet rows; `rows[0]` is the header.
 */
export function pagosMigrationCells(rows: string[][]): {
  cells: { range: string; values: string[][] }[];
  dataRows: number;
} {
  const cells: { range: string; values: string[][] }[] = [];
  let dataRows = 0;
  rows.slice(1).forEach((row, index) => {
    if (row.every((value) => !value || !value.trim())) return;
    dataRows += 1;
    const sheetRow = index + 2;
    const notes = (row[NOTES_INDEX] ?? "").trim();
    const kind = legacyPaymentKind(notes);
    // H before F, so a row whose flag is gone always has its kind.
    if (!(row[TIPO_INDEX] ?? "").trim()) {
      cells.push({ range: `${PAGOS_TAB}!H${sheetRow}`, values: [[kind ?? "cuota"]] });
    }
    if (kind) cells.push({ range: `${PAGOS_TAB}!F${sheetRow}`, values: [[""]] });
  });
  cells.push({ range: `${PAGOS_TAB}!H1`, values: [[TIPO_HEADER]] });
  return { cells, dataRows };
}

/**
 * Confirms (and if needed, performs) the Tipo layout on `sheetId`'s Pagos
 * tab, then protects column H (warning-only). Returns false instead of
 * throwing on any failure, e.g. offline, so the caller keeps syncing the
 * other entities and retries next time; no layout flag is cached then.
 */
export async function ensurePagosLayout(db: Database, sheetId: string): Promise<boolean> {
  if (await isPagosLayoutReady(db)) return true;

  try {
    const rows = await readRange(sheetId, `${PAGOS_TAB}!A1:H`);
    if ((rows[0]?.[TIPO_INDEX] ?? "").trim() === TIPO_HEADER) {
      // Migrated already (by another phone, or provisioned with Tipo): adopt its H once.
      await writeMeta(db, PAGOS_ADOPT_TIPO_KEY, "1");
    } else {
      const { cells, dataRows } = pagosMigrationCells(rows);
      await writeCells(sheetId, cells);
      if (dataRows > 0) await writeMeta(db, PAGOS_TIPO_NOTICE_KEY, "pending");
      logger.info("moved Pagos tab to the Tipo layout", { sheetId, dataRows });
    }
    await ensureColumnProtection(sheetId, PAGOS_TAB, TIPO_INDEX, TIPO_PROTECTION_DESCRIPTION);
  } catch (err) {
    logger.warn("could not confirm the Pagos layout, holding payment sync", {
      error: String(err)
    });
    return false;
  }

  await writeMeta(db, PAGOS_LAYOUT_KEY, PAGOS_LAYOUT_VERSION);
  return true;
}

/** Whether the "Actualiza Micobro en tus otros teléfonos" notice is waiting. */
export async function isPagosTipoNoticePending(db: Database): Promise<boolean> {
  return (await readMeta(db, PAGOS_TIPO_NOTICE_KEY)) === "pending";
}

export async function clearPagosTipoNotice(db: Database): Promise<void> {
  await db.delete(syncMeta).where(eq(syncMeta.key, PAGOS_TIPO_NOTICE_KEY));
}
