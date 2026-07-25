/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { buildPaymentReceipt } from "../loans/loanViews";
import { customers, loans, payments } from "../db/schema";
import type { Customer } from "../customers/customer.schema";
import type { Loan } from "../loans/loan.schema";
import type { Payment } from "./payment.schema";
import type { PaymentReceipt } from "../repo/types";
import type { Database } from "../db/client";

export interface GetPaymentReceiptDeps {
  db: Database;
}

const getPaymentReceiptSchema = z.object({
  paymentId: z.string().min(1, "El id del pago es obligatorio")
});

export type GetPaymentReceiptInput = z.infer<typeof getPaymentReceiptSchema>;

export function createGetPaymentReceipt({ db }: GetPaymentReceiptDeps) {
  const fn = async ({ paymentId }: GetPaymentReceiptInput): Promise<PaymentReceipt | null> => {
    const allPayments = (await db.select().from(payments)) as Payment[];
    const target = allPayments.find((p) => p.id === paymentId);
    if (!target) return null;

    const loanRows = await db.select().from(loans).where(eq(loans.id, target.loanId));
    const loan = loanRows[0] as Loan | undefined;
    if (!loan) return null;

    const customerRows = await db.select().from(customers).where(eq(customers.id, loan.customerId));
    const customer = customerRows[0] as Customer | undefined;
    if (!customer) return null;

    return buildPaymentReceipt(paymentId, loan, customer, allPayments);
  };

  return withErrorHandlingAndValidation(fn, getPaymentReceiptSchema);
}
