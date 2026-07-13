/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { loans } from "../db/schema";
import type { Loan } from "./loan.schema";
import type { Database } from "../db/client";

export interface ListLoansByCustomerDeps {
  db: Database;
}

const listLoansByCustomerSchema = z.object({
  customerId: z.string().min(1, "El cliente es obligatorio")
});

export type ListLoansByCustomerInput = z.infer<typeof listLoansByCustomerSchema>;

export function createListLoansByCustomer({ db }: ListLoansByCustomerDeps) {
  const fn = async ({ customerId }: ListLoansByCustomerInput): Promise<Loan[]> => {
    const rows = await db.select().from(loans).where(eq(loans.customerId, customerId));
    return rows as Loan[];
  };

  return withErrorHandlingAndValidation(fn, listLoansByCustomerSchema);
}
