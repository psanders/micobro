/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  address: text("address"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull()
});

export const pendingMutations = sqliteTable("pending_mutations", {
  id: text("id").primaryKey(),
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull(),
  operation: text("operation").notNull(),
  payload: text("payload").notNull(),
  status: text("status").notNull().default("pending"),
  retryCount: integer("retry_count").notNull().default(0),
  lastError: text("last_error"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull()
});

export const syncMeta = sqliteTable("sync_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull()
});

export const loans = sqliteTable("loans", {
  id: text("id").primaryKey(),
  customerId: text("customer_id")
    .notNull()
    .references(() => customers.id),
  principalCents: integer("principal_cents").notNull(),
  interestRateBps: integer("interest_rate_bps").notNull(),
  termCount: integer("term_count").notNull(),
  frequency: text("frequency").notNull(),
  startDate: integer("start_date", { mode: "timestamp" }).notNull(),
  status: text("status").notNull().default("active"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull()
});

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  loanId: text("loan_id")
    .notNull()
    .references(() => loans.id),
  amountCents: integer("amount_cents").notNull(),
  paidAt: integer("paid_at", { mode: "timestamp" }).notNull(),
  method: text("method"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull()
});
