/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { loans, payments } from "../db/schema";
import { totalRepayCents } from "./loanMath";
import type { Loan, LoanDetail } from "./loan.schema";
import type { Payment } from "../payments/payment.schema";
import type { Database } from "../db/client";

export interface GetLoanDetailDeps {
  db: Database;
}

const getLoanDetailSchema = z.object({
  id: z.string().min(1, "El id es obligatorio")
});

export type GetLoanDetailInput = z.infer<typeof getLoanDetailSchema>;

export function createGetLoanDetail({ db }: GetLoanDetailDeps) {
  const fn = async ({ id }: GetLoanDetailInput): Promise<LoanDetail | null> => {
    const loanRows = await db.select().from(loans).where(eq(loans.id, id));
    const loan = loanRows[0] as Loan | undefined;
    if (!loan) return null;

    const loanPayments = (await db
      .select()
      .from(payments)
      .where(eq(payments.loanId, id))) as Payment[];

    const paidCents = loanPayments.reduce((sum, payment) => sum + payment.amountCents, 0);
    const balanceCents = Math.max(
      0,
      totalRepayCents(loan.principalCents, loan.interestRateBps) - paidCents
    );

    return { ...loan, payments: loanPayments, balanceCents };
  };

  return withErrorHandlingAndValidation(fn, getLoanDetailSchema);
}
