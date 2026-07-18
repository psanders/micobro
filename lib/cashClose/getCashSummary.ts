/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { z } from "zod/v4";
import { desc } from "drizzle-orm";
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { cashCloses, payments } from "../db/schema";
import type { Database } from "../db/client";
import type { CashSummary } from "./cashClose.schema";

export interface GetCashSummaryDeps {
  db: Database;
}

const getCashSummarySchema = z.object({});

/**
 * The system-computed caja total: every payment (any method) recorded
 * since the last close, or since the beginning if none exists yet. Derived
 * fresh on every read — no persisted running counter — same pattern as
 * `composeRouteDay.ts`'s totals.
 */
export function createGetCashSummary({ db }: GetCashSummaryDeps) {
  const fn = async (): Promise<CashSummary> => {
    const lastClose = (
      await db.select().from(cashCloses).orderBy(desc(cashCloses.closedAt)).limit(1)
    )[0];
    const periodStart = lastClose?.closedAt ?? null;

    const allPayments = await db.select().from(payments);
    const relevant = periodStart
      ? allPayments.filter((p) => p.paidAt.getTime() > periodStart.getTime())
      : allPayments;

    return {
      totalCents: relevant.reduce((sum, p) => sum + p.amountCents, 0),
      periodStart
    };
  };

  return withErrorHandlingAndValidation(fn, getCashSummarySchema);
}
