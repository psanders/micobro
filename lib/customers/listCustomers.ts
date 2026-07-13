/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { z } from "zod/v4";
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { customers } from "../db/schema";
import type { Customer } from "./customer.schema";
import type { Database } from "../db/client";

export interface ListCustomersDeps {
  db: Database;
}

const listCustomersSchema = z.object({});

export function createListCustomers({ db }: ListCustomersDeps) {
  const fn = async (): Promise<Customer[]> => {
    return db.select().from(customers);
  };

  return withErrorHandlingAndValidation(fn, listCustomersSchema);
}
