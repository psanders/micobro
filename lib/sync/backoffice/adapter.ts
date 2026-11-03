/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Outbox rows (`pending_mutations`) → contract v1 mutations for the back
 * office. Pure: give it the rows in outbox order and a way to look up local
 * payments (for cash closes), and it returns each mutation with the ids of
 * the outbox rows it stands for, so the caller can clear exactly those rows
 * once the back office has applied it.
 *
 *   customer create/update      → customer.upsert
 *   loan create                 → loan.create (with the schedule the app shows)
 *   loan update, cancelled      → loan.archive
 *   loan update, anything else  → loan.update (also how a restore travels)
 *   payment create              → payment.collect (consecutive rows of one cobro grouped)
 *   payment delete              → payment.void
 *   visit create                → visit.log
 *   cashClose create            → cashClose.create (with the payments it counted)
 */
import { toBusinessDate, toOffsetIso, type Mutation } from "@micobro/contract";
import { ARCHIVED_LOAN_STATUS, effectiveLoanType, type Loan } from "../../loans/loan.schema";
import { loanCostSummary } from "../../loans/loanMath";
import { installmentDueDate } from "../../loans/loanViews";
import { effectiveGraceDays, effectiveMoraRateBps, isMoraEnabled } from "../../loans/mora";
import { OPEN_CREDIT_DEFAULT_GRACE_DAYS } from "../../loans/openCredit";
import { MORA_NOTE } from "../../loans/loanViews";
import type { Payment } from "../../payments/payment.schema";

/** A `pending_mutations` row, as read from SQLite. */
export interface OutboxRow {
  id: string;
  entity: string;
  entityId: string;
  operation: string;
  payload: string;
  createdAt: Date;
  retryCount?: number;
}

export interface Mapped {
  mutation: Mutation;
  /** The outbox rows this mutation stands for. */
  rowIds: string[];
}

export interface Adapted {
  mapped: Mapped[];
  /** Outbox rows with nothing to send (e.g. a Sheet-cascade delete of a customer). */
  dropped: string[];
}

export interface AdapterContext {
  /** Local payments with `paidAt` in (from, to], for a cash close. */
  paymentsBetween(from: Date | null, to: Date): Promise<Payment[]>;
}

/** Penalty rows (Tradicional Plus) once that loan type lands in the app. */
const PENALTY_NOTE = "penalidad";

type Json = Record<string, unknown>;

const date = (v: unknown) => new Date(v as string);
const nullableDate = (v: unknown) => (v == null ? null : new Date(v as string));

function reviveLoan(p: Json): Loan {
  return {
    ...(p as unknown as Loan),
    startDate: date(p.startDate),
    createdAt: date(p.createdAt),
    updatedAt: date(p.updatedAt)
  };
}

function revivePayment(p: Json): Payment {
  return { ...(p as unknown as Payment), paidAt: date(p.paidAt), createdAt: date(p.createdAt) };
}

/** The loan's terms in the contract's shape, with the schedule the app derives from them. */
export function loanTermsOf(loan: Loan) {
  const isOpenCredit = effectiveLoanType(loan) === "open_credit";
  let clientView = null;
  if (!isOpenCredit) {
    const cost = loanCostSummary(loan);
    const dueDates: string[] = [];
    for (let n = 1; n <= loan.termCount; n++)
      dueDates.push(toBusinessDate(installmentDueDate(loan, n)));
    clientView = {
      totalRepayCents: cost.totalRepayCents,
      cuotaCents: cost.cuotaCents,
      lastCuotaCents: cost.lastCuotaCents,
      dueDates
    };
  }
  return {
    customerId: loan.customerId,
    type: effectiveLoanType(loan),
    principalCents: loan.principalCents,
    interestRateBps: loan.interestRateBps,
    termCount: isOpenCredit ? null : loan.termCount,
    frequency: loan.frequency,
    startDate: toBusinessDate(loan.startDate),
    graceDays: isOpenCredit
      ? (loan.graceDays ?? OPEN_CREDIT_DEFAULT_GRACE_DAYS)
      : effectiveGraceDays(loan),
    mora: { enabled: !isOpenCredit && isMoraEnabled(loan), rateBps: effectiveMoraRateBps(loan) },
    skipSundays: !!loan.skipSundays,
    penaltyCents: null,
    notes: loan.notes,
    clientView
  };
}

function partKind(payment: Payment): "installment" | "mora" | "penalty" {
  if (payment.notes === MORA_NOTE) return "mora";
  if (payment.notes === PENALTY_NOTE) return "penalty";
  return "installment";
}

