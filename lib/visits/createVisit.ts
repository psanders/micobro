/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import * as Crypto from "expo-crypto";
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { createVisitSchema, type CreateVisitInput, type Visit } from "./visit.schema";
import { visits, pendingMutations } from "../db/schema";
import { logger } from "../logger";
import type { Database } from "../db/client";

export interface CreateVisitDeps {
  db: Database;
}

/**
 * Records a visit outcome and enqueues a pending_mutations row, same
 * replay-to-Sheets contract as createCustomer/createPayment.
 */
export function createCreateVisit({ db }: CreateVisitDeps) {
  const fn = async (params: CreateVisitInput): Promise<Visit> => {
    logger.verbose("recording visit", { customerId: params.customerId, outcome: params.outcome });

    const now = new Date();
    const visit: Visit = {
      id: Crypto.randomUUID(),
      customerId: params.customerId,
      loanId: params.loanId ?? null,
      outcome: params.outcome,
      promiseDate: params.promiseDate ?? null,
      promiseAmountCents: params.promiseAmount ?? null,
      note: params.note ?? null,
      createdAt: now
    };

    await db.insert(visits).values(visit);
    await db.insert(pendingMutations).values({
      id: Crypto.randomUUID(),
      entity: "visit",
      entityId: visit.id,
      operation: "create",
      payload: JSON.stringify(visit),
      status: "pending",
      retryCount: 0,
      createdAt: now
    });

    logger.verbose("visit recorded", { id: visit.id });
    return visit;
  };

  return withErrorHandlingAndValidation(fn, createVisitSchema);
}

export type { CreateVisitInput };
