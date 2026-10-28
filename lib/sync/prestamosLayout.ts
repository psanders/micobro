/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Labels the "Penalidad (centavos)" column (Préstamos!Q) on Sheets
 * provisioned before Tradicional Plus. The column is appended after
 * Actualizado, so no existing cell moves and rows can be written and read
 * before the label exists (pull accepts a header shorter than today's) —
 * this only keeps the column from sitting there unnamed.
 *
 * Like the Cédula layout, the decision comes from the Sheet (is Q1 empty?),
 * and the `sync_meta` flag only caches a confirmed answer.
 */
import { eq } from "drizzle-orm";
import { syncMeta } from "../db/schema";
import { readRange, writeHeaderRow } from "./sheetsClient";
import { TAB_HEADERS } from "./sheetHeaders";
import { logger } from "../logger";
import type { Database } from "../db/client";

export const PENALTY_HEADER_KEY = "prestamosPenaltyHeader";
const PENALTY_HEADER_DONE = "1";
const PENALTY_HEADER_CELL = "Préstamos!Q1";
const PENALTY_HEADER = TAB_HEADERS.loan[16]!;

/**
 * Writes Q1's header if the cell is empty. Never throws — on any failure
 * (e.g. offline) it logs and tries again on the next push.
 */
export async function ensurePenaltyHeader(db: Database, sheetId: string): Promise<void> {
  const rows = await db.select().from(syncMeta).where(eq(syncMeta.key, PENALTY_HEADER_KEY));
  if (rows[0]?.value === PENALTY_HEADER_DONE) return;

  try {
    const header = await readRange(sheetId, `${PENALTY_HEADER_CELL}:Q1`);
    if (!header[0]?.[0]?.trim()) {
      await writeHeaderRow(sheetId, PENALTY_HEADER_CELL, [PENALTY_HEADER]);
      logger.info("labeled the Préstamos Penalidad column", { sheetId });
    }
  } catch (err) {
    logger.warn("could not label the Préstamos Penalidad column", { error: String(err) });
    return;
  }

  await db
    .insert(syncMeta)
    .values({ key: PENALTY_HEADER_KEY, value: PENALTY_HEADER_DONE })
    .onConflictDoUpdate({ target: syncMeta.key, set: { value: PENALTY_HEADER_DONE } });
}
