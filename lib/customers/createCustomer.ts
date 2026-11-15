/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import * as Crypto from "expo-crypto";
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { createCustomerSchema, type CreateCustomerInput, type Customer } from "./customer.schema";
import { customers, pendingMutations } from "../db/schema";
import { execOn, writeCustomerPhoto } from "./customerPhotoWrites";
import { logger } from "../logger";
import type { Database } from "../db/client";
import type { SqlExecutor } from "../db/sqlExecutor";

export interface CreateCustomerDeps {
  db: Database;
  /** Runs the customer, its photo and their mutations in one transaction. */
  sql: SqlExecutor;
}

/**
 * Creates a function that inserts a customer (and its photo, if any)
 * locally and enqueues pending_mutations rows so the sync engine can replay
 * them to Google Sheets next time the device is online. Everything is one
 * transaction, so a failed save leaves no customer without its photo.
 */
export function createCreateCustomer({ db, sql }: CreateCustomerDeps) {
  const fn = async (params: CreateCustomerInput): Promise<Customer> => {
    logger.verbose("creating customer", { name: params.name });

    const now = new Date();
    const customer: Customer = {
      id: Crypto.randomUUID(),
      name: params.name,
      phone: params.phone,
      address: params.address ?? null,
      cedula: params.cedula ?? null,
      avatarKey: params.avatarKey ?? null,
      createdAt: now,
      updatedAt: now
    };

    const exec = execOn(sql);
    sql.transaction(() => {
      exec(db.insert(customers).values(customer));
      exec(
        db.insert(pendingMutations).values({
          id: Crypto.randomUUID(),
          entity: "customer",
          entityId: customer.id,
          operation: "create",
          payload: JSON.stringify(customer),
          status: "pending",
          retryCount: 0,
          createdAt: now
        })
      );
      writeCustomerPhoto(db, sql, customer.id, params.photo ?? undefined, now);
    });

    logger.verbose("customer created", { id: customer.id, photo: Boolean(params.photo) });
    return customer;
  };

  return withErrorHandlingAndValidation(fn, createCustomerSchema);
}

export type { CreateCustomerInput };
