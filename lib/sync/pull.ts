/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Pulls the lender's Google Sheet back down into local SQLite: the other
 * half of the sync loop, chained after push.ts in syncNow(). Only
 * `customers` and `loans` are pulled — `payments`/`visits` are append-only
 * by product design (no edit flow, no updatedAt column), so there is
 * nothing for a lender to correct in the Sheet for those two.
 *
 * Conflict policy is remote-wins-with-guard (see
 * openspec/changes/7-pull-two-way-sync/design.md §4): a pulled row
 * overwrites the local row for the same id, UNLESS that id has an unpushed
 * pending_mutations row (status "pending" or "failed"), in which case the
 * local value is strictly newer than what the Sheet currently shows and is
 * left untouched until that mutation successfully pushes.
 *
 * Deletion is never inferred from a row's absence — a local row with no
 * matching remote id is left alone (see design.md §3).
 */
import { eq, and, or } from "drizzle-orm";
import { customers, loans, pendingMutations, syncMeta } from "../db/schema";
import { readRange } from "./sheetsClient";
import { getSheetId } from "./config";
import { ENTITY_RANGES } from "./push";
import { logger } from "../logger";
import type { Database } from "../db/client";
import type { Customer } from "../customers/customer.schema";
import type { Loan, LoanFrequency, LoanStatus } from "../loans/loan.schema";

export const LAST_PULLED_AT_KEY = "lastPulledAt";

export interface PullResult {
  /** Rows inserted or updated locally. */
  pulled: number;
  /** Rows left untouched because an unpushed local mutation protects them. */
  skipped: number;
  /** Rows that failed to parse and were logged instead of applied. */
  malformed: number;
}

function parseDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseNumber(value: string): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Inverse of customerRowValues in push.ts — same "Clientes!A:F" column order.
function rowToCustomer(row: string[]): Customer | null {
  const [id, name, phone, address, createdAtRaw, updatedAtRaw] = row;
  const createdAt = createdAtRaw ? parseDate(createdAtRaw) : null;
  const updatedAt = updatedAtRaw ? parseDate(updatedAtRaw) : null;
  if (!id || !name || !phone || !createdAt || !updatedAt) return null;
  return {
    id,
    name,
    phone,
    address: address || null,
    cedula: null,
    avatarKey: null,
    createdAt,
    updatedAt
  };
}

// Inverse of loanRowValues in push.ts — same "Préstamos!A:K" column order.
function rowToLoan(row: string[]): Loan | null {
  const [
    id,
    customerId,
    principalCentsRaw,
    interestRateBpsRaw,
    termCountRaw,
    frequency,
    startDateRaw,
    status,
    notes,
    createdAtRaw,
    updatedAtRaw
  ] = row;
  const principalCents = principalCentsRaw ? parseNumber(principalCentsRaw) : null;
  const interestRateBps = interestRateBpsRaw ? parseNumber(interestRateBpsRaw) : null;
  const termCount = termCountRaw ? parseNumber(termCountRaw) : null;
  const startDate = startDateRaw ? parseDate(startDateRaw) : null;
  const createdAt = createdAtRaw ? parseDate(createdAtRaw) : null;
  const updatedAt = updatedAtRaw ? parseDate(updatedAtRaw) : null;
  if (
    !id ||
    !customerId ||
    principalCents === null ||
    interestRateBps === null ||
    termCount === null ||
    !frequency ||
    !startDate ||
    !status ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }
  return {
    id,
    customerId,
    principalCents,
    interestRateBps,
    termCount,
    frequency: frequency as LoanFrequency,
    startDate,
    status: status as LoanStatus,
    notes: notes || null,
    createdAt,
    updatedAt
  };
}

async function isGuarded(db: Database, entity: string, entityId: string): Promise<boolean> {
  const guard = await db
    .select()
    .from(pendingMutations)
    .where(
      and(
        eq(pendingMutations.entity, entity),
        eq(pendingMutations.entityId, entityId),
        or(eq(pendingMutations.status, "pending"), eq(pendingMutations.status, "failed"))
      )
    );
  return guard.length > 0;
}

