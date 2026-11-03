/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * The initial upload: right after connecting, the outbox is replaced by a
 * snapshot of everything on the phone, as creates in dependency order —
 * customers, loans (an archived loan followed by its archive), payments,
 * visits, cash closes, each by creation time. The back office learns the
 * current state directly; queued Sheet-bound edits have nothing to add.
 */
import { asc } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import { cashCloses, customers, loans, payments, pendingMutations, visits } from "../../db/schema";
import { ARCHIVED_LOAN_STATUS } from "../../loans/loan.schema";
import type { Database } from "../../db/client";

type Row = { id: string; createdAt: Date };

export function createQueueSnapshot({ db }: { db: Database }) {
  return async function queueSnapshot(): Promise<number> {
    const [c, l, p, v, k] = await Promise.all([
      db.select().from(customers).orderBy(asc(customers.createdAt)),
      db.select().from(loans).orderBy(asc(loans.createdAt)),
      db.select().from(payments).orderBy(asc(payments.createdAt), asc(payments.paidAt)),
      db.select().from(visits).orderBy(asc(visits.createdAt)),
      db.select().from(cashCloses).orderBy(asc(cashCloses.createdAt))
    ]);

    // Inserted in dependency order: the push reads the outbox by createdAt,
    // then insertion order (rowid), and every row here shares `now`.
    const now = new Date();
    const entries: (typeof pendingMutations.$inferInsert)[] = [];
    const add = (entity: string, row: Row, operation = "create") =>
      entries.push({
        id: randomUUID(),
        entity,
        entityId: row.id,
        operation,
        payload: JSON.stringify(row),
        status: "pending",
        retryCount: 0,
        createdAt: now
      });

    for (const row of c) add("customer", row);
    for (const row of l) {
      add("loan", row);
      if (row.status === ARCHIVED_LOAN_STATUS) add("loan", row, "update");
    }
    for (const row of p) add("payment", row);
    for (const row of v) add("visit", row);
    for (const row of k) add("cashClose", row);

    await db.transaction(async (tx) => {
      await tx.delete(pendingMutations);
      for (let i = 0; i < entries.length; i += 200) {
        await tx.insert(pendingMutations).values(entries.slice(i, i + 200));
      }
    });
    return entries.length;
  };
}
