/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import * as Crypto from "expo-crypto";
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { createCustomerSchema, type CreateCustomerInput, type Customer } from "./customer.schema";
import { customers, pendingMutations } from "../db/schema";
import { logger } from "../logger";
import type { Database } from "../db/client";

export interface CreateCustomerDeps {
  db: Database;
}

/**
 * Creates a function that inserts a customer locally and enqueues a
 * pending_mutations row so the sync engine can replay it to Google Sheets
 * next time the device is online.
 */
export function createCreateCustomer({ db }: CreateCustomerDeps) {
  const fn = async (params: CreateCustomerInput): Promise<Customer> => {
    logger.verbose("creating customer", { name: params.name });

    const now = new Date();
    const customer: Customer = {
      id: Crypto.randomUUID(),
      name: params.name,
      phone: params.phone,
      address: params.address ?? null,
      createdAt: now,
      updatedAt: now
    };

    await db.insert(customers).values(customer);
    await db.insert(pendingMutations).values({
      id: Crypto.randomUUID(),
      entity: "customer",
      entityId: customer.id,
      operation: "create",
      payload: JSON.stringify(customer),
      status: "pending",
      retryCount: 0,
      createdAt: now
    });

    logger.verbose("customer created", { id: customer.id });
    return customer;
  };

  return withErrorHandlingAndValidation(fn, createCustomerSchema);
}

export type { CreateCustomerInput };
