/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  address: text("address"),
  // Dominican cédula, stored normalized (digits only, 11 chars). Display
  // formatting ("XXX-XXXXXXX-X") is the UI's job — see lib/utils/cedula.ts.
  cedula: text("cedula"),
  // Semantic key into a curated set (see lib/customers/avatarKeys.ts /
  // components/avatars.ts) — not a photo, no camera/storage permissions.
  avatarKey: text("avatar_key"),
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

/**
 * One row per install (the lender's own identity), keyed by a fixed
 * singleton id — see `PROFILE_ID` in `lib/profile/profile.schema.ts`.
 */
export const profile = sqliteTable("profile", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  avatarKey: text("avatar_key"),
  businessName: text("business_name"),
  phone: text("phone"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull()
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
  // Days past due before mora (late fee) starts accruing. Nullable rather
  // than backfilled so existing loans need no data migration — null is
  // treated as the 7-day default at read time (see
  // `lib/loans/loan.schema.ts`'s `DEFAULT_GRACE_DAYS`).
  graceDays: integer("grace_days"),
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

export const visits = sqliteTable("visits", {
  id: text("id").primaryKey(),
  customerId: text("customer_id")
    .notNull()
    .references(() => customers.id),
  loanId: text("loan_id").references(() => loans.id),
  outcome: text("outcome").notNull(),
  promiseDate: integer("promise_date", { mode: "timestamp" }),
  promiseAmountCents: integer("promise_amount_cents"),
  note: text("note"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull()
});

/**
 * A caja (cash-on-hand) close: an immutable ledger row recording the
 * reconciled total for a period. `periodStart` is the previous close's
 * `closedAt`, or null for the very first close (period begins at the
 * beginning of time). Append-only — no edit flow, like payments/visits.
 */
export const cashCloses = sqliteTable("cash_closes", {
  id: text("id").primaryKey(),
  amountCents: integer("amount_cents").notNull(),
  periodStart: integer("period_start", { mode: "timestamp" }),
  closedAt: integer("closed_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull()
});
