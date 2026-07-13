/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { z } from "zod/v4";
import { eq } from "drizzle-orm";
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { customers } from "../db/schema";
import type { Customer } from "./customer.schema";
import type { Database } from "../db/client";

export interface GetCustomerDeps {
  db: Database;
}

const getCustomerSchema = z.object({
  id: z.string().min(1, "El id es obligatorio")
});

export type GetCustomerInput = z.infer<typeof getCustomerSchema>;

export function createGetCustomer({ db }: GetCustomerDeps) {
  const fn = async ({ id }: GetCustomerInput): Promise<Customer | null> => {
    const rows = await db.select().from(customers).where(eq(customers.id, id));
    return rows[0] ?? null;
  };

  return withErrorHandlingAndValidation(fn, getCustomerSchema);
}
