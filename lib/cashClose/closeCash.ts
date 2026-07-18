/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import * as Crypto from "expo-crypto";
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { closeCashSchema, type CloseCashInput, type CashClose } from "./cashClose.schema";
import { createGetCashSummary } from "./getCashSummary";
import { cashCloses, pendingMutations } from "../db/schema";
import { logger } from "../logger";
import type { Database } from "../db/client";

export interface CloseCashDeps {
  db: Database;
}

/**
 * Closes the caja: rejects (no side effect) unless the lender's verified
 * total exactly matches the system-computed total, and unless there's a
 * non-zero total to close. On success, records an immutable ledger row
 * covering the reconciled period and enqueues it for sync — the same
 * pending_mutations path every other entity uses.
 */
export function createCloseCash({ db }: CloseCashDeps) {
  const getCashSummary = createGetCashSummary({ db });

  const fn = async (params: CloseCashInput): Promise<CashClose> => {
    const summary = await getCashSummary({});

    if (summary.totalCents === 0) {
      throw new Error("No hay nada que cerrar: el total es RD$0.");
    }
    if (params.verifiedCents !== summary.totalCents) {
      throw new Error("El total verificado no coincide con el total del sistema.");
    }

    const now = new Date();
    const close: CashClose = {
      id: Crypto.randomUUID(),
      amountCents: summary.totalCents,
      periodStart: summary.periodStart,
      closedAt: now,
      createdAt: now
    };

    await db.insert(cashCloses).values(close);
    await db.insert(pendingMutations).values({
      id: Crypto.randomUUID(),
      entity: "cashClose",
      entityId: close.id,
      operation: "create",
      payload: JSON.stringify(close),
      status: "pending",
      retryCount: 0,
      createdAt: now
    });

    logger.verbose("cash closed", { id: close.id, amountCents: close.amountCents });
    return close;
  };

  return withErrorHandlingAndValidation(fn, closeCashSchema);
}
