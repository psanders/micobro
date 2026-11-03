/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Micobro ↔ back office wire contract, version 1 (Phase 1 proof of concept).
 *
 * Shape: the app keeps doing what it does today with the Google Sheet — it
 * records facts locally and replays an outbox (`pending_mutations`) — but
 * the outbox is sent as a batch of typed mutations to the back office
 * instead of being written as Sheet rows. The back office (a TypeScript
 * BFF in front of Apache Fineract) applies each mutation and answers per
 * mutation. After cutover the server is the source of truth, so the app
 * reads loan state back with `LoanStateV1` instead of deriving it.
 *
 * Rules every field follows:
 *  - Ids are the app's own UUIDs (`Crypto.randomUUID()`), sent as the
 *    mutation's `entityId`. The server stores them as Fineract `externalId`
 *    and uses them as idempotency keys, so a replayed batch is harmless.
 *  - Money is integer cents of DOP and always a whole peso (multiple of
 *    100), the same unit the app stores (`lib/utils/money.ts`).
 *  - Calendar dates the lender reasons about (a loan's start, a cuota's due
 *    date) are `YYYY-MM-DD` business dates in America/Santo_Domingo.
 *    Instants (when a cobro happened) are ISO-8601 with an offset.
 *  - Every money-bearing mutation carries `clientView`: the numbers the app
 *    computed and showed the lender. The server never trusts them — it
 *    recomputes — but reports any difference as `drift`, which is how
 *    Phase 1 measures the gap between Micobro's math and Fineract's.
 */
import { z } from "zod/v4";

export const CONTRACT_VERSION = 1 as const;

// ── Primitives ────────────────────────────────────────────────────────────

export const entityId = z.uuid();
/** Integer cents, whole pesos only (the app never stores centavos). */
export const cents = z
  .number()
  .int()
  .nonnegative()
  .refine((v) => v % 100 === 0, "Amounts are whole pesos (multiples of 100 cents)");
export const positiveCents = cents.refine((v) => v > 0, "Amount must be greater than zero");
/**
 * Integer cents, centavos allowed. Only server-computed amounts use it: mora
 * accrues daily in centavos (10%/30 of a cuota), so what is owed isn't always
 * a whole peso even though everything a lender types is.
 */
export const exactCents = z.number().int().nonnegative();
export const businessDate = z.iso.date();
export const instant = z.iso.datetime({ offset: true });
export const basisPoints = z.number().int().nonnegative();

export const frequencies = ["daily", "weekly", "biweekly", "monthly"] as const;
export const loanTypes = ["term", "open_credit", "tradicional_plus"] as const;
export const paymentMethods = ["cash", "transfer"] as const;
export const visitOutcomes = ["promise", "no_contact", "refused", "reschedule"] as const;

// ── Payloads ──────────────────────────────────────────────────────────────

export const customerUpsert = z.object({
  name: z.string().min(1),
  /** 10 digits, normalized (lib/customers/customer.schema.ts). */
  phone: z.string().regex(/^\d{10}$/),
  address: z.string().nullable().optional(),
  /** 11 digits, normalized. */
  cedula: z
    .string()
    .regex(/^\d{11}$/)
    .nullable()
    .optional(),
  avatarKey: z.string().nullable().optional()
});

/** The schedule the app derived and showed when the loan was created/edited. */
export const loanClientView = z.object({
  totalRepayCents: cents,
  cuotaCents: cents,
  lastCuotaCents: cents,
  dueDates: z.array(businessDate)
});

export const loanTerms = z.object({
  customerId: entityId,
  type: z.enum(loanTypes),
  principalCents: positiveCents,
  /**
   * term / tradicional_plus: flat rate over the WHOLE loan (2000 = 20%).
   * open_credit: rate per cycle on the outstanding balance.
   */
  interestRateBps: basisPoints,
  /** Number of cuotas; null for open_credit, which has no fixed term. */
  termCount: z.number().int().positive().nullable(),
  frequency: z.enum(frequencies),
  /** Disbursement day. The first cuota falls one interval later. */
  startDate: businessDate,
  /** term: days before mora accrues. open_credit/tradicional_plus: days before capitalizing/penalizing. */
  graceDays: z.number().int().nonnegative(),
  mora: z.object({ enabled: z.boolean(), rateBps: basisPoints }),
  skipSundays: z.boolean(),
  /** Tradicional Plus fixed penalty per uncovered cycle; null otherwise. */
  penaltyCents: cents.nullable(),
  notes: z.string().nullable().optional(),
  clientView: loanClientView.nullable()
});

/**
 * One cobro, as the app records it: one `payments` row per part, all sharing
 * `collectedAt`. Part ids are the app's payment row ids.
 *  - installment: counts toward the cuotas (principal + flat interest)
 *  - mora: late fee (row flagged notes="mora")
 *  - penalty: Tradicional Plus penalty (row flagged notes="penalidad")
 */
export const paymentPart = z.object({
  paymentId: entityId,
  kind: z.enum(["installment", "mora", "penalty"]),
  amountCents: positiveCents
});

export const paymentCollect = z.object({
  loanId: entityId,
  collectedAt: instant,
  method: z.enum(paymentMethods),
  parts: z.array(paymentPart).min(1),
  /** What the app showed before the cobro, and expects after it. */
  clientView: z
    .object({
      moraBeforeCents: cents,
      installmentsPaidAfter: z.number().int().nonnegative(),
      balanceAfterCents: cents
    })
    .nullable()
});

export const paymentVoid = z.object({
  loanId: entityId,
  /** The payment row being removed (a Sheet deletion today). */
  paymentId: entityId
});

