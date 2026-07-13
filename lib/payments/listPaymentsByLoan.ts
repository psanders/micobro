/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { payments } from "../db/schema";
import type { Payment } from "./payment.schema";
import type { Database } from "../db/client";

export interface ListPaymentsByLoanDeps {
  db: Database;
}

const listPaymentsByLoanSchema = z.object({
  loanId: z.string().min(1, "El préstamo es obligatorio")
});

export type ListPaymentsByLoanInput = z.infer<typeof listPaymentsByLoanSchema>;

export function createListPaymentsByLoan({ db }: ListPaymentsByLoanDeps) {
  const fn = async ({ loanId }: ListPaymentsByLoanInput): Promise<Payment[]> => {
    const rows = await db.select().from(payments).where(eq(payments.loanId, loanId));
    return rows as Payment[];
  };

  return withErrorHandlingAndValidation(fn, listPaymentsByLoanSchema);
}
