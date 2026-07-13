/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import * as Crypto from "expo-crypto";
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { createPaymentSchema, type CreatePaymentInput, type Payment } from "./payment.schema";
import { payments, pendingMutations } from "../db/schema";
import { logger } from "../logger";
import type { Database } from "../db/client";

export interface CreatePaymentDeps {
  db: Database;
}

/**
 * Creates a function that inserts a payment locally and enqueues a
 * pending_mutations row so the sync engine can replay it to Google Sheets
 * next time the device is online.
 */
export function createCreatePayment({ db }: CreatePaymentDeps) {
  const fn = async (params: CreatePaymentInput): Promise<Payment> => {
    logger.verbose("creating payment", { loanId: params.loanId });

    const now = new Date();
    const payment: Payment = {
      id: Crypto.randomUUID(),
      loanId: params.loanId,
      amountCents: params.amount,
      paidAt: params.paidAt ?? now,
      method: params.method ?? null,
      notes: params.notes ?? null,
      createdAt: now
    };

    await db.insert(payments).values(payment);
    await db.insert(pendingMutations).values({
      id: Crypto.randomUUID(),
      entity: "payment",
      entityId: payment.id,
      operation: "create",
      payload: JSON.stringify(payment),
      status: "pending",
      retryCount: 0,
      createdAt: now
    });

    logger.verbose("payment created", { id: payment.id });
    return payment;
  };

  return withErrorHandlingAndValidation(fn, createPaymentSchema);
}

export type { CreatePaymentInput };
