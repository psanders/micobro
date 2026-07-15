/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { customers, loans, payments } from "../db/schema";
import { buildLoanDetailView } from "./loanViews";
import { computeLoanMora } from "./mora";
import type { Customer } from "../customers/customer.schema";
import type { Loan } from "./loan.schema";
import type { Payment } from "../payments/payment.schema";
import type { LoanDetailView } from "../repo/types";
import type { Database } from "../db/client";

export interface GetLoanDetailViewDeps {
  db: Database;
}

const getLoanDetailViewSchema = z.object({
  id: z.string().min(1, "El id es obligatorio")
});

export type GetLoanDetailViewInput = z.infer<typeof getLoanDetailViewSchema>;

/**
 * The Préstamo Detalle view over the real tables — mora is accrued via
 * `computeLoanMora` (see lib/loans/mora.ts).
 */
export function createGetLoanDetailView({ db }: GetLoanDetailViewDeps) {
  const fn = async ({ id }: GetLoanDetailViewInput): Promise<LoanDetailView | null> => {
    const loanRows = await db.select().from(loans).where(eq(loans.id, id));
    const loan = loanRows[0] as Loan | undefined;
    if (!loan) return null;

    const customerRows = await db.select().from(customers).where(eq(customers.id, loan.customerId));
    const customer = customerRows[0] as Customer | undefined;

    const loanPayments = (await db
      .select()
      .from(payments)
      .where(eq(payments.loanId, id))) as Payment[];

    const { moraCents, moraDays } = computeLoanMora(loan, loanPayments);

    return buildLoanDetailView({
      loan,
      customerName: customer?.name ?? "Cliente",
      business: null,
      payments: loanPayments,
      moraCents,
      moraDays
    });
  };

  return withErrorHandlingAndValidation(fn, getLoanDetailViewSchema);
}
