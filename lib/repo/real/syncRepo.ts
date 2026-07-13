/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { eq } from "drizzle-orm";
import { pendingMutations, syncMeta } from "../../db/schema";
import { getValidAccessToken, exchangeCodeForTokens, signOutOfGoogle } from "../../sync/googleAuth";
import { getSheetId } from "../../sync/config";
import { pushPendingMutations, LAST_PUSHED_AT_KEY } from "../../sync/push";
import type { Database } from "../../db/client";
import type { SyncRepo, SyncStatus } from "../types";

export function createRealSyncRepo({ db }: { db: Database }): SyncRepo {
  async function getStatus(): Promise<SyncStatus> {
    const accessToken = await getValidAccessToken();
    const sheetId = await getSheetId();

    const pending = await db
      .select()
      .from(pendingMutations)
      .where(eq(pendingMutations.status, "pending"));

    const metaRows = await db.select().from(syncMeta).where(eq(syncMeta.key, LAST_PUSHED_AT_KEY));
    const lastPushedAtRaw = metaRows[0]?.value;

    return {
      connected: accessToken !== null,
      sheetId,
      lastPushedAt: lastPushedAtRaw ? new Date(Number(lastPushedAtRaw)) : null,
      pendingCount: pending.length
    };
  }

  return {
    getStatus,
    async connect({ code, codeVerifier, redirectUri }) {
      await exchangeCodeForTokens(code, codeVerifier, redirectUri);
      return getStatus();
    },
    async disconnect() {
      await signOutOfGoogle();
    },
    pushNow: () => pushPendingMutations(db)
  };
}