export async function toMutations(rows: OutboxRow[], ctx: AdapterContext): Promise<Adapted> {
  const out: Mapped[] = [];
  const dropped: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const payload = JSON.parse(row.payload) as Json;
    const base = {
      mutationId: row.id,
      entityId: row.entityId,
      occurredAt: toOffsetIso(row.createdAt)
    };

    switch (`${row.entity}.${row.operation}`) {
      case "customer.create":
      case "customer.update":
        out.push({
          rowIds: [row.id],
          mutation: {
            ...base,
            type: "customer.upsert",
            payload: {
              name: payload.name as string,
              phone: payload.phone as string,
              address: (payload.address as string | null) ?? null,
              cedula: (payload.cedula as string | null) ?? null,
              avatarKey: (payload.avatarKey as string | null) ?? null
            }
          }
        });
        break;

      case "loan.create":
        out.push({
          rowIds: [row.id],
          mutation: { ...base, type: "loan.create", payload: loanTermsOf(reviveLoan(payload)) }
        });
        break;

      case "loan.update": {
        const loan = reviveLoan(payload);
        if (loan.status === ARCHIVED_LOAN_STATUS) {
          out.push({ rowIds: [row.id], mutation: { ...base, type: "loan.archive", payload: {} } });
        } else {
          // loan.update carries no customer: a loan's customer can't change.
          const terms: Partial<ReturnType<typeof loanTermsOf>> = { ...loanTermsOf(loan) };
          delete terms.customerId;
          out.push({
            rowIds: [row.id],
            mutation: {
              ...base,
              type: "loan.update",
              payload: terms as Omit<ReturnType<typeof loanTermsOf>, "customerId">
            }
          });
        }
        break;
      }

      case "payment.create": {
        // One cobro = consecutive payment rows for the same loan at the same instant.
        const first = revivePayment(payload);
        const group = [{ row, payment: first }];
        while (
          i + 1 < rows.length &&
          rows[i + 1]!.entity === "payment" &&
          rows[i + 1]!.operation === "create"
        ) {
          const next = revivePayment(JSON.parse(rows[i + 1]!.payload) as Json);
          if (next.loanId !== first.loanId || next.paidAt.getTime() !== first.paidAt.getTime())
            break;
          group.push({ row: rows[i + 1]!, payment: next });
          i += 1;
        }
        out.push({
          rowIds: group.map((g) => g.row.id),
          mutation: {
            ...base,
            type: "payment.collect",
            payload: {
              loanId: first.loanId,
              collectedAt: toOffsetIso(first.paidAt),
              method: first.method ?? "cash",
              parts: group.map((g) => ({
                paymentId: g.payment.id,
                kind: partKind(g.payment),
                amountCents: g.payment.amountCents
              })),
              // The app doesn't record, at cobro time, the mora it showed.
              clientView: null
            }
          }
        });
        break;
      }

      case "payment.delete":
        out.push({
          rowIds: [row.id],
          mutation: {
            ...base,
            type: "payment.void",
            payload: { loanId: payload.loanId as string, paymentId: row.entityId }
          }
        });
        break;

      case "visit.create":
        out.push({
          rowIds: [row.id],
          mutation: {
            ...base,
            type: "visit.log",
            payload: {
              customerId: payload.customerId as string,
              loanId: (payload.loanId as string | null) ?? null,
              outcome: payload.outcome as "promise" | "no_contact" | "refused" | "reschedule",
              promiseDate: payload.promiseDate ? toBusinessDate(date(payload.promiseDate)) : null,
              promiseAmountCents: (payload.promiseAmountCents as number | null) ?? null,
              note: (payload.note as string | null) ?? null,
              visitedAt: toOffsetIso(date(payload.createdAt))
            }
          }
        });
        break;

      case "cashClose.create": {
        const periodStart = nullableDate(payload.periodStart);
        const closedAt = date(payload.closedAt);
        const counted = await ctx.paymentsBetween(periodStart, closedAt);
        out.push({
          rowIds: [row.id],
          mutation: {
            ...base,
            type: "cashClose.create",
            payload: {
              amountCents: payload.amountCents as number,
              periodStart: periodStart ? toOffsetIso(periodStart) : null,
              closedAt: toOffsetIso(closedAt),
              paymentIds: counted.map((p) => p.id)
            }
          }
        });
        break;
      }

      default:
        dropped.push(row.id);
    }
  }
  return { mapped: out, dropped };
}
