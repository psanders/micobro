/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * The synchronous writes behind a customer's photo, for createCustomer and
 * updateCustomer to run inside the same `SqlExecutor.transaction` as the
 * customer row. Statements are built with drizzle (`.toSQL()`) and run on the
 * executor, like the pull applier (lib/sync/applyPullPlan.ts). drizzle's own
 * `db.transaction` is not used: on expo-sqlite it commits before awaited
 * writes run, so it would not roll back on the phone.
 */
import * as Crypto from "expo-crypto";
import { and, eq, inArray } from "drizzle-orm";
import { customerPhotos, pendingMutations } from "../db/schema";
import type { Database } from "../db/client";
import type { SqlExecutor } from "../db/sqlExecutor";

export const CUSTOMER_PHOTO_ENTITY = "customerPhoto";

type Query = { toSQL(): { sql: string; params: unknown[] } };

/** Runs one drizzle-built statement on the executor. */
export function execOn(sql: SqlExecutor) {
  return (query: Query) => {
    const { sql: statement, params } = query.toSQL();
    sql.run(statement, params);
  };
}

/**
 * Applies `photo` to the customer: undefined keeps it, a string saves or
 * replaces it and queues an "update" (empty payload: push reads the row),
 * null removes it and queues a "delete" — or nothing when there was none.
 * A customer keeps at most one pending customerPhoto mutation, since push
 * does not process the queue in order.
 */
export function writeCustomerPhoto(
  db: Database,
  sql: SqlExecutor,
  customerId: string,
  photo: string | null | undefined,
  now: Date
): void {
  if (photo === undefined) return;
  const exec = execOn(sql);

  if (photo === null) {
    const { sql: select, params } = db
      .select({ id: customerPhotos.id })
      .from(customerPhotos)
      .where(eq(customerPhotos.id, customerId))
      .toSQL();
    if (sql.all(select, params).length === 0) return;
    exec(db.delete(customerPhotos).where(eq(customerPhotos.id, customerId)));
  } else {
    exec(
      db
        .insert(customerPhotos)
        .values({ id: customerId, photo, createdAt: now, updatedAt: now })
        .onConflictDoUpdate({ target: customerPhotos.id, set: { photo, updatedAt: now } })
    );
  }

  exec(
    db
      .delete(pendingMutations)
      .where(
        and(
          eq(pendingMutations.entity, CUSTOMER_PHOTO_ENTITY),
          eq(pendingMutations.entityId, customerId),
          inArray(pendingMutations.status, ["pending", "failed"])
        )
      )
  );
  exec(
    db.insert(pendingMutations).values({
      id: Crypto.randomUUID(),
      entity: CUSTOMER_PHOTO_ENTITY,
      entityId: customerId,
      operation: photo === null ? "delete" : "update",
      payload: photo === null ? "{}" : "",
      status: "pending",
      retryCount: 0,
      createdAt: now
    })
  );
}
