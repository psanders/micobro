/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Applies a pull plan (see pullPlan.ts) to local SQLite in one transaction.
 * The transaction runs synchronously (SqlExecutor), so nothing else in the
 * app can write between the guard re-check below and the writes it
 * protects: a row the collector changed while the Sheet was being read is
 * dropped from the plan here, never overwritten (design.md §8).
 *
 * The logic works against `PullStore`, so tests drive it with an in-memory
 * store; `createSqlPullStore` is the thin SQLite-backed one.
 */
import * as Crypto from "expo-crypto";
import { eq, inArray } from "drizzle-orm";
import { pendingMutations } from "../db/schema";
import { guardKey } from "./pullPlan";
import { PULLED_ENTITIES, PULLED_TABLES } from "./syncedTables";
import type { Database } from "../db/client";
import type { SqlExecutor } from "../db/sqlExecutor";
import type {
  EntityRef,
  LocalRecords,
  PlannedDeletion,
  PlannedInsert,
  PlannedNewRow,
  PullPlan
} from "./pullPlan";
import type { PulledEntity } from "./syncedTables";

export interface PullStore {
  /** `guardKey` of every row with a pending or failed mutation, read now. */
  guardedKeys(): Set<string>;
  insert(entity: PulledEntity, record: LocalRecords[PulledEntity]): void;
  update(entity: PulledEntity, id: string, changes: Record<string, unknown>): void;
  delete(entity: PulledEntity, id: string): void;
  stamp(entity: PulledEntity, ids: string[], at: Date): void;
  queue(entity: PulledEntity, id: string, operation: "update" | "delete", payload: string): void;
}

export interface ApplyOptions {
  /** False holds every deletion back (the owner hasn't confirmed them yet). */
  applyDeletions: boolean;
  /** Owner chose Restaurar: write the held rows back to the Sheet instead. */
  restoreDeletions?: boolean;
  /** New rows whose id already reached the Sheet — only these are inserted. */
  writtenNewRows: PlannedNewRow[];
  now: Date;
}

export interface ApplyResult {
  inserted: number;
  updated: number;
  deleted: number;
  restored: number;
  /** Rows dropped because they gained a local change during the sync. */
  changedDuringSync: number;
  /** Mutations queued (Sheet deletes and write-backs) — push them next. */
  queued: number;
}

// Children before parents, so foreign keys hold at every step.
const DELETE_ORDER: PulledEntity[] = ["visit", "payment", "loan", "customer"];

function rootKey(d: PlannedDeletion): string {
  return guardKey(d.root.entity, d.root.id);
}

export function applyPullPlanTo(
  store: PullStore,
  plan: PullPlan,
  options: ApplyOptions
): ApplyResult {
  const guarded = store.guardedKeys();
  const isGuarded = (entity: PulledEntity, id: string) => guarded.has(guardKey(entity, id));
  const result: ApplyResult = {
    inserted: 0,
    updated: 0,
    deleted: 0,
    restored: 0,
    changedDuringSync: 0,
    queued: 0
  };

  // An empty payload makes push send the row as it is locally.
  const writeBack = (ref: EntityRef) => {
    store.queue(ref.entity, ref.id, "update", "");
    result.queued += 1;
    result.restored += 1;
  };

  // Deletions: a tree with any newly guarded row is dropped whole and its
  // root written back — the app wins.
  const restores: EntityRef[] = [...plan.restores];
  const cancelledRoots = new Set<string>();
  for (const d of plan.deletions) {
    if (isGuarded(d.entity, d.id) && !cancelledRoots.has(rootKey(d))) {
      cancelledRoots.add(rootKey(d));
      result.changedDuringSync += 1;
      if (!isGuarded(d.root.entity, d.root.id)) restores.push(d.root);
    }
  }
  const deletions = plan.deletions.filter((d) => !cancelledRoots.has(rootKey(d)));

  if (options.applyDeletions) {
    for (const entity of DELETE_ORDER) {
      for (const d of deletions) {
        if (d.entity !== entity) continue;
        if (d.local) {
          store.delete(d.entity, d.id);
          result.deleted += 1;
        }
        if (d.inSheet) {
          store.queue(d.entity, d.id, "delete", "{}");
          result.queued += 1;
        }
      }
    }
  } else if (options.restoreDeletions) {
    // Rows still in the Sheet need nothing; the rest go back.
    for (const d of deletions) if (d.local && !d.inSheet) writeBack(d);
  }

  for (const ref of restores) writeBack(ref);

  const deletedKeys = new Set(
    options.applyDeletions ? deletions.map((d) => guardKey(d.entity, d.id)) : []
  );
  const inserts: PlannedInsert[] = [...plan.inserts, ...options.writtenNewRows];
  // Parents before children for inserts.
  for (const entity of PULLED_ENTITIES) {
    for (const insert of inserts) {
      if (insert.entity !== entity) continue;
      if (isGuarded(entity, insert.record.id)) {
        result.changedDuringSync += 1;
        continue;
      }
      store.insert(entity, insert.record);
      result.inserted += 1;
    }
  }

  for (const update of plan.updates) {
    if (deletedKeys.has(guardKey(update.entity, update.id))) continue;
    if (isGuarded(update.entity, update.id)) {
      result.changedDuringSync += 1;
      continue;
    }
    store.update(update.entity, update.id, update.changes as Record<string, unknown>);
    result.updated += 1;
  }

  for (const entity of PULLED_ENTITIES) {
    const ids = plan.seen[entity].filter((id) => !deletedKeys.has(guardKey(entity, id)));
    if (ids.length > 0) store.stamp(entity, ids, options.now);
  }

  return result;
}

/**
 * A PullStore that builds each statement with drizzle and runs it on the
 * synchronous executor, so a whole apply fits in one `executor.transaction`.
 */
export function createSqlPullStore(db: Database, sql: SqlExecutor, now: Date): PullStore {
  const exec = (query: { toSQL(): { sql: string; params: unknown[] } }) => {
    const { sql: statement, params } = query.toSQL();
    sql.run(statement, params);
  };
  return {
    guardedKeys() {
      const rows = sql.all<{ entity: string; entity_id: string }>(
        "SELECT entity, entity_id FROM pending_mutations WHERE status IN ('pending', 'failed')"
      );
      return new Set(rows.map((r) => guardKey(r.entity, r.entity_id)));
    },
    insert(entity, record) {
      exec(db.insert(PULLED_TABLES[entity]).values(record as never));
    },
    update(entity, id, changes) {
      const table = PULLED_TABLES[entity];
      exec(db.update(table).set(changes).where(eq(table.id, id)));
    },
    delete(entity, id) {
      const table = PULLED_TABLES[entity];
      exec(db.delete(table).where(eq(table.id, id)));
    },
    stamp(entity, ids, at) {
      const table = PULLED_TABLES[entity];
      // Chunked to stay under SQLite's bound-parameter limit.
      for (let i = 0; i < ids.length; i += 500) {
        exec(
          db
            .update(table)
            .set({ pushedAt: at })
            .where(inArray(table.id, ids.slice(i, i + 500)))
        );
      }
    },
    queue(entity, id, operation, payload) {
      exec(
        db.insert(pendingMutations).values({
          id: Crypto.randomUUID(),
          entity,
          entityId: id,
          operation,
          payload,
          status: "pending",
          retryCount: 0,
          createdAt: now
        })
      );
    }
  };
}
