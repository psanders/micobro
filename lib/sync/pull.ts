/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Pulls the lender's Google Sheet back down into local SQLite: the other
 * half of the sync loop, run after push in syncNow(). `Clientes`, `Préstamos`,
 * `Pagos`, `Visitas` and `Fotos` are pulled — edits, new rows and deletions;
 * `Cierres` stays upload-only (see openspec/changes/full-two-way-sync).
 *
 * The original four tabs are read in one request, and the newer `Fotos`
 * (without its photos, which are fetched only when new or changed — see
 * photoPull.ts) and `Extra` (the lender's profile — see extraTab.ts) in a
 * second one, so a Sheet still missing a newer tab never slows the main
 * read. The rows are planned
 * (pullPlan.ts) and applied in one transaction (applyPullPlan.ts). Rows the
 * owner added without an id get one written to the Sheet first, and are
 * only inserted once it's there, so a failed write can never import the same
 * row twice. Anything the pull needs the Sheet to do — remove cascaded rows,
 * take back kept rows — is queued in pending_mutations for the push that
 * follows.
 */
import * as Crypto from "expo-crypto";
import { eq, or } from "drizzle-orm";
import { pendingMutations, syncMeta } from "../db/schema";
import { readRange, readRanges, updateRow } from "./sheetsClient";
import { getSheetId } from "./config";
import { ENTITY_RANGES } from "./push";
import { isClientesLayoutReady } from "./clientesLayout";
import { PAGOS_ADOPT_TIPO_KEY, isPagosLayoutReady } from "./pagosLayout";
import { buildPullPlan, countDeletions, guardKey, needsDeletionConfirmation } from "./pullPlan";
import { applyPullPlanTo, createSqlPullStore } from "./applyPullPlan";
import { createExpoSqlExecutor } from "../db/sqlExecutor";
import type { SqlExecutor } from "../db/sqlExecutor";
import { PULLED_ENTITIES, PULLED_TABLES } from "./syncedTables";
import {
  FOTOS_INDEX_RANGES,
  fetchPhotoRows,
  mergeFotosColumns,
  photoRowsToFetch,
  withFetchedPhotos
} from "./photoPull";
import { EXTRA_RANGE } from "./extraFields";
import { pullExtra } from "./extraTab";
import { logger } from "../logger";
import type { Database } from "../db/client";
import { EMPTY_PULL_RESULT } from "./pullResult";
import type { PullResult } from "./pullResult";
import type { ByEntity, LocalRecords, PlannedNewRow } from "./pullPlan";

export { EMPTY_PULL_RESULT };
export type { PullResult };

export const LAST_PULLED_AT_KEY = "lastPulledAt";
/** Deletions waiting for the owner's Aplicar / Restaurar, as DeletionCounts JSON. */
export const HELD_DELETIONS_KEY = "heldDeletions";
/** The last pull's broken-tab report, as TabProblem[] JSON. */
export const SYNC_PROBLEMS_KEY = "syncProblems";

/**
 * "auto": apply deletions unless they need the owner's confirmation, then
 * hold them. "apply" / "restore": the owner's answer to held deletions.
 */
export type DeletionMode = "auto" | "apply" | "restore";

async function setMeta(db: Database, key: string, value: string | null): Promise<void> {
  if (value === null) {
    await db.delete(syncMeta).where(eq(syncMeta.key, key));
    return;
  }
  await db
    .insert(syncMeta)
    .values({ key, value })
    .onConflictDoUpdate({ target: syncMeta.key, set: { value } });
}

async function readLocal(db: Database): Promise<{ [E in keyof LocalRecords]: LocalRecords[E][] }> {
  return {
    customer: await db.select().from(PULLED_TABLES.customer),
    loan: await db.select().from(PULLED_TABLES.loan),
    payment: await db.select().from(PULLED_TABLES.payment),
    visit: await db.select().from(PULLED_TABLES.visit),
    // Never the photo itself: only fetched rows need it, and they bring it.
    customerPhoto: await db
      .select({
        id: PULLED_TABLES.customerPhoto.id,
        pushedAt: PULLED_TABLES.customerPhoto.pushedAt,
        updatedAt: PULLED_TABLES.customerPhoto.updatedAt
      })
      .from(PULLED_TABLES.customerPhoto)
  };
}

async function readGuarded(db: Database): Promise<Set<string>> {
  const rows = await db
    .select()
    .from(pendingMutations)
    .where(or(eq(pendingMutations.status, "pending"), eq(pendingMutations.status, "failed")));
  return new Set(rows.map((r) => guardKey(r.entity, r.entityId)));
}

/** Writes each new row's id into its Sheet id cell; returns the rows that made it. */
async function writeNewIds(sheetId: string, rows: PlannedNewRow[]): Promise<PlannedNewRow[]> {
  const written: PlannedNewRow[] = [];
  for (const row of rows) {
    const tab = ENTITY_RANGES[row.entity].split("!")[0];
    try {
      await updateRow(sheetId, `${tab}!A${row.sheetRow}:A${row.sheetRow}`, [row.record.id]);
      written.push(row);
    } catch (err) {
      // Not inserted: the row still has no id in the Sheet, so next sync retries it.
      logger.warn("could not write a new row's id to the Sheet", {
        entity: row.entity,
        sheetRow: row.sheetRow,
        error: String(err)
      });
    }
  }
  return written;
}

/** "(400)" / "(404)" in a sheetsClient error: the range itself is bad, not the network. */
function isMissingRange(err: unknown): boolean {
  return /\((400|404)\)/.test(err instanceof Error ? err.message : String(err));
}

/**
 * The original four tabs in one batch read. A batch fails whole when any one
 * tab is missing (e.g. renamed by the owner), so fall back to reading tab by
 * tab: a missing tab is unreadable this sync (null), never a reason to stop
 * the others. Network errors still fail the pull.
 */
async function readTabs(sheetId: string, ranges: string[]): Promise<(string[][] | null)[]> {
  try {
    return await readRanges(sheetId, ranges);
  } catch (err) {
    if (!isMissingRange(err)) throw err;
  }
  const tabs: (string[][] | null)[] = [];
  for (const range of ranges) {
    try {
      tabs.push(await readRange(sheetId, range));
    } catch (err) {
      if (!isMissingRange(err)) throw err;
      logger.warn("sheet tab unreadable, skipping it this sync", { range });
      tabs.push(null);
    }
  }
  return tabs;
}

/**
 * The tabs newer than the original four, each a group of ranges, in one
 * batch read of their own: most Sheets connected before a newer tab shipped
 * don't have it yet, and in the main batch that would make every tab fall
 * back to its own read. When this batch fails on a missing tab, each group
 * is read on its own, in order; once every other group read fine, the last
 * one is the missing tab and isn't read again. So a missing newer tab costs
 * at most one more request. A missing group is null.
 */
async function readNewerTabs(
  sheetId: string,
  groups: string[][]
): Promise<(string[][][] | null)[]> {
  try {
    const values = await readRanges(sheetId, groups.flat());
    let at = 0;
    return groups.map((group) => {
      const slice = values.slice(at, at + group.length);
      at += group.length;
      return slice;
    });
  } catch (err) {
    if (!isMissingRange(err)) throw err;
  }
  const read: (string[][][] | null)[] = [];
  for (const [i, group] of groups.entries()) {
    if (i === groups.length - 1 && !read.includes(null)) {
      logger.warn("sheet tab missing, skipping it this sync", { range: group[0] });
      read.push(null);
      break;
    }
    try {
      read.push(await readRanges(sheetId, group));
    } catch (err) {
      if (!isMissingRange(err)) throw err;
      logger.warn("sheet tab missing, skipping it this sync", { range: group[0] });
      read.push(null);
    }
  }
  return read;
}

export async function pullEntities(
  db: Database,
  {
    deletions = "auto",
    sql = createExpoSqlExecutor(db)
  }: { deletions?: DeletionMode; sql?: SqlExecutor } = {}
): Promise<PullResult> {
  const sheetId = await getSheetId();
  if (!sheetId) {
    logger.warn("no sheet configured, skipping pull");
    return EMPTY_PULL_RESULT;
  }

  // Customer rows are only read once the Clientes tab is confirmed to be in
  // the Cédula layout (push confirms it) — read in the old layout, Teléfono
  // would land in cedula and Dirección in phone.
  const customersReady = await isClientesLayoutReady(db);
  // Payment rows likewise wait for the Pagos tab's Tipo column (push
  // confirms it): read before it, every mora and penalty would be a cuota.
  const paymentsReady = await isPagosLayoutReady(db);
  const adoptRows = await db.select().from(syncMeta).where(eq(syncMeta.key, PAGOS_ADOPT_TIPO_KEY));
  const adoptPaymentTipo = paymentsReady && adoptRows.length > 0;
  // The original four tabs whole, as one batch.
  const wholeTabs = PULLED_ENTITIES.filter((entity) => entity !== "customerPhoto");
  const values = await readTabs(
    sheetId,
    wholeTabs.map((entity) => ENTITY_RANGES[entity])
  );
  const tabs = {} as ByEntity<string[][] | null>;
  wholeTabs.forEach((entity, i) => {
    const held =
      (entity === "customer" && !customersReady) || (entity === "payment" && !paymentsReady);
    tabs[entity] = held ? null : (values[i] ?? null);
  });
  // The newer tabs as a second batch: Extra first, as it's the likelier to
  // exist (every phone with a profile writes it), then Fotos' ID/Nombre and
  // Actualizado columns only.
  const [extraValues, fotosValues] = await readNewerTabs(sheetId, [
    [EXTRA_RANGE],
    [...FOTOS_INDEX_RANGES]
  ]);
  const fotosIndex = mergeFotosColumns(fotosValues?.[0] ?? null, fotosValues?.[1] ?? null);

  const local = await readLocal(db);
  const guarded = await readGuarded(db);
  const fetched = fotosIndex
    ? await fetchPhotoRows(sheetId, photoRowsToFetch(fotosIndex, local.customerPhoto, guarded))
    : new Map();
  tabs.customerPhoto = fotosIndex ? withFetchedPhotos(fotosIndex, fetched) : null;

  const now = new Date();
  const plan = buildPullPlan({
    tabs,
    local,
    guarded,
    now,
    newId: () => Crypto.randomUUID(),
    adoptPaymentTipo,
    fetchedPhotos: new Set(fetched.keys())
  });

  const localCounts = {} as ByEntity<number>;
  for (const entity of PULLED_ENTITIES) localCounts[entity] = local[entity].length;
  const hold =
    deletions === "auto" &&
    plan.deletions.length > 0 &&
    needsDeletionConfirmation(plan.deletions, localCounts);

  const writtenNewRows = await writeNewIds(sheetId, plan.newRows);

  let applied!: ReturnType<typeof applyPullPlanTo>;
  sql.transaction(() => {
    applied = applyPullPlanTo(createSqlPullStore(db, sql, now), plan, {
      applyDeletions: !hold && deletions !== "restore",
      restoreDeletions: deletions === "restore",
      writtenNewRows,
      now
    });
  });

  const extra = await pullExtra(db, extraValues?.[0] ?? null, now);
  const problems = [...plan.problems, ...extra.problems];

  // The one-time adoption is spent once a readable Pagos tab was applied.
  if (adoptPaymentTipo && tabs.payment && !plan.brokenTabs.includes("payment")) {
    await setMeta(db, PAGOS_ADOPT_TIPO_KEY, null);
  }

  const held = hold ? countDeletions(plan.deletions) : null;
  await setMeta(db, HELD_DELETIONS_KEY, held ? JSON.stringify(held) : null);
  await setMeta(db, SYNC_PROBLEMS_KEY, problems.length ? JSON.stringify(problems) : null);
  await setMeta(db, LAST_PULLED_AT_KEY, String(Date.now()));

  const result: PullResult = {
    pulled: applied.inserted + applied.updated + extra.pulled,
    skipped: plan.guardedSkipped + applied.changedDuringSync,
    malformed: problems.length,
    deleted: applied.deleted,
    // Extra's released or resent profile mutations go out in the same sync.
    queued: applied.queued + extra.queued,
    problems,
    held
  };
  logger.info("pull complete", {
    pulled: result.pulled,
    skipped: result.skipped,
    malformed: result.malformed,
    deleted: result.deleted,
    queued: result.queued,
    held: held?.total ?? 0,
    brokenTabs: plan.brokenTabs
  });
  return result;
}
