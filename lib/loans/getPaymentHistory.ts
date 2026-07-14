/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { loans, payments } from "../db/schema";
import { buildPaymentHistoryView } from "./loanViews";
import type { Loan } from "./loan.schema";
import type { Payment } from "../payments/payment.schema";
import type { PaymentHistoryView } from "../repo/types";
import type { Database } from "../db/client";

export interface GetPaymentHistoryDeps {
  db: Database;
}

const getPaymentHistorySchema = z.object({
  id: z.string().min(1, "El id es obligatorio")
});

export type GetPaymentHistoryInput = z.infer<typeof getPaymentHistorySchema>;

export function createGetPaymentHistory({ db }: GetPaymentHistoryDeps) {
  const fn = async ({ id }: GetPaymentHistoryInput): Promise<PaymentHistoryView | null> => {
    const loanRows = await db.select().from(loans).where(eq(loans.id, id));
    const loan = loanRows[0] as Loan | undefined;
    if (!loan) return null;

    const allPayments = (await db.select().from(payments)) as Payment[];
    return buildPaymentHistoryView(loan, allPayments);
  };

  return withErrorHandlingAndValidation(fn, getPaymentHistorySchema);
}
