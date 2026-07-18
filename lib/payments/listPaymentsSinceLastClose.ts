/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { z } from "zod/v4";
import { desc } from "drizzle-orm";
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { cashCloses, payments } from "../db/schema";
import type { Payment } from "./payment.schema";
import type { Database } from "../db/client";

export interface ListPaymentsSinceLastCloseDeps {
  db: Database;
}

const listPaymentsSinceLastCloseSchema = z.object({});

/**
 * Cuadre General's data source: every payment (any method) since the last
 * caja close, or all payments if none exists yet. Replaces the old
 * "today only" scoping now that Cuadre reconciles the caja, not the day.
 */
export function createListPaymentsSinceLastClose({ db }: ListPaymentsSinceLastCloseDeps) {
  const fn = async (): Promise<Payment[]> => {
    const lastClose = (
      await db.select().from(cashCloses).orderBy(desc(cashCloses.closedAt)).limit(1)
    )[0];

    const rows = (await db.select().from(payments)) as Payment[];
    if (!lastClose) return rows;
    return rows.filter((p) => p.paidAt.getTime() > lastClose.closedAt.getTime());
  };

  return withErrorHandlingAndValidation(fn, listPaymentsSinceLastCloseSchema);
}
