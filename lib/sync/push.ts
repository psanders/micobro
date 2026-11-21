/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Replays queued local writes (pending_mutations) to the lender's Google
 * Sheet: appends "create" mutations, corrects existing rows in place for
 * "update" mutations (see findRowNumber/updateRow below) rather than
 * duplicating them, and removes the row for "delete" mutations (queued by
 * pull when a Sheet deletion cascades to dependent rows). Every successful
 * create/update stamps the local row's `pushedAt`, recording that the Sheet
 * holds it. Pulling the Sheet back down into local SQLite is the
 * other half of the loop — see pull.ts, chained after this in syncNow().
 */
import { eq, and, or, lt, getTableColumns } from "drizzle-orm";
import { cashCloses, customerPhotos, customers, pendingMutations, syncMeta } from "../db/schema";
import { appendRow, updateRow, readRange, deleteRows, ensureSheetTab } from "./sheetsClient";
import { PULLED_TABLES } from "./syncedTables";
import { TAB_HEADERS } from "./sheetHeaders";
import { getSheetId } from "./config";
import { ensureClientesLayout } from "./clientesLayout";
import { ensurePenaltyHeader } from "./prestamosLayout";
import { ensurePagosLayout } from "./pagosLayout";
import { ensureSheetSpanishValues } from "./sheetValuesLayout";
import {
  FREQUENCY_CODES,
  LOAN_STATUS_CODES,
  LOAN_TYPE_CODES,
  PAYMENT_METHOD_CODES,
  VISIT_OUTCOME_CODES,
  toSheetCode
} from "./sheetValues";
import type { LoanFrequency, LoanStatus, LoanType } from "../loans/loan.schema";
import type { PaymentMethod } from "../payments/payment.schema";
import type { VisitOutcome } from "../visits/visit.schema";
import { isPaymentKind, legacyPaymentKind } from "../payments/paymentNotes";
import { CUSTOMER_PHOTO_ENTITY } from "../customers/customerPhotoWrites";
import { createQueueCedulaResend } from "./queueCedulaResend";
import { EXTRA_RANGE, PROFILE_ENTITY } from "./extraFields";
import { pushExtra } from "./extraTab";
import { getAppVersion as defaultGetAppVersion } from "../app/appVersion";
import { formatCedula } from "../utils/cedula";
import { logger } from "../logger";
import type { Database } from "../db/client";

// Exported so syncRepo.getStatus() can compute pendingCount/stuckCount against
// the exact same cap this query retries against.
export const MAX_RETRIES = 5;
export const LAST_PUSHED_AT_KEY = "lastPushedAt";

// Assumes the lender's Google Sheet has tabs named "Clientes", "Préstamos",
// "Pagos", "Visitas", "Cierres" and "Fotos" with columns in the order the
// row-value mappers below emit them, and a key/value "Extra" tab that
// extraTab.ts reads and writes by Campo instead.
// Exported so provisioning (lib/sync/provisionSheet.ts) creates tabs whose
// names and column widths match exactly what push writes here.
export const ENTITY_RANGES: Record<string, string> = {
  customer: "Clientes!A:G",
  loan: "Préstamos!A:Q",
  payment: "Pagos!A:H",
  visit: "Visitas!A:H",
  cashClose: "Cierres!A:E",
  // Push-only for now. Sheets connected before photos shipped get the tab
  // from push itself (see ensureFotosTab below).
  customerPhoto: "Fotos!A:D",
  // The lender's profile, one Campo per row; never written through the
  // row mappers below (see pushExtra in extraTab.ts).
  profile: EXTRA_RANGE
};

// Cédula sits right after the name and is written formatted ("001-1234567-8"):
// appends use USER_ENTERED, which would parse the raw 11 digits as a number
// and drop the leading zeros.
function customerRowValues(payload: Record<string, unknown>): (string | number | null)[] {
  return [
    payload.id as string,
    payload.name as string,
    formatCedula(payload.cedula as string | null),
    payload.phone as string,
    (payload.address as string) ?? "",
    payload.createdAt as string,
    payload.updatedAt as string
  ];
}

