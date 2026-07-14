/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { customers, loans, payments } from "../db/schema";
import { buildLoanDetailView, buildCustomerLoanSummary, MORA_NOTE } from "../loans/loanViews";
import { formatCurrency } from "../utils/money";
import type { Customer } from "./customer.schema";
import type { Loan } from "../loans/loan.schema";
import type { Payment } from "../payments/payment.schema";
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
 * tables. No cédula column or mora domain exists yet, so `cedula` is null
 * and `standing` is always "al_dia" in real mode.
 */
export function createGetCustomerDetail({ db }: GetCustomerDetailDeps) {
  const fn = async ({ id }: GetCustomerDetailInput): Promise<CustomerDetailView | null> => {
    const customerRows = await db.select().from(customers).where(eq(customers.id, id));
    const customer = customerRows[0] as Customer | undefined;
    if (!customer) return null;

    const customerLoans = (await db.select().from(loans).where(eq(loans.customerId, id))) as Loan[];

    const activeLoans = [];
    const activity: CustomerDetailView["recentActivity"] = [];
    for (const loan of customerLoans) {
      const loanPayments = (await db
        .select()
        .from(payments)
        .where(eq(payments.loanId, loan.id))) as Payment[];

      if (loan.status === "active") {
        const view = buildLoanDetailView({
          loan,
          customerName: customer.name,
          business: null,
          payments: loanPayments
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

    activity.sort((a, b) => b.at.getTime() - a.at.getTime());

    return {
      id: customer.id,
      name: customer.name,
      avatarKey: null,
      phone: customer.phone,
      address: customer.address,
      cedula: null,
      sinceYear: customer.createdAt.getFullYear(),
      standing: "al_dia",
      activeLoans,
      recentActivity: activity.slice(0, 5)
    };
  };

  return withErrorHandlingAndValidation(fn, getCustomerDetailSchema);
}
