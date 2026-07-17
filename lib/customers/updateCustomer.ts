/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import * as Crypto from "expo-crypto";
import { eq } from "drizzle-orm";
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { updateCustomerSchema, type UpdateCustomerInput, type Customer } from "./customer.schema";
import { customers, pendingMutations } from "../db/schema";
import { logger } from "../logger";
import type { Database } from "../db/client";

export interface UpdateCustomerDeps {
  db: Database;
}

/**
 * Updates a customer locally and enqueues a pending_mutations row with
 * operation "update" for the sync engine to pick up once it supports
 * updating an existing Sheet row (today's push loop only appends, so it
 * skips "update" mutations rather than appending a duplicate — see
 * lib/sync/push.ts).
 */
export function createUpdateCustomer({ db }: UpdateCustomerDeps) {
  const fn = async (params: UpdateCustomerInput): Promise<Customer> => {
    logger.verbose("updating customer", { id: params.id });

    const existing = await db.select().from(customers).where(eq(customers.id, params.id));
    const current = existing[0];
    if (!current) {
      throw new Error(`Customer not found: ${params.id}`);
    }

    const now = new Date();
    const customer: Customer = {
      ...current,
      name: params.name,
      phone: params.phone,
      address: params.address ?? null,
      cedula: params.cedula ?? null,
      avatarKey: params.avatarKey ?? null,
      updatedAt: now
    };

    await db.update(customers).set(customer).where(eq(customers.id, params.id));
    await db.insert(pendingMutations).values({
      id: Crypto.randomUUID(),
      entity: "customer",
      entityId: customer.id,
      operation: "update",
      payload: JSON.stringify(customer),
      status: "pending",
      retryCount: 0,
      createdAt: now
    });

    logger.verbose("customer updated", { id: customer.id });
    return customer;
  };

  return withErrorHandlingAndValidation(fn, updateCustomerSchema);
}

export type { UpdateCustomerInput };
