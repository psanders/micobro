/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Replays the outbox (`pending_mutations`) to the back office while this
 * device is connected — the back office counterpart of `../push.ts`. Same
 * eligibility as the Sheet push (pending, or failed below `MAX_RETRIES`), in
 * outbox order, at most 100 mutations per request. How each result lands:
 *
 *   applied / duplicate                 → the rows are deleted (drift is logged)
 *   NOT_YET / NOT_FOUND                 → stay pending, no attempt counted
 *   UPSTREAM, or the back office failed → one attempt counted, as today
 *   no answer at all (offline)          → untouched; sent on the next trigger
 *   UNSUPPORTED / CONFLICT / VALIDATION → "Necesita atención": retryCount set
 *                                         to the cap, with a Spanish lastError
 *   401                                 → the device was disconnected; stop
 */
import { and, asc, eq, gt, inArray, lt, lte, or, sql } from "drizzle-orm";
import { CONTRACT_VERSION, toOffsetIso, type MutationResult } from "@micobro/contract";
import { payments, pendingMutations, syncMeta } from "../../db/schema";
import { logger } from "../../logger";
import { LAST_PUSHED_AT_KEY, MAX_RETRIES, type PushResult } from "../outbox";
import { toMutations, type Mapped, type OutboxRow } from "./adapter";
import { BackofficeError, type BackofficeClient } from "./client";
import type { BackofficeConnection } from "./connection";
import type { Payment } from "../../payments/payment.schema";
import type { Database } from "../../db/client";

export const BATCH_SIZE = 100;

export interface BackofficePushResult extends PushResult {
  /** The back office refused this device's credential; the app is now disconnected. */
  revoked: boolean;
}

/** The Spanish explanation kept on a change the back office can't apply. */
export function attentionMessage(error: NonNullable<MutationResult["error"]>): string {
  const tag = ` [${error.code}${error.gap ? ` ${error.gap}` : ""}]`;
  if (error.gap === "G-OPEN-CREDIT")
    return `El back office todavía no maneja crédito abierto.${tag}`;
  if (error.gap === "G-LOAN-CORRECTION") {
    return `El back office no puede cambiar el tipo o la frecuencia de un préstamo ya creado.${tag}`;
  }
  if (error.message.includes("duplicate.mobileNo"))
    return `Otro cliente ya usa este teléfono.${tag}`;
  if (error.code === "UNSUPPORTED") return `El back office todavía no maneja este cambio.${tag}`;
  if (error.code === "VALIDATION")
    return `Este cambio no tiene el formato que espera el back office.${tag}`;
  return `El back office no aceptó este cambio.${tag}`;
}

const RETRY_WITHOUT_COUNTING = ["NOT_YET", "NOT_FOUND"];
const NEEDS_ATTENTION = ["UNSUPPORTED", "CONFLICT", "VALIDATION"];

export function createPushToBackoffice(deps: {
  db: Database;
  client: BackofficeClient;
  connection: BackofficeConnection;
}) {
  const { db, client, connection } = deps;

  async function paymentsBetween(from: Date | null, to: Date): Promise<Payment[]> {
    const rows = await db
      .select()
      .from(payments)
      .where(and(from ? gt(payments.paidAt, from) : undefined, lte(payments.paidAt, to)))
      .orderBy(asc(payments.paidAt));
    return rows as Payment[];
  }

  // createdAt has second precision in SQLite, so rows made in the same second
  // tie; rowid (insertion order) breaks the tie, keeping a customer ahead of
  // its loans.
  async function eligible(): Promise<OutboxRow[]> {
    const rows = await db
      .select()
      .from(pendingMutations)
      .where(
        and(
          or(eq(pendingMutations.status, "pending"), eq(pendingMutations.status, "failed")),
          lt(pendingMutations.retryCount, MAX_RETRIES)
        )
      )
      .orderBy(asc(pendingMutations.createdAt), sql`rowid`);
    return rows as OutboxRow[];
  }

  async function setRows(ids: string[], values: Partial<typeof pendingMutations.$inferInsert>) {
    if (ids.length)
      await db.update(pendingMutations).set(values).where(inArray(pendingMutations.id, ids));
  }

  async function countAttempt(rows: Mapped[], all: OutboxRow[], error: string) {
    for (const m of rows) {
      for (const id of m.rowIds) {
        const row = all.find((r) => r.id === id);
        await setRows([id], {
          status: "failed",
          retryCount: (row?.retryCount ?? 0) + 1,
          lastError: error
        });
      }
    }
  }

  return async function pushToBackoffice(): Promise<BackofficePushResult> {
    const result: BackofficePushResult = { pushed: 0, failed: 0, revoked: false };
    if (!(await connection.isActive())) return result;
    const credential = (await connection.credential())!;
    const deviceId = await connection.deviceId();

    const rows = await eligible();
    const { mapped, dropped } = await toMutations(rows, { paymentsBetween });
    if (dropped.length)
      await db.delete(pendingMutations).where(inArray(pendingMutations.id, dropped));

    for (let start = 0; start < mapped.length; start += BATCH_SIZE) {
      const batch = mapped.slice(start, start + BATCH_SIZE);
      let response;
      try {
        response = await client.sync(credential, {
          contractVersion: CONTRACT_VERSION,
          deviceId,
          sentAt: toOffsetIso(new Date()),
          mutations: batch.map((m) => m.mutation)
        });
      } catch (error) {
        if (error instanceof BackofficeError && error.kind === "unauthenticated") {
          await connection.markRevoked();
          logger.warn("back office revoked this device");
          return { ...result, revoked: true };
        }
        if (!(error instanceof BackofficeError && error.kind === "offline")) {
          await countAttempt(batch, rows, String(error));
          result.failed += batch.length;
        }
        logger.warn("back office push stopped", { error: String(error) });
        break;
      }

      const byId = new Map(response.results.map((r) => [r.mutationId, r]));
      for (const m of batch) {
        const r = byId.get(m.mutation.mutationId);
        if (!r) continue;
        if (r.status !== "rejected") {
          if (r.drift.length)
            logger.info("back office drift", { type: m.mutation.type, drift: r.drift });
          await db.delete(pendingMutations).where(inArray(pendingMutations.id, m.rowIds));
          result.pushed += 1;
          continue;
        }
        const error = r.error!;
        if (RETRY_WITHOUT_COUNTING.includes(error.code)) {
          await setRows(m.rowIds, {
            status: "pending",
            lastError: `${error.code}: ${error.message}`
          });
        } else if (NEEDS_ATTENTION.includes(error.code)) {
          await setRows(m.rowIds, {
            status: "failed",
            retryCount: MAX_RETRIES,
            lastError: attentionMessage(error)
          });
          result.failed += 1;
        } else {
          await countAttempt([m], rows, `${error.code}: ${error.message}`);
          result.failed += 1;
        }
      }
    }

    await db
      .insert(syncMeta)
      .values({ key: LAST_PUSHED_AT_KEY, value: String(Date.now()) })
      .onConflictDoUpdate({ target: syncMeta.key, set: { value: String(Date.now()) } });
    logger.info("back office push complete", { pushed: result.pushed, failed: result.failed });
    return result;
  };
}