// Column order mirrors the `loans` table in lib/db/schema.ts.
function loanRowValues(payload: Record<string, unknown>): (string | number | null)[] {
  return [
    payload.id as string,
    payload.customerId as string,
    payload.principalCents as number,
    payload.interestRateBps as number,
    payload.termCount as number,
    toSheetCode(FREQUENCY_CODES, payload.frequency as LoanFrequency),
    payload.startDate as string,
    toSheetCode(LOAN_STATUS_CODES, payload.status as LoanStatus),
    (payload.notes as string) ?? "",
    (payload.graceDays as number | null) ?? "",
    payload.moraEnabled == null ? "" : payload.moraEnabled ? "TRUE" : "FALSE",
    (payload.moraRateBps as number | null) ?? "",
    payload.skipSundays == null ? "" : payload.skipSundays ? "TRUE" : "FALSE",
    toSheetCode(LOAN_TYPE_CODES, payload.loanType as LoanType | null) ?? "",
    payload.createdAt as string,
    payload.updatedAt as string,
    // Appended after Actualizado (not next to Tipo) so Sheets made before
    // Tradicional Plus need no column shift — see prestamosLayout.ts.
    (payload.penaltyCents as number | null) ?? ""
  ];
}

// Column order mirrors the `payments` table in lib/db/schema.ts, with Tipo
// appended in H. A payload queued before `tipo` existed carries its kind in
// `notes` ("mora"/"penalidad"): it's written to H, and F is left blank.
function paymentRowValues(payload: Record<string, unknown>): (string | number | null)[] {
  const notes = (payload.notes as string | null | undefined) ?? null;
  const legacy = isPaymentKind(payload.tipo) ? null : legacyPaymentKind(notes);
  const tipo = isPaymentKind(payload.tipo) ? payload.tipo : (legacy ?? "cuota");
  return [
    payload.id as string,
    payload.loanId as string,
    payload.amountCents as number,
    payload.paidAt as string,
    toSheetCode(PAYMENT_METHOD_CODES, payload.method as PaymentMethod | null) ?? "",
    legacy ? "" : (notes ?? ""),
    payload.createdAt as string,
    tipo
  ];
}

// Column order mirrors the `visits` table in lib/db/schema.ts.
function visitRowValues(payload: Record<string, unknown>): (string | number | null)[] {
  return [
    payload.id as string,
    payload.customerId as string,
    (payload.loanId as string) ?? "",
    toSheetCode(VISIT_OUTCOME_CODES, payload.outcome as VisitOutcome),
    (payload.promiseDate as string) ?? "",
    (payload.promiseAmountCents as number) ?? "",
    (payload.note as string) ?? "",
    payload.createdAt as string
  ];
}

// Column order mirrors the `cash_closes` table in lib/db/schema.ts.
function cashCloseRowValues(payload: Record<string, unknown>): (string | number | null)[] {
  return [
    payload.id as string,
    payload.amountCents as number,
    (payload.periodStart as string) ?? "",
    payload.closedAt as string,
    payload.createdAt as string
  ];
}

// A customer_photos row joined to its customer's name (see currentRowPayload).
// Foto always starts with "/9j/" (lib/photos/photo.schema.ts), so the
// USER_ENTERED write can't read it as a formula.
function customerPhotoRowValues(payload: Record<string, unknown>): (string | number | null)[] {
  return [
    payload.id as string,
    (payload.name as string | null) ?? "",
    payload.photo as string,
    payload.updatedAt as string
  ];
}

export const ROW_MAPPERS: Record<
  string,
  (payload: Record<string, unknown>) => (string | number | null)[]
> = {
  customer: customerRowValues,
  loan: loanRowValues,
  payment: paymentRowValues,
  visit: visitRowValues,
  cashClose: cashCloseRowValues,
  customerPhoto: customerPhotoRowValues
};

export interface PushResult {
  pushed: number;
  failed: number;
}

