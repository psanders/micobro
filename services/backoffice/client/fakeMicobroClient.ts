/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * A stand-in for the Micobro app talking to the back office. It keeps local
 * rows shaped exactly like the app's (`Loan`, `Payment`), runs the app's
 * real engines on them (`lib/loans/loanMath.ts`, `mora.ts`, `loanViews.ts`,
 * `lib/payments/paymentSplit.ts`), records every change in an outbox the way
 * `pending_mutations` does, and replays that outbox to the back office as a
 * contract v1 batch.
 *
 * Because the numbers come from the app's own code, any drift the back office
 * reports is a real difference between Micobro and Fineract, not a quirk of
 * the fake. The client's clock is explicit (`now`), so scenarios can walk
 * the calendar.
 */
import { randomUUID } from "crypto";
import {
  CONTRACT_VERSION,
  type Mutation,
  type SyncResponse,
  syncResponse
} from "@micobro/contract";
import { toBusinessDate, toOffsetIso } from "../dates";
import { createCustomerSchema } from "../../../lib/customers/customer.schema";
import {
  createLoanSchema,
  effectiveLoanType,
  loanTermsFields,
  type Loan,
  type LoanFrequency
} from "../../../lib/loans/loan.schema";
import { loanCostSummary } from "../../../lib/loans/loanMath";
import { buildLoanDetailView, installmentDueDate, MORA_NOTE } from "../../../lib/loans/loanViews";
import {
  computeLoanMora,
  effectiveGraceDays,
  effectiveMoraRateBps,
  isMoraEnabled,
  loanMoraPolicy
} from "../../../lib/loans/mora";
import { OPEN_CREDIT_DEFAULT_GRACE_DAYS } from "../../../lib/loans/openCredit";
import { computePaymentSplit } from "../../../lib/payments/paymentSplit";
import type { Payment, PaymentMethod } from "../../../lib/payments/payment.schema";

/** POST /v1/sync. In tests: the Backoffice in-process; later: HTTP with a bearer token. */
export type Transport = (body: unknown) => Promise<unknown>;

export interface NewLoan {
  customerId: string;
  /** Pesos, as typed in Nuevo préstamo. */
  principal: number;
  /** Percent, as typed. Whole-loan flat rate (term) or per-cycle rate (open credit). */
  interestRate: number;
  termCount?: number;
  frequency: LoanFrequency;
  startDate: Date;
  graceDays?: number;
  moraEnabled?: boolean;
  moraRate?: number;
  skipSundays?: boolean;
  loanType?: "term" | "open_credit";
}

export interface CollectOptions {
  method?: PaymentMethod;
  /**
   * "auto": mora first, the rest to the cuota (the app's default cobro).
   * "installment": cuota only, mora left uncollected.
   * "mora": the whole amount is mora ("Solo mora").
   */
  mode?: "auto" | "installment" | "mora";
}

interface OutboxEntry {
  mutation: Mutation;
  lastError: string | null;
}

export class FakeMicobroClient {
  /** The device clock. Scenarios move it forward. */
  now: Date;
  readonly loans = new Map<string, Loan>();
  readonly payments: Payment[] = [];
  readonly outbox: OutboxEntry[] = [];
  private lastCloseAt: Date | null = null;

  constructor(
    private readonly transport: Transport,
    readonly deviceId = "device-1",
    now = new Date(2026, 0, 1, 9, 0, 0)
  ) {
    this.now = now;
  }

