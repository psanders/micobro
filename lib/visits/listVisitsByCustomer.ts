/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { visits } from "../db/schema";
import type { Visit } from "./visit.schema";
import type { Database } from "../db/client";

export interface ListVisitsByCustomerDeps {
  db: Database;
}

const listVisitsByCustomerSchema = z.object({
  customerId: z.string().min(1, "El cliente es obligatorio")
});

export type ListVisitsByCustomerInput = z.infer<typeof listVisitsByCustomerSchema>;

export function createListVisitsByCustomer({ db }: ListVisitsByCustomerDeps) {
  const fn = async ({ customerId }: ListVisitsByCustomerInput): Promise<Visit[]> => {
    const rows = await db.select().from(visits).where(eq(visits.customerId, customerId));
    return rows as Visit[];
  };

  return withErrorHandlingAndValidation(fn, listVisitsByCustomerSchema);
}
