/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { customers, loans, payments, visits } from "../db/schema";
import { buildLoanDetailView, buildCustomerLoanSummary, MORA_NOTE } from "../loans/loanViews";
import { computeLoanMora, loanMoraPolicy } from "../loans/mora";
import { formatCurrency } from "../utils/money";
import { visitDescription } from "../visits/visitDescription";
import type { Customer } from "./customer.schema";
import type { Loan } from "../loans/loan.schema";
import type { Payment } from "../payments/payment.schema";
import type { Visit } from "../visits/visit.schema";
import type { CustomerDetailView } from "../repo/types";
import type { Database } from "../db/client";

export interface GetCustomerDetailDeps {
  db: Database;
}

const getCustomerDetailSchema = z.object({
  id: z.string().min(1, "El id es obligatorio")
});

export type GetCustomerDetailInput = z.infer<typeof getCustomerDetailSchema>;

/**
 * Composes the Cliente Detalle view from the customers/loans/payments
 * tables. `cedula`/`avatarKey` come straight off the customers row (null
 * when the lender never captured them); `standing` reflects real accrued
 * mora (see lib/loans/mora.ts) across active loans.
 */
export function createGetCustomerDetail({ db }: GetCustomerDetailDeps) {
  const fn = async ({ id }: GetCustomerDetailInput): Promise<CustomerDetailView | null> => {
    const customerRows = await db.select().from(customers).where(eq(customers.id, id));
    const customer = customerRows[0] as Customer | undefined;
    if (!customer) return null;

    const customerLoans = (await db.select().from(loans).where(eq(loans.customerId, id))) as Loan[];

    const activeLoans = [];
    const activity: CustomerDetailView["recentActivity"] = [];
    let inMora = false;
    for (const loan of customerLoans) {
      const loanPayments = (await db
        .select()
        .from(payments)
        .where(eq(payments.loanId, loan.id))) as Payment[];

      if (loan.status === "active") {
        const { moraCents, moraDays } = computeLoanMora(
          loan,
          loanPayments,
          new Date(),
          loanMoraPolicy(loan)
        );
        if (moraCents > 0) inMora = true;
        const view = buildLoanDetailView({
          loan,
          customerName: customer.name,
          business: null,
          payments: loanPayments,
          moraCents,
          moraDays
        });
        activeLoans.push(buildCustomerLoanSummary(view, loan));
      }

      let cuotaNumber = 0;
      for (const payment of [...loanPayments].sort(
        (a, b) => a.paidAt.getTime() - b.paidAt.getTime()
      )) {
        const isMora = payment.notes === MORA_NOTE;
        if (!isMora) cuotaNumber += 1;
        activity.push({
          id: payment.id,
          description: isMora
            ? `Pago de mora · ${formatCurrency(payment.amountCents)}`
            : `Pago cuota ${cuotaNumber} · ${formatCurrency(payment.amountCents)}`,
          at: payment.paidAt
        });
      }
    }

    const customerVisits = (await db
      .select()
      .from(visits)
      .where(eq(visits.customerId, id))) as Visit[];
    for (const visit of customerVisits) {
      activity.push({ id: visit.id, description: visitDescription(visit), at: visit.createdAt });
    }

    activity.sort((a, b) => b.at.getTime() - a.at.getTime());

    return {
      id: customer.id,
      name: customer.name,
      avatarKey: customer.avatarKey,
      phone: customer.phone,
      address: customer.address,
      cedula: customer.cedula,
      sinceYear: customer.createdAt.getFullYear(),
      standing: inMora ? "mora" : "al_dia",
      activeLoans,
      recentActivity: activity.slice(0, 5)
    };
  };

  return withErrorHandlingAndValidation(fn, getCustomerDetailSchema);
}
