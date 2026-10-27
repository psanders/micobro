/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * One-time move of a lender's existing `Clientes` tab to the Cédula layout
 * (ID, Nombre, Cédula, Teléfono, …). Sheets provisioned before Cédula shipped
 * have Teléfono in column C; writing or reading customer rows in the new
 * order against them would misplace every field. So push and pull leave
 * customers alone until this has confirmed the layout.
 *
 * The decision comes from the Sheet itself (is C1 "Cédula"?), never from the
 * local flag alone, so a reinstalled device can't insert the column twice;
 * the `sync_meta` flag only caches a confirmed answer.
 */
import { eq } from "drizzle-orm";
import { syncMeta } from "../db/schema";
import { insertColumnWithHeader, readRange } from "./sheetsClient";
import { logger } from "../logger";
import type { Database } from "../db/client";

export const CLIENTES_LAYOUT_KEY = "clientesLayoutVersion";
const CLIENTES_LAYOUT_VERSION = "1";
const CLIENTES_TAB = "Clientes";
const CEDULA_HEADER = "Cédula";
const CEDULA_COLUMN_INDEX = 2;

/** True once this device has confirmed the Sheet's Clientes tab has the Cédula column. */
export async function isClientesLayoutReady(db: Database): Promise<boolean> {
  const rows = await db.select().from(syncMeta).where(eq(syncMeta.key, CLIENTES_LAYOUT_KEY));
  return rows[0]?.value === CLIENTES_LAYOUT_VERSION;
}

/**
 * Confirms (and if needed, performs) the Cédula layout on `sheetId`'s Clientes
 * tab. Returns false instead of throwing on any failure — e.g. offline — so
 * the caller can keep syncing the other entities and retry next time.
 */
export async function ensureClientesLayout(db: Database, sheetId: string): Promise<boolean> {
  if (await isClientesLayoutReady(db)) return true;

  try {
    const header = await readRange(sheetId, `${CLIENTES_TAB}!C1:C1`);
    if (header[0]?.[0]?.trim() !== CEDULA_HEADER) {
      await insertColumnWithHeader(sheetId, CLIENTES_TAB, CEDULA_COLUMN_INDEX, CEDULA_HEADER);
      logger.info("moved Clientes tab to the Cédula layout", { sheetId });
    }
  } catch (err) {
    logger.warn("could not confirm the Clientes layout, holding customer sync", {
      error: String(err)
    });
    return false;
  }

  await db
    .insert(syncMeta)
    .values({ key: CLIENTES_LAYOUT_KEY, value: CLIENTES_LAYOUT_VERSION })
    .onConflictDoUpdate({ target: syncMeta.key, set: { value: CLIENTES_LAYOUT_VERSION } });
  return true;
}
