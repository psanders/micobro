/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * One-time re-send of customers that already have a cédula, so rows pushed
 * before the Cédula column existed get it filled in. Without it, the first
 * pull would read those rows' empty Cédula cell and — remote wins — erase
 * the cédula stored on the device. Each queued update also arms pull's
 * unpushed-edit guard for that customer until it lands.
 *
 * Customers that already have a queued mutation are skipped: its payload
 * carries the cédula already, and a second mutation could race the
 * unordered create and append a duplicate row. That filter also makes a
 * rerun after an interrupted pass harmless, so no transaction is needed.
 */
import * as Crypto from "expo-crypto";
import { z } from "zod/v4";
import { and, eq, isNotNull, or } from "drizzle-orm";
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { customers, pendingMutations, syncMeta } from "../db/schema";
import { logger } from "../logger";
import type { Database } from "../db/client";

export const CEDULA_RESEND_KEY = "cedulaResendVersion";
const CEDULA_RESEND_VERSION = "1";

export interface QueueCedulaResendDeps {
  db: Database;
}

/**
 * Creates a function that queues the one-time cédula re-send and returns how
 * many customer update mutations it queued (0 once it has already run).
 */
export function createQueueCedulaResend({ db }: QueueCedulaResendDeps) {
  const fn = async (): Promise<number> => {
    const done = await db.select().from(syncMeta).where(eq(syncMeta.key, CEDULA_RESEND_KEY));
    if (done[0]?.value === CEDULA_RESEND_VERSION) return 0;

    const withCedula = await db.select().from(customers).where(isNotNull(customers.cedula));
    const queued = await db
      .select()
      .from(pendingMutations)
      .where(
        and(
          eq(pendingMutations.entity, "customer"),
          or(eq(pendingMutations.status, "pending"), eq(pendingMutations.status, "failed"))
        )
      );
    const alreadyQueued = new Set(queued.map((mutation) => mutation.entityId));

    const now = new Date();
    let count = 0;
    for (const customer of withCedula) {
      if (alreadyQueued.has(customer.id)) continue;
      await db.insert(pendingMutations).values({
        id: Crypto.randomUUID(),
        entity: "customer",
        entityId: customer.id,
        operation: "update",
        payload: JSON.stringify(customer),
        status: "pending",
        retryCount: 0,
        createdAt: now
      });
      count += 1;
    }

    await db
      .insert(syncMeta)
      .values({ key: CEDULA_RESEND_KEY, value: CEDULA_RESEND_VERSION })
      .onConflictDoUpdate({ target: syncMeta.key, set: { value: CEDULA_RESEND_VERSION } });

    logger.info("queued one-time cédula re-send", { count });
    return count;
  };

  return withErrorHandlingAndValidation(fn, z.object({}));
}
