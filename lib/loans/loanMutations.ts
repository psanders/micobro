/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import * as Crypto from "expo-crypto";
import { eq } from "drizzle-orm";
import { loans, payments, pendingMutations } from "../db/schema";
import type { Loan } from "./loan.schema";
import type { Database } from "../db/client";

export async function findLoan(db: Database, id: string): Promise<Loan> {
  const rows = await db.select().from(loans).where(eq(loans.id, id));
  const loan = rows[0] as Loan | undefined;
  if (!loan) {
    throw new Error("No encontramos este préstamo.");
  }
  return loan;
}

export async function countLoanPayments(db: Database, loanId: string): Promise<number> {
  const rows = await db.select().from(payments).where(eq(payments.loanId, loanId));
  return rows.length;
}

/**
 * Writes the full loan row and enqueues it as an "update" mutation — push
 * rewrites the loan's existing Sheet row in place (never appends), and the
 * full row is required because push writes every column from the payload.
 * Same sequence as updateCustomer, for lenders with or without a Sheet.
 */
export async function saveLoanUpdate(db: Database, loan: Loan): Promise<Loan> {
  await db.update(loans).set(loan).where(eq(loans.id, loan.id));
  await db.insert(pendingMutations).values({
    id: Crypto.randomUUID(),
    entity: "loan",
    entityId: loan.id,
    operation: "update",
    payload: JSON.stringify(loan),
    status: "pending",
    retryCount: 0,
    createdAt: loan.updatedAt
  });
  return loan;
}
