/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import * as Crypto from "expo-crypto";
import { eq } from "drizzle-orm";
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { updateCustomerSchema, type UpdateCustomerInput, type Customer } from "./customer.schema";
import { customers, pendingMutations } from "../db/schema";
import { execOn, writeCustomerPhoto } from "./customerPhotoWrites";
import { logger } from "../logger";
import type { Database } from "../db/client";
import type { SqlExecutor } from "../db/sqlExecutor";

export interface UpdateCustomerDeps {
  db: Database;
  /** Runs the customer, its photo and their mutations in one transaction. */
  sql: SqlExecutor;
}

/**
 * Updates a customer locally and enqueues a pending_mutations row with
 * operation "update" for push to rewrite its Sheet row. `photo` undefined
 * keeps the stored photo, a string replaces it, null removes it — in the
 * same transaction as the customer row.
 */
export function createUpdateCustomer({ db, sql }: UpdateCustomerDeps) {
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

    const exec = execOn(sql);
    sql.transaction(() => {
      exec(db.update(customers).set(customer).where(eq(customers.id, params.id)));
      exec(
        db.insert(pendingMutations).values({
          id: Crypto.randomUUID(),
          entity: "customer",
          entityId: customer.id,
          operation: "update",
          payload: JSON.stringify(customer),
          status: "pending",
          retryCount: 0,
          createdAt: now
        })
      );
      writeCustomerPhoto(db, sql, customer.id, params.photo, now);
    });

    logger.verbose("customer updated", { id: customer.id });
    return customer;
  };

  return withErrorHandlingAndValidation(fn, updateCustomerSchema);
}

export type { UpdateCustomerInput };
