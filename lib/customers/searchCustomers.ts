/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Powers the Buscar screen: case-insensitive name/phone substring match
 * (empty query returns everyone) with an active-loan count per customer.
 * `inMora` stays false on the real client until overdue tracking exists —
 * the mora domain hasn't been modeled in the local DB yet.
 */
import { z } from "zod/v4";
import { eq } from "drizzle-orm";
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { normalizeText } from "../utils/text";
import { customers, loans } from "../db/schema";
import type { Database } from "../db/client";

export interface SearchCustomersDeps {
  db: Database;
}

export interface CustomerSearchRow {
  id: string;
  name: string;
  avatarKey: string | null;
  inMora: boolean;
  loanCount: number;
}

const searchCustomersSchema = z.object({
  query: z.string().transform((v) => v.trim())
});

export type SearchCustomersInput = z.input<typeof searchCustomersSchema>;

export function createSearchCustomers({ db }: SearchCustomersDeps) {
  const fn = async (params: { query: string }): Promise<CustomerSearchRow[]> => {
    const allCustomers = await db.select().from(customers);
    const needle = normalizeText(params.query);

    const matches = needle
      ? allCustomers.filter(
          (c) => normalizeText(c.name).includes(needle) || c.phone.includes(needle)
        )
      : allCustomers;

    const rows: CustomerSearchRow[] = [];
    for (const customer of matches) {
      const customerLoans = await db.select().from(loans).where(eq(loans.customerId, customer.id));
      const activeCount = customerLoans.filter((l) => l.status === "active").length;
      rows.push({
        id: customer.id,
        name: customer.name,
        avatarKey: null,
        inMora: false,
        loanCount: activeCount
      });
    }
    return rows;
  };

  return withErrorHandlingAndValidation(fn, searchCustomersSchema);
}
