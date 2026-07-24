/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import * as Crypto from "expo-crypto";
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { createLoanSchema, type CreateLoanInput, type Loan } from "./loan.schema";
import { loans, pendingMutations } from "../db/schema";
import { logger } from "../logger";
import type { Database } from "../db/client";

export interface CreateLoanDeps {
  db: Database;
}

/**
 * Creates a function that inserts a loan locally and enqueues a
 * pending_mutations row so the sync engine can replay it to Google Sheets
 * next time the device is online.
 */
export function createCreateLoan({ db }: CreateLoanDeps) {
  const fn = async (params: CreateLoanInput): Promise<Loan> => {
    logger.verbose("creating loan", { customerId: params.customerId });

    const now = new Date();
    const loan: Loan = {
      id: Crypto.randomUUID(),
      customerId: params.customerId,
      principalCents: params.principal,
      interestRateBps: Math.round(params.interestRate * 100),
      termCount: params.termCount,
      frequency: params.frequency,
      startDate: params.startDate ?? now,
      status: "active",
      notes: params.notes ?? null,
      graceDays: params.graceDays ?? null,
      moraEnabled: params.moraEnabled ?? null,
      moraRateBps: params.moraRate != null ? Math.round(params.moraRate * 100) : null,
      createdAt: now,
      updatedAt: now
    };

    await db.insert(loans).values(loan);
    await db.insert(pendingMutations).values({
      id: Crypto.randomUUID(),
      entity: "loan",
      entityId: loan.id,
      operation: "create",
      payload: JSON.stringify(loan),
      status: "pending",
      retryCount: 0,
      createdAt: now
    });

    logger.verbose("loan created", { id: loan.id });
    return loan;
  };

  return withErrorHandlingAndValidation(fn, createLoanSchema);
}

export type { CreateLoanInput };
