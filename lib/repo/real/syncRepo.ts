/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { eq, and, or, lt, gte } from "drizzle-orm";
import { pendingMutations, syncMeta } from "../../db/schema";
import { isSignedInToGoogle, signInWithGoogle, signOutOfGoogle } from "../../sync/googleAuth";
import { getSheetId } from "../../sync/config";
import { provisionSheet } from "../../sync/provisionSheet";
import { pushPendingMutations, LAST_PUSHED_AT_KEY, MAX_RETRIES } from "../../sync/push";
import {
  pullEntities,
  LAST_PULLED_AT_KEY,
  HELD_DELETIONS_KEY,
  SYNC_PROBLEMS_KEY
} from "../../sync/pull";
import {
  createCreateBackup,
  createListBackups,
  createRestoreBackup,
  createSqliteBackupDriver
} from "../../backups";
import { verifyPin } from "../../security/pin";
import { BackupFailedError } from "../../sync/syncErrors";
import { createExpoSqlExecutor } from "../../db/sqlExecutor";
import type { DeletionMode } from "../../sync/pull";
import type { BackupDriver } from "../../backups";
import type { SqlExecutor } from "../../db/sqlExecutor";
import type { Database } from "../../db/client";
import type { SyncRepo, SyncStatus } from "../types";

function parseJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export interface RealSyncRepoDeps {
  db: Database;
  /** Synchronous SQL for applying pulls; defaults to the app's expo-sqlite connection. */
  sql?: SqlExecutor;
  backupDriver?: BackupDriver;
}

export function createRealSyncRepo({
  db,
  sql = createExpoSqlExecutor(db),
  backupDriver = createSqliteBackupDriver(db)
}: RealSyncRepoDeps): SyncRepo {
  const createBackup = createCreateBackup({ driver: backupDriver });
  const listBackups = createListBackups({ driver: backupDriver });
  const restoreBackup = createRestoreBackup({ driver: backupDriver, verifyPin });

  async function metaValue(key: string): Promise<string | undefined> {
    const rows = await db.select().from(syncMeta).where(eq(syncMeta.key, key));
    return rows[0]?.value;
  }

  /**
   * Backup → push → pull, then push again when the pull queued Sheet work
   * (cascaded deletes, rows written back, kept rows) so it lands in the same
   * sync. Sequential: pull's guard needs push to have drained the queue
   * first, and the two must never race over the same Sheet rows.
   */
  async function fullSync(deletions: DeletionMode) {
    if (await getSheetId()) {
      try {
        await createBackup({});
      } catch (err) {
        throw new BackupFailedError(err);
      }
    }
    const push = await pushPendingMutations(db);
    const pull = await pullEntities(db, { deletions, sql });
    if (pull.queued > 0) {
      const again = await pushPendingMutations(db);
      return {
        push: { pushed: push.pushed + again.pushed, failed: again.failed },
        pull
      };
    }
    return { push, pull };
  }

  async function getStatus(): Promise<SyncStatus> {
    const connected = isSignedInToGoogle();
    const sheetId = await getSheetId();

    // Mirrors push.ts's own query: everything still eligible for a retry
    // counts as pending, so the lender never sees "0 pendientes" while a
    // mutation is silently stuck.
    const pending = await db
      .select()
      .from(pendingMutations)
      .where(
        and(
          or(eq(pendingMutations.status, "pending"), eq(pendingMutations.status, "failed")),
          lt(pendingMutations.retryCount, MAX_RETRIES)
        )
      );

    const stuck = await db
      .select()
      .from(pendingMutations)
      .where(
        and(eq(pendingMutations.status, "failed"), gte(pendingMutations.retryCount, MAX_RETRIES))
      );

    const pushMetaRows = await db
      .select()
      .from(syncMeta)
      .where(eq(syncMeta.key, LAST_PUSHED_AT_KEY));
    const lastPushedAtRaw = pushMetaRows[0]?.value;

    const pullMetaRows = await db
      .select()
      .from(syncMeta)
      .where(eq(syncMeta.key, LAST_PULLED_AT_KEY));
    const lastPulledAtRaw = pullMetaRows[0]?.value;

    return {
      connected,
      sheetId,
      lastPushedAt: lastPushedAtRaw ? new Date(Number(lastPushedAtRaw)) : null,
      lastPulledAt: lastPulledAtRaw ? new Date(Number(lastPulledAtRaw)) : null,
      pendingCount: pending.length,
      stuckCount: stuck.length,
      heldDeletions: parseJson(await metaValue(HELD_DELETIONS_KEY), null),
      syncProblems: parseJson(await metaValue(SYNC_PROBLEMS_KEY), [])
    };
  }

  return {
    getStatus,
    async connect() {
      // Provision the lender's backup sheet only after a real sign-in (skip on
      // cancel). A provisioning error propagates so the Conectar screen can show
      // it; local SQLite is never touched, and a later connect retries.
      const signedIn = await signInWithGoogle();
      if (signedIn) {
        await provisionSheet(db);
      }
      return getStatus();
    },
    async disconnect() {
      await signOutOfGoogle();
    },
    pushNow: () => pushPendingMutations(db),
    syncNow: () => fullSync("auto"),
    resolveHeldDeletions: (choice) => fullSync(choice),
    listBackups: () => listBackups({}),
    restoreBackup: (name, pin) => restoreBackup({ name, pin })
  };
}