export const visitLog = z.object({
  customerId: entityId,
  loanId: entityId.nullable(),
  outcome: z.enum(visitOutcomes),
  promiseDate: businessDate.nullable(),
  promiseAmountCents: cents.nullable(),
  note: z.string().nullable(),
  visitedAt: instant
});

/**
 * A collector forgives mora (Fineract "waive"). The server waives whole daily
 * charges, oldest first, without going over `amountCents`, and records who
 * did it and why.
 */
export const moraWaive = z.object({
  loanId: entityId,
  amountCents: exactCents.refine((v) => v > 0, "Amount must be greater than zero"),
  reason: z.string().min(1)
});

export const cashCloseCreate = z.object({
  amountCents: positiveCents,
  periodStart: instant.nullable(),
  closedAt: instant,
  /** The payment row ids the app counted into this close. */
  paymentIds: z.array(entityId)
});

// ── Mutations ─────────────────────────────────────────────────────────────

const base = {
  /** Unique per mutation (the `pending_mutations` row id). */
  mutationId: entityId,
  /** The app's id for the entity this mutation creates or changes. */
  entityId,
  occurredAt: instant
};

export const mutation = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("customer.upsert"), payload: customerUpsert }),
  z.object({ ...base, type: z.literal("loan.create"), payload: loanTerms }),
  /** Editar préstamo: corrected terms for an existing loan (customer can't change). */
  z.object({
    ...base,
    type: z.literal("loan.update"),
    payload: loanTerms.omit({ customerId: true })
  }),
  z.object({ ...base, type: z.literal("loan.archive"), payload: z.object({}) }),
  z.object({ ...base, type: z.literal("loan.restore"), payload: z.object({}) }),
  /** entityId is the cobro id (the receipt). */
  z.object({ ...base, type: z.literal("payment.collect"), payload: paymentCollect }),
  z.object({ ...base, type: z.literal("payment.void"), payload: paymentVoid }),
  /** entityId is the waiver's id. */
  z.object({ ...base, type: z.literal("mora.waive"), payload: moraWaive }),
  z.object({ ...base, type: z.literal("visit.log"), payload: visitLog }),
  z.object({ ...base, type: z.literal("cashClose.create"), payload: cashCloseCreate })
]);

export type Mutation = z.infer<typeof mutation>;
export type MutationType = Mutation["type"];

export const syncRequest = z.object({
  contractVersion: z.literal(CONTRACT_VERSION),
  /** Identifies the device (collector). The tenant comes from the auth token, never the body. */
  deviceId: z.string().min(1),
  sentAt: instant,
  /** In outbox order; the server applies them in this order. */
  mutations: z.array(mutation).min(1).max(100)
});

export type SyncRequest = z.infer<typeof syncRequest>;

// ── Responses ─────────────────────────────────────────────────────────────

export const errorCodes = [
  /** Payload failed the contract schema. Retrying won't help. */
  "VALIDATION",
  /** Refers to an entity the server doesn't have (e.g. its create hasn't arrived). Retry later. */
  "NOT_FOUND",
  /** Valid Micobro behavior that has no back office mapping yet — a known gap. */
  "UNSUPPORTED",
  /** Conflicts with server state (e.g. Fineract refused the state change). */
  "CONFLICT",
  /**
   * Dated after the server's business date (device clock ahead, or the
   * nightly close hasn't moved the date yet). Retry later, unchanged.
   */
  "NOT_YET",
  /** Fineract failed or was unreachable. Retry. */
  "UPSTREAM"
] as const;
export type ErrorCode = (typeof errorCodes)[number];

export const drift = z.object({
  field: z.string(),
  client: z.union([z.number(), z.string(), z.null()]),
  server: z.union([z.number(), z.string(), z.null()])
});
export type Drift = z.infer<typeof drift>;

export const mutationResult = z.object({
  mutationId: entityId,
  status: z.enum(["applied", "duplicate", "rejected"]),
  error: z
    .object({
      code: z.enum(errorCodes),
      message: z.string(),
      /** For UNSUPPORTED: the gap id in backoffice/GAP-ANALYSIS.md. */
      gap: z.string().optional()
    })
    .optional(),
  /** Differences between the app's clientView and the server's own numbers. */
  drift: z.array(drift).default([])
});
export type MutationResult = z.infer<typeof mutationResult>;

export const syncResponse = z.object({
  contractVersion: z.literal(CONTRACT_VERSION),
  results: z.array(mutationResult)
});
export type SyncResponse = z.infer<typeof syncResponse>;

/** Server-owned loan state the app renders after cutover (pull). */
export const loanStateV1 = z.object({
  loanId: entityId,
  status: z.enum(["active", "paid", "archived"]),
  asOf: businessDate,
  /** Mora stopped at 90 days late: the loan was charged off. Payments are still collected. */
  chargedOff: z.boolean(),
  principalCents: cents,
  totalRepayCents: cents,
  /** Toward the cuotas (principal + interest); excludes mora and penalties. */
  paidCents: exactCents,
  balanceCents: exactCents,
  installmentsPaid: z.number().int().nonnegative(),
  nextDueDate: businessDate.nullable(),
  /** Mora owed today: Fineract's daily charges on every late cuota, net of paid and waived. */
  moraCents: exactCents,
  /** Days since the oldest unpaid cuota fell due. */
  moraDays: z.number().int().nonnegative(),
  schedule: z.array(
    z.object({
      number: z.number().int().positive(),
      dueDate: businessDate,
      amountCents: cents,
      paidCents: exactCents,
      status: z.enum(["paid", "overdue", "upcoming"])
    })
  )
});
export type LoanStateV1 = z.infer<typeof loanStateV1>;
