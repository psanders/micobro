/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Replays queued local writes (pending_mutations) to the lender's Google
 * Sheet. Pull/two-way sync and conflict resolution are a deliberate
 * follow-up — this establishes the push half of the loop end to end.
 */
import { eq, and, lt } from "drizzle-orm";
import { pendingMutations } from "../db/schema";
import { appendRow } from "./sheetsClient";
import { getSheetId } from "./config";
import { logger } from "../logger";
import type { Database } from "../db/client";

const MAX_RETRIES = 5;

const ENTITY_RANGES: Record<string, string> = {
  customer: "Clientes!A:F"
};

function customerRowValues(payload: Record<string, unknown>): (string | number | null)[] {
  return [
    payload.id as string,
    payload.name as string,
    payload.phone as string,
    (payload.address as string) ?? "",
    payload.createdAt as string,
    payload.updatedAt as string
  ];
}

export interface PushResult {
  pushed: number;
  failed: number;
}

export async function pushPendingMutations(db: Database): Promise<PushResult> {
  const sheetId = await getSheetId();
  if (!sheetId) {
    logger.warn("no sheet configured, skipping push");
    return { pushed: 0, failed: 0 };
  }

  const pending = await db
    .select()
    .from(pendingMutations)
    .where(
      and(eq(pendingMutations.status, "pending"), lt(pendingMutations.retryCount, MAX_RETRIES))
    );

  let pushed = 0;
  let failed = 0;

  for (const mutation of pending) {
    const range = ENTITY_RANGES[mutation.entity];
    if (!range) continue;

    try {
      const payload = JSON.parse(mutation.payload);
      const values = mutation.entity === "customer" ? customerRowValues(payload) : [];
      await appendRow(sheetId, range, values);
      await db.delete(pendingMutations).where(eq(pendingMutations.id, mutation.id));
      pushed += 1;
    } catch (err) {
      await db
        .update(pendingMutations)
        .set({ status: "failed", retryCount: mutation.retryCount + 1, lastError: String(err) })
        .where(eq(pendingMutations.id, mutation.id));
      failed += 1;
    }
  }

  logger.info("push complete", { pushed, failed });
  return { pushed, failed };
}