/** "Clientes!A:G" -> "Clientes!A5:G5" for a specific 1-based row number. */
export function rowRangeAt(range: string, rowNumber: number): string {
  const [tab, cols] = range.split("!");
  const [startCol, endCol] = cols.split(":");
  return `${tab}!${startCol}${rowNumber}:${endCol}${rowNumber}`;
}

// Sheets API v4 addresses cells by A1 range, not by key, so finding "the row
// for entity id X" costs a values.get on the id column (always column A per
// every row mapper above) followed by a linear scan.
export async function findRowNumber(
  sheetId: string,
  range: string,
  id: string
): Promise<number | null> {
  const tab = range.split("!")[0];
  const idColumn = await readRange(sheetId, `${tab}!A:A`);
  const index = idColumn.findIndex((row) => row[0] === id);
  return index === -1 ? null : index + 1;
}

const RESENDABLE_TABLES = {
  ...PULLED_TABLES,
  cashClose: cashCloses,
  customerPhoto: customerPhotos
} as const;

// The local tables whose rows record, in `pushedAt`, that the Sheet holds them.
const STAMPED_TABLES = { ...PULLED_TABLES, customerPhoto: customerPhotos } as const;

/**
 * Creates the `Fotos` tab on a Sheet connected before photos shipped (a new
 * Sheet gets it, protected, from provisionSheet). Returns false instead of
 * throwing, e.g. offline, so photo mutations wait, untouched, for a later
 * push while every other entity still syncs.
 */
async function ensureFotosTab(sheetId: string): Promise<boolean> {
  try {
    const range = ENTITY_RANGES[CUSTOMER_PHOTO_ENTITY];
    await ensureSheetTab(sheetId, range.split("!")[0], TAB_HEADERS[CUSTOMER_PHOTO_ENTITY]);
    return true;
  } catch (err) {
    logger.warn("could not confirm the Fotos tab, holding photo sync", { error: String(err) });
    return false;
  }
}

/**
 * The local row as a mutation payload (dates as ISO strings, like a stored
 * payload). Used for mutations queued with an empty payload — "send the row
 * as it is now" — e.g. by a backup restore. Null when the row is gone.
 */
async function currentRowPayload(
  db: Database,
  entity: string,
  id: string
): Promise<Record<string, unknown> | null> {
  if (!(entity in RESENDABLE_TABLES)) return null;
  if (entity === CUSTOMER_PHOTO_ENTITY) {
    // Nombre in the Fotos tab is the customer's current name.
    const rows = await db
      .select({ ...getTableColumns(customerPhotos), name: customers.name })
      .from(customerPhotos)
      .innerJoin(customers, eq(customers.id, customerPhotos.id))
      .where(eq(customerPhotos.id, id));
    return rows[0] ? JSON.parse(JSON.stringify(rows[0])) : null;
  }
  const table = RESENDABLE_TABLES[entity as keyof typeof RESENDABLE_TABLES];
  const rows = await db.select().from(table).where(eq(table.id, id));
  return rows[0] ? JSON.parse(JSON.stringify(rows[0])) : null;
}

export interface PushOptions {
  /** The installed app's version, written to Extra's Versión de la app. */
  getAppVersion?: () => string;
}

