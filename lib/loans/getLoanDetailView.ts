/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { customers, loans, payments } from "../db/schema";
import { buildLoanDetailView } from "./loanViews";
import { computeLoanMora, loanMoraPolicy } from "./mora";
import { effectiveLoanType } from "./loan.schema";
import { openCreditState } from "./openCredit";
import type { Customer } from "../customers/customer.schema";
import type { Loan } from "./loan.schema";
import type { Payment } from "../payments/payment.schema";
import type { LoanDetailView, OpenCreditView } from "../repo/types";
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

    const customerName = customer?.name ?? "Cliente";

    if (effectiveLoanType(loan) === "open_credit") {
      // Open credit has no cuota schedule or mora — its balance/interest
      // come from the cycle-replay engine, not computeLoanMora/cuota math
      // (those are term-only). buildLoanDetailView still gives us a
      // consistent base shape (termCount 0 → empty schedule, no crash); we
      // just override the fields that mean something different here.
      const state = openCreditState(loan, loanPayments, new Date());
      const base = buildLoanDetailView({
        loan,
        customerName,
        business: null,
        payments: loanPayments,
        moraCents: 0,
        moraDays: 0
      });
      const openCredit: OpenCreditView = {
        balanceCents: state.balanceCents,
        interestDueCents: state.interestDueCents,
        nextDueDate: state.nextDueDate,
        interestRateBps: loan.interestRateBps,
        frequency: loan.frequency,
        isClosed: state.isClosed,
        cycles: state.cycles
      };
      return {
        ...base,
        balanceCents: state.balanceCents,
        nextDueDate: state.nextDueDate,
        moraCents: 0,
        moraDays: 0,
        openCredit
      };
    }

    const { moraCents, moraDays } = computeLoanMora(
      loan,
      loanPayments,
      new Date(),
      loanMoraPolicy(loan)
    );

    return {
      ...buildLoanDetailView({
        loan,
        customerName,
        business: null,
        payments: loanPayments,
        moraCents,
        moraDays
      }),
      openCredit: null
    };
  };

  return withErrorHandlingAndValidation(fn, getLoanDetailViewSchema);
}
