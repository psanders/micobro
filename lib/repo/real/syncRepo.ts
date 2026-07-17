/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { eq, and, or, lt, gte } from "drizzle-orm";
import { pendingMutations, syncMeta } from "../../db/schema";
import { isSignedInToGoogle, signInWithGoogle, signOutOfGoogle } from "../../sync/googleAuth";
import { getSheetId } from "../../sync/config";
import { provisionSheet } from "../../sync/provisionSheet";
import { pushPendingMutations, LAST_PUSHED_AT_KEY, MAX_RETRIES } from "../../sync/push";
import type { Database } from "../../db/client";
import type { SyncRepo, SyncStatus } from "../types";

export function createRealSyncRepo({ db }: { db: Database }): SyncRepo {
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

    const metaRows = await db.select().from(syncMeta).where(eq(syncMeta.key, LAST_PUSHED_AT_KEY));
    const lastPushedAtRaw = metaRows[0]?.value;

    return {
      connected,
      sheetId,
      lastPushedAt: lastPushedAtRaw ? new Date(Number(lastPushedAtRaw)) : null,
      pendingCount: pending.length,
      stuckCount: stuck.length
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
    pushNow: () => pushPendingMutations(db)
  };
}
