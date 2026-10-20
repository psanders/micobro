/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { loanIdSchema, ARCHIVED_LOAN_STATUS, type LoanIdInput, type Loan } from "./loan.schema";
import { findLoan, saveLoanUpdate } from "./loanMutations";
import { logger } from "../logger";
import type { Database } from "../db/client";

export interface RestoreLoanDeps {
  db: Database;
}

/** Restaurar: returns an archived loan to active, schedule and payments unchanged. */
export function createRestoreLoan({ db }: RestoreLoanDeps) {
  const fn = async ({ id }: LoanIdInput): Promise<Loan> => {
    logger.verbose("restoring loan", { id });

    const current = await findLoan(db, id);
    if (current.status !== ARCHIVED_LOAN_STATUS) {
      throw new Error("Este préstamo no está archivado.");
    }

    const loan = await saveLoanUpdate(db, {
      ...current,
      status: "active",
      updatedAt: new Date()
    });
    logger.verbose("loan restored", { id });
    return loan;
  };

  return withErrorHandlingAndValidation(fn, loanIdSchema);
}