  /** Moves the clock to `date` (device-local), keeping a working-hours time of day. */
  setToday(date: Date, hour = 10) {
    this.now = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, 0, 0);
  }

  private enqueue(mutation: Omit<Mutation, "mutationId" | "occurredAt">) {
    this.outbox.push({
      mutation: {
        ...mutation,
        mutationId: randomUUID(),
        occurredAt: toOffsetIso(this.now)
      } as Mutation,
      lastError: null
    });
  }

  // ── Customers ───────────────────────────────────────────────────────────

  createCustomer(input: {
    name: string;
    phone: string;
    cedula?: string;
    address?: string;
  }): string {
    const customer = createCustomerSchema.parse(input);
    const id = randomUUID();
    this.enqueue({
      type: "customer.upsert",
      entityId: id,
      payload: {
        name: customer.name,
        phone: customer.phone,
        cedula: customer.cedula ?? null,
        address: customer.address ?? null
      }
    });
    return id;
  }

  // ── Loans ───────────────────────────────────────────────────────────────

  createLoan(input: NewLoan): string {
    const terms = createLoanSchema.parse(input);
    const id = randomUUID();
    const loan: Loan = {
      id,
      customerId: terms.customerId,
      ...loanTermsFields(terms),
      startDate: input.startDate,
      status: "active",
      createdAt: this.now,
      updatedAt: this.now
    };
    this.loans.set(id, loan);
    this.enqueue({ type: "loan.create", entityId: id, payload: this.loanPayload(loan) });
    return id;
  }

  /** Editar préstamo: same terms shape; the customer can't change. */
  updateLoan(loanId: string, input: Omit<NewLoan, "customerId">) {
    const current = this.loan(loanId);
    const terms = createLoanSchema.parse({ ...input, customerId: current.customerId });
    const loan: Loan = {
      ...current,
      ...loanTermsFields(terms),
      startDate: input.startDate,
      updatedAt: this.now
    };
    this.loans.set(loanId, loan);
    const payload: Partial<ReturnType<typeof this.loanPayload>> = this.loanPayload(loan);
    delete payload.customerId;
    this.enqueue({
      type: "loan.update",
      entityId: loanId,
      payload: payload as Omit<ReturnType<typeof this.loanPayload>, "customerId">
    });
  }

  archiveLoan(loanId: string) {
    this.loans.set(loanId, { ...this.loan(loanId), status: "cancelled" });
    this.enqueue({ type: "loan.archive", entityId: loanId, payload: {} });
  }

  private loanPayload(loan: Loan) {
    const isOpenCredit = effectiveLoanType(loan) === "open_credit";
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
      clientView: isOpenCredit ? null : this.scheduleView(loan)
    };
  }

  private scheduleView(loan: Loan) {
    const cost = loanCostSummary(loan);
    const dueDates: string[] = [];
    for (let n = 1; n <= loan.termCount; n++)
      dueDates.push(toBusinessDate(installmentDueDate(loan, n)));
    return {
      totalRepayCents: cost.totalRepayCents,
      cuotaCents: cost.cuotaCents,
      lastCuotaCents: cost.lastCuotaCents,
      dueDates
    };
  }

  private loan(loanId: string): Loan {
    const loan = this.loans.get(loanId);
    if (!loan) throw new Error(`No local loan ${loanId}`);
    return loan;
  }

  private loanPayments(loanId: string): Payment[] {
    return this.payments.filter((p) => p.loanId === loanId);
  }

  /** What the app's loan detail would show right now (term loans). */
  view(loanId: string) {
    const loan = this.loan(loanId);
    const payments = this.loanPayments(loanId);
    const mora = computeLoanMora(loan, payments, this.now, loanMoraPolicy(loan));
    return buildLoanDetailView({
      loan,
      customerName: "",
      business: null,
      payments,
      moraCents: mora.moraCents,
      moraDays: mora.moraDays,
      today: this.now
    });
  }

  // ── Cobros ──────────────────────────────────────────────────────────────

  /**
   * A cobro of `amount` pesos, split the way the Registrar cobro screen does
   * (`computePaymentSplit`) and recorded the way `collectPayment` does: a
   * mora row flagged `MORA_NOTE`, then the cuota row, sharing `paidAt`.
   */
  collect(
    loanId: string,
    amount: number,
    options: CollectOptions = {}
  ): { cobroId: string; paymentIds: string[] } {
    const loan = this.loan(loanId);
    const before = this.view(loanId);
    const amountCents = Math.round(amount * 100);
    const split = computePaymentSplit({
      amountCents,
      expectedCuotaCents: before.schedule.find((s) => s.status !== "paid")?.amountCents ?? 0,
      accruedMoraCents: before.moraCents,
      kind:
        options.mode === "mora"
          ? "late_fee"
          : options.mode === "installment"
            ? "installment"
            : undefined
    });
    const moraCents = split.moraPortionCents;
    const installmentCents = amountCents - moraCents;
    const method = options.method ?? "cash";
    const paidAt = this.now;

    const parts: { paymentId: string; kind: "installment" | "mora"; amountCents: number }[] = [];
    if (moraCents > 0)
      parts.push({ paymentId: randomUUID(), kind: "mora", amountCents: moraCents });
    if (installmentCents > 0)
      parts.push({ paymentId: randomUUID(), kind: "installment", amountCents: installmentCents });
    for (const part of parts) {
      this.payments.push({
        id: part.paymentId,
        loanId,
        amountCents: part.amountCents,
        paidAt,
        method,
        notes: part.kind === "mora" ? MORA_NOTE : null,
        createdAt: paidAt
      });
    }

    const isTerm = effectiveLoanType(loan) === "term";
    const after = isTerm ? this.view(loanId) : null;
    const cobroId = randomUUID();
    this.enqueue({
      type: "payment.collect",
      entityId: cobroId,
      payload: {
        loanId,
        collectedAt: toOffsetIso(paidAt),
        method,
        parts,
        clientView: after
          ? {
              moraBeforeCents: before.moraCents,
              installmentsPaidAfter: after.installmentsPaid,
              balanceAfterCents: after.balanceCents
            }
          : null
      }
    });
    return { cobroId, paymentIds: parts.map((p) => p.paymentId) };
  }

  /** A payment row deleted (today: deleted from the Sheet and pulled back). */
  voidPayment(paymentId: string) {
    const index = this.payments.findIndex((p) => p.id === paymentId);
    if (index < 0) throw new Error(`No local payment ${paymentId}`);
    const [payment] = this.payments.splice(index, 1);
    this.enqueue({
      type: "payment.void",
      entityId: paymentId,
      payload: { loanId: payment!.loanId, paymentId }
    });
  }

  /** The collector forgives up to `amount` pesos of mora (whole pesos, as typed). */
  waiveMora(loanId: string, amount: number, reason: string): string {
    const id = randomUUID();
    this.enqueue({
      type: "mora.waive",
      entityId: id,
      payload: { loanId, amountCents: Math.round(amount * 100), reason }
    });
    return id;
  }

  logVisit(input: {
    customerId: string;
    loanId?: string;
    outcome: "promise" | "no_contact" | "refused" | "reschedule";
    promiseDate?: Date;
    promiseAmount?: number;
    note?: string;
  }) {
    this.enqueue({
      type: "visit.log",
      entityId: randomUUID(),
      payload: {
        customerId: input.customerId,
        loanId: input.loanId ?? null,
        outcome: input.outcome,
        promiseDate: input.promiseDate ? toBusinessDate(input.promiseDate) : null,
        promiseAmountCents: input.promiseAmount ? Math.round(input.promiseAmount * 100) : null,
        note: input.note ?? null,
        visitedAt: toOffsetIso(this.now)
      }
    });
  }

  /** Cierre de caja: every payment since the last close, as `getCashSummary` computes it. */
  closeCash(): number {
    const since = this.lastCloseAt;
    const counted = this.payments.filter((p) => !since || p.paidAt.getTime() > since.getTime());
    const amountCents = counted.reduce((s, p) => s + p.amountCents, 0);
    this.enqueue({
      type: "cashClose.create",
      entityId: randomUUID(),
      payload: {
        amountCents,
        periodStart: since ? toOffsetIso(since) : null,
        closedAt: toOffsetIso(this.now),
        paymentIds: counted.map((p) => p.id)
      }
    });
    this.lastCloseAt = this.now;
    return amountCents;
  }

  // ── Sync ────────────────────────────────────────────────────────────────

  /**
   * Replays the outbox as one batch. Applied and duplicate mutations leave
   * the outbox; rejected ones stay with their error, like a
   * `pending_mutations` row with `lastError`.
   */
  async sync(): Promise<SyncResponse> {
    const body = JSON.parse(
      JSON.stringify({
        contractVersion: CONTRACT_VERSION,
        deviceId: this.deviceId,
        sentAt: toOffsetIso(this.now),
        mutations: this.outbox.map((e) => e.mutation)
      })
    );
    const response = syncResponse.parse(await this.transport(body));
    const byId = new Map(response.results.map((r) => [r.mutationId, r]));
    for (let i = this.outbox.length - 1; i >= 0; i--) {
      const entry = this.outbox[i]!;
      const result = byId.get(entry.mutation.mutationId);
      if (!result) continue;
      if (result.status === "rejected")
        entry.lastError = `${result.error?.code}: ${result.error?.message}`;
      else this.outbox.splice(i, 1);
    }
    return response;
  }
}