export async function pushPendingMutations(
  db: Database,
  { getAppVersion = defaultGetAppVersion }: PushOptions = {}
): Promise<PushResult> {
  const sheetId = await getSheetId();
  if (!sheetId) {
    logger.warn("no sheet configured, skipping push");
    return { pushed: 0, failed: 0 };
  }

  // Queued before the pending select so this same push carries the re-sent
  // customers, and always before any pull (pull only runs after push).
  await createQueueCedulaResend({ db })({});

  // Customer rows are only written once the Sheet's Clientes tab is known to
  // be in the Cédula layout; until then they stay queued, untouched.
  const customersReady = await ensureClientesLayout(db, sheetId);
  // Payment rows wait for the Pagos tab's Tipo column the same way; until
  // then they stay queued (an older layout has no H for their kind).
  const paymentsReady = await ensurePagosLayout(db, sheetId);
  // Labels the appended Penalidad column on older Sheets; rows don't wait on it.
  await ensurePenaltyHeader(db, sheetId);
  // Moves existing rows' English enum cells to Spanish codes, once; rows don't wait on it.
  await ensureSheetSpanishValues(db, sheetId);

  // "failed" rows below the retry cap must stay eligible, or a single
  // transient failure (e.g. a push attempted while offline) makes that
  // mutation permanently invisible to every future push — silent data loss.
  const pending = await db
    .select()
    .from(pendingMutations)
    .where(
      and(
        or(eq(pendingMutations.status, "pending"), eq(pendingMutations.status, "failed")),
        lt(pendingMutations.retryCount, MAX_RETRIES)
      )
    );

  // Checked at most once per push, and only when a photo mutation is queued.
  let photosReady: boolean | null = null;

  let pushed = 0;
  let failed = 0;

  for (const mutation of pending) {
    const range = ENTITY_RANGES[mutation.entity];
    if (!range || mutation.entity === PROFILE_ENTITY) continue;

    if (
      mutation.operation !== "create" &&
      mutation.operation !== "update" &&
      mutation.operation !== "delete"
    ) {
      continue;
    }
    if (mutation.entity === "customer" && !customersReady) continue;
    if (mutation.entity === "payment" && !paymentsReady) continue;
    if (mutation.entity === CUSTOMER_PHOTO_ENTITY) {
      photosReady ??= await ensureFotosTab(sheetId);
      if (!photosReady) continue;
    }

    try {
      if (mutation.operation === "delete") {
        // Already gone (e.g. the owner deleted it too) counts as done.
        const rowNumber = await findRowNumber(sheetId, range, mutation.entityId);
        if (rowNumber) {
          await deleteRows(sheetId, range.split("!")[0], [rowNumber]);
        }
        await db.delete(pendingMutations).where(eq(pendingMutations.id, mutation.id));
        pushed += 1;
        continue;
      }

      const payload = mutation.payload
        ? JSON.parse(mutation.payload)
        : await currentRowPayload(db, mutation.entity, mutation.entityId);
      if (!payload) {
        // An empty-payload resend whose row no longer exists: nothing to send.
        await db.delete(pendingMutations).where(eq(pendingMutations.id, mutation.id));
        pushed += 1;
        continue;
      }
      const mapRow = ROW_MAPPERS[mutation.entity];
      const values = mapRow ? mapRow(payload) : [];

      if (mutation.operation === "create") {
        await appendRow(sheetId, range, values);
      } else {
        // Correct the existing Sheet row in place rather than duplicating
        // it. If the row was never pushed (e.g. created offline and still
        // queued), self-heal by appending instead of failing the update.
        const rowNumber = await findRowNumber(sheetId, range, mutation.entityId);
        if (rowNumber) {
          await updateRow(sheetId, rowRangeAt(range, rowNumber), values);
        } else {
          await appendRow(sheetId, range, values);
        }
      }

      if (mutation.entity in STAMPED_TABLES) {
        const table = STAMPED_TABLES[mutation.entity as keyof typeof STAMPED_TABLES];
        await db.update(table).set({ pushedAt: new Date() }).where(eq(table.id, mutation.entityId));
      }

      await db.delete(pendingMutations).where(eq(pendingMutations.id, mutation.id));
      pushed += 1;
    } catch (err) {
      await db
        .update(pendingMutations)
        .set({ status: "failed", retryCount: mutation.retryCount + 1, lastError: String(err) })
        .where(eq(pendingMutations.id, mutation.id));
      failed += 1;
    }
  }

  // The profile is written to Extra by Campo, all queued changes at once.
  const extra = await pushExtra(
    db,
    sheetId,
    pending.filter((mutation) => mutation.entity === PROFILE_ENTITY),
    getAppVersion
  );
  pushed += extra.pushed;
  failed += extra.failed;

  await db
    .insert(syncMeta)
    .values({ key: LAST_PUSHED_AT_KEY, value: String(Date.now()) })
    .onConflictDoUpdate({ target: syncMeta.key, set: { value: String(Date.now()) } });

  logger.info("push complete", { pushed, failed });
  return { pushed, failed };
}
