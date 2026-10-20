/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { updateLoanSchema, loanTermsFields, type UpdateLoanInput, type Loan } from "./loan.schema";
import { countLoanPayments, findLoan, saveLoanUpdate } from "./loanMutations";
import { logger } from "../logger";
import type { Database } from "../db/client";

export interface UpdateLoanDeps {
  db: Database;
}

/**
 * Editar préstamo: corrects an active loan's terms in place (same id, same
 * code). Refused once the loan has any payment — payments were split
 * against the old terms (cuota/mora), so rewriting them would rewrite money
 * already collected. Schedules, totals and mora are all derived from the
 * terms at read time, so nothing else needs recomputing here.
 */
export function createUpdateLoan({ db }: UpdateLoanDeps) {
  const fn = async (params: UpdateLoanInput): Promise<Loan> => {
    logger.verbose("updating loan", { id: params.id });

    const current = await findLoan(db, params.id);
    if (current.status !== "active") {
      throw new Error("Solo se pueden editar préstamos activos.");
    }
    if ((await countLoanPayments(db, params.id)) > 0) {
      throw new Error("Este préstamo ya tiene pagos y no se puede editar. Puedes archivarlo.");
    }

    const loan: Loan = {
      ...current,
      ...loanTermsFields(params),
      startDate: params.startDate ?? current.startDate,
      updatedAt: new Date()
    };

    await saveLoanUpdate(db, loan);
    logger.verbose("loan updated", { id: loan.id });
    return loan;
  };

  return withErrorHandlingAndValidation(fn, updateLoanSchema);
}

export type { UpdateLoanInput };
