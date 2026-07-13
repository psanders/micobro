/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { loans, customers } from "../db/schema";
import type { LoanWithCustomer } from "./loan.schema";
import type { Database } from "../db/client";

export interface ListLoansDeps {
  db: Database;
}

const listLoansSchema = z.object({});

export function createListLoans({ db }: ListLoansDeps) {
  const fn = async (): Promise<LoanWithCustomer[]> => {
    const rows = await db
      .select({
        id: loans.id,
        customerId: loans.customerId,
        principalCents: loans.principalCents,
        interestRateBps: loans.interestRateBps,
        termCount: loans.termCount,
        frequency: loans.frequency,
        startDate: loans.startDate,
        status: loans.status,
        notes: loans.notes,
        createdAt: loans.createdAt,
        updatedAt: loans.updatedAt,
        customerName: customers.name
      })
      .from(loans)
      .innerJoin(customers, eq(loans.customerId, customers.id));

    return rows as LoanWithCustomer[];
  };

  return withErrorHandlingAndValidation(fn, listLoansSchema);
}
