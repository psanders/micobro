/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Replays queued local writes (pending_mutations) to the lender's Google
 * Sheet. Pull/two-way sync and conflict resolution are a deliberate
 * follow-up — this establishes the push half of the loop end to end.
 */
import { eq, and, or, lt } from "drizzle-orm";
import { pendingMutations, syncMeta } from "../db/schema";
import { appendRow } from "./sheetsClient";
import { getSheetId } from "./config";
import { logger } from "../logger";
import type { Database } from "../db/client";

// Exported so syncRepo.getStatus() can compute pendingCount/stuckCount against
// the exact same cap this query retries against.
export const MAX_RETRIES = 5;
export const LAST_PUSHED_AT_KEY = "lastPushedAt";

// Assumes the lender's Google Sheet has tabs named "Clientes", "Préstamos",
// "Pagos", and "Visitas" with columns in the order the row-value mappers
// below emit them.
// Exported so provisioning (lib/sync/provisionSheet.ts) creates tabs whose
// names and column widths match exactly what push writes here.
export const ENTITY_RANGES: Record<string, string> = {
  customer: "Clientes!A:F",
  loan: "Préstamos!A:K",
  payment: "Pagos!A:G",
  visit: "Visitas!A:H"
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

// Column order mirrors the `loans` table in lib/db/schema.ts.
function loanRowValues(payload: Record<string, unknown>): (string | number | null)[] {
  return [
    payload.id as string,
    payload.customerId as string,
    payload.principalCents as number,
    payload.interestRateBps as number,
    payload.termCount as number,
    payload.frequency as string,
    payload.startDate as string,
    payload.status as string,
    (payload.notes as string) ?? "",
    payload.createdAt as string,
    payload.updatedAt as string
  ];
}

// Column order mirrors the `payments` table in lib/db/schema.ts.
function paymentRowValues(payload: Record<string, unknown>): (string | number | null)[] {
  return [
    payload.id as string,
    payload.loanId as string,
    payload.amountCents as number,
    payload.paidAt as string,
    (payload.method as string) ?? "",
    (payload.notes as string) ?? "",
    payload.createdAt as string
  ];
}

// Column order mirrors the `visits` table in lib/db/schema.ts.
function visitRowValues(payload: Record<string, unknown>): (string | number | null)[] {
  return [
    payload.id as string,
    payload.customerId as string,
    (payload.loanId as string) ?? "",
    payload.outcome as string,
    (payload.promiseDate as string) ?? "",
    (payload.promiseAmountCents as number) ?? "",
    (payload.note as string) ?? "",
    payload.createdAt as string
  ];
}

const ROW_MAPPERS: Record<
  string,
  (payload: Record<string, unknown>) => (string | number | null)[]
> = {
  customer: customerRowValues,
  loan: loanRowValues,
  payment: paymentRowValues,
  visit: visitRowValues
};

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

  // "failed" rows below the retry cap must stay eligible, or a single
  // transient failure (e.g. a push attempted while offline) makes that
  // mutation permanently invisible to every future push — silent data loss.
  const pending = await db
    .select()
    .from(pendingMutations)
    .where(
      and(
        or(eq(pendingMutations.status, "pending"), eq(pendingMutations.status, "failed")),
        lt(pendingMutations.retryCount, MAX_RETRIES)
      )
    );

  let pushed = 0;
  let failed = 0;

  for (const mutation of pending) {
    const range = ENTITY_RANGES[mutation.entity];
    if (!range) continue;

    // appendRow only adds rows; there's no update-by-id support in
    // sheetsClient yet, so pushing an "update" mutation would append a
    // duplicate row instead of correcting the existing one. Leave it
    // queued (not failed) until update-row support ships.
    if (mutation.operation !== "create") continue;

    try {
      const payload = JSON.parse(mutation.payload);
      const mapRow = ROW_MAPPERS[mutation.entity];
      const values = mapRow ? mapRow(payload) : [];
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

  await db
    .insert(syncMeta)
    .values({ key: LAST_PUSHED_AT_KEY, value: String(Date.now()) })
    .onConflictDoUpdate({ target: syncMeta.key, set: { value: String(Date.now()) } });

  logger.info("push complete", { pushed, failed });
  return { pushed, failed };
}