async function pullCustomers(db: Database, sheetId: string): Promise<PullResult> {
  const rows = await readRange(sheetId, ENTITY_RANGES.customer);
  let pulled = 0;
  let skipped = 0;
  let malformed = 0;

  for (const row of rows.slice(1)) {
    const record = rowToCustomer(row);
    if (!record) {
      logger.warn("skipping malformed pulled customer row", { row });
      malformed += 1;
      continue;
    }
    if (await isGuarded(db, "customer", record.id)) {
      skipped += 1;
      continue;
    }

    const existing = await db.select().from(customers).where(eq(customers.id, record.id));
    const current = existing[0];
    if (!current) {
      await db.insert(customers).values({ ...record, cedula: null, avatarKey: null });
      pulled += 1;
    } else if (
      current.name !== record.name ||
      current.phone !== record.phone ||
      current.address !== record.address ||
      current.updatedAt.getTime() !== record.updatedAt.getTime()
    ) {
      await db
        .update(customers)
        .set({
          name: record.name,
          phone: record.phone,
          address: record.address,
          updatedAt: record.updatedAt
        })
        .where(eq(customers.id, record.id));
      pulled += 1;
    }
  }

  return { pulled, skipped, malformed };
}

async function pullLoans(db: Database, sheetId: string): Promise<PullResult> {
  const rows = await readRange(sheetId, ENTITY_RANGES.loan);
  let pulled = 0;
  let skipped = 0;
  let malformed = 0;

  for (const row of rows.slice(1)) {
    const record = rowToLoan(row);
    if (!record) {
      logger.warn("skipping malformed pulled loan row", { row });
      malformed += 1;
      continue;
    }
    if (await isGuarded(db, "loan", record.id)) {
      skipped += 1;
      continue;
    }

    const existing = await db.select().from(loans).where(eq(loans.id, record.id));
    const current = existing[0];
    if (!current) {
      await db.insert(loans).values(record);
      pulled += 1;
    } else if (
      current.principalCents !== record.principalCents ||
      current.interestRateBps !== record.interestRateBps ||
      current.termCount !== record.termCount ||
      current.frequency !== record.frequency ||
      current.status !== record.status ||
      current.notes !== record.notes ||
      current.startDate.getTime() !== record.startDate.getTime() ||
      current.updatedAt.getTime() !== record.updatedAt.getTime()
    ) {
      await db
        .update(loans)
        .set({
          principalCents: record.principalCents,
          interestRateBps: record.interestRateBps,
          termCount: record.termCount,
          frequency: record.frequency,
          startDate: record.startDate,
          status: record.status,
          notes: record.notes,
          updatedAt: record.updatedAt
        })
        .where(eq(loans.id, record.id));
      pulled += 1;
    }
  }

  return { pulled, skipped, malformed };
}

export async function pullEntities(db: Database): Promise<PullResult> {
  const sheetId = await getSheetId();
  if (!sheetId) {
    logger.warn("no sheet configured, skipping pull");
    return { pulled: 0, skipped: 0, malformed: 0 };
  }

  // Sequential, not concurrent: both calls end up going through the same
  // native GoogleSignin.getTokens() call underneath (authorizedFetch ->
  // getValidAccessToken), which throws if a second call starts before the
  // first settles. Parallelizing this saves little latency in practice
  // (two Sheets ranges) and isn't worth that hazard.
  const customerResult = await pullCustomers(db, sheetId);
  const loanResult = await pullLoans(db, sheetId);

  const result: PullResult = {
    pulled: customerResult.pulled + loanResult.pulled,
    skipped: customerResult.skipped + loanResult.skipped,
    malformed: customerResult.malformed + loanResult.malformed
  };

  await db
    .insert(syncMeta)
    .values({ key: LAST_PULLED_AT_KEY, value: String(Date.now()) })
    .onConflictDoUpdate({ target: syncMeta.key, set: { value: String(Date.now()) } });

  logger.info("pull complete", { ...result });
  return result;
}
