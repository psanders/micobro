/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { loanIdSchema, ARCHIVED_LOAN_STATUS, type LoanIdInput, type Loan } from "./loan.schema";
import { findLoan, saveLoanUpdate } from "./loanMutations";
import { logger } from "../logger";
import type { Database } from "../db/client";

export interface ArchiveLoanDeps {
  db: Database;
}

/**
 * Archivar préstamo: takes a loan out of every active view by changing its
 * status — never a delete. Pull never removes local rows and push has no
 * delete operation, so a deleted loan would come back from the Sheet. Its
 * payments and visits are untouched and keep counting in Cuadre.
 */
export function createArchiveLoan({ db }: ArchiveLoanDeps) {
  const fn = async ({ id }: LoanIdInput): Promise<Loan> => {
    logger.verbose("archiving loan", { id });

    const current = await findLoan(db, id);
    if (current.status === ARCHIVED_LOAN_STATUS) {
      throw new Error("Este préstamo ya está archivado.");
    }

    const loan = await saveLoanUpdate(db, {
      ...current,
      status: ARCHIVED_LOAN_STATUS,
      updatedAt: new Date()
    });
    logger.verbose("loan archived", { id });
    return loan;
  };

  return withErrorHandlingAndValidation(fn, loanIdSchema);
}
