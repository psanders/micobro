/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { customers, loans, payments } from "../db/schema";
import { buildLoanDetailView, loanCode } from "../loans/loanViews";
import { computeLoanMora } from "../loans/mora";
import type { Customer } from "../customers/customer.schema";
import type { Loan } from "../loans/loan.schema";
import type { Payment } from "./payment.schema";
import type { CollectContext } from "../repo/types";
import type { Database } from "../db/client";

export interface GetCollectContextDeps {
  db: Database;
}

const getCollectContextSchema = z.object({
  loanId: z.string().min(1, "El préstamo es obligatorio")
});

export type GetCollectContextInput = z.infer<typeof getCollectContextSchema>;

/**
 * What the Registrar cobro screen needs, over the real tables. Mora comes
 * from `computeLoanMora`; the cuota never exceeds the remaining balance
 * (mirrors mikro's `cuotaDue` guard).
 */
export function createGetCollectContext({ db }: GetCollectContextDeps) {
  const fn = async ({ loanId }: GetCollectContextInput): Promise<CollectContext | null> => {
    const loanRows = await db.select().from(loans).where(eq(loans.id, loanId));
    const loan = loanRows[0] as Loan | undefined;
    if (!loan) return null;

    const customerRows = await db.select().from(customers).where(eq(customers.id, loan.customerId));
    const customer = customerRows[0] as Customer | undefined;

    const loanPayments = (await db
      .select()
      .from(payments)
      .where(eq(payments.loanId, loanId))) as Payment[];

    const { moraCents, moraDays } = computeLoanMora(loan, loanPayments);

    const view = buildLoanDetailView({
      loan,
      customerName: customer?.name ?? "Cliente",
      business: null,
      payments: loanPayments,
      moraCents,
      moraDays
    });

    const baseCuota = Math.floor(loan.principalCents / loan.termCount);
    return {
      loanId: loan.id,
      loanCode: loanCode(loan.id),
      customerId: loan.customerId,
      customerName: view.customerName,
      customerAvatarKey: null,
      business: null,
      cuotaCents: Math.min(baseCuota, view.balanceCents),
      currentInstallmentNumber: Math.min(view.installmentsPaid + 1, view.installmentsTotal),
      moraCents,
      moraDays,
      remainingInstallments: view.installmentsTotal - view.installmentsPaid,
      remainingBalanceCents: view.balanceCents
    };
  };

  return withErrorHandlingAndValidation(fn, getCollectContextSchema);
}
