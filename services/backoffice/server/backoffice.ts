/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Fake back office (the future TypeScript BFF in front of Fineract), Phase 1.
 * Applies contract v1 mutations to a `FineractPort`, keeps the few things
 * Fineract has no home for in its own store, and reports drift between what
 * the app computed and what the server computes.
 *
 * Decisions this encodes (see GAP-ANALYSIS.md for the reasoning):
 *  - Mora is Fineract's: each product carries an overdue-installment charge
 *    (the loan's rate per 30 days, charged daily on every late cuota), the
 *    tenant's `penalty-wait-period` is the grace, and Fineract's nightly job
 *    accrues it. Accrued mora is owed until it is paid or waived
 *    (`mora.waive`). The BFF's own part is the nightly close (`closeDay`):
 *    move the business date, run the job, and charge off any loan whose
 *    oldest unpaid cuota reached 90 days late — charge-off is what stops
 *    Fineract's mora.
 *  - Each payment part becomes its own Fineract transaction (external id =
 *    the app's payment row id), so voiding one part reverses exactly it.
 *  - Editar préstamo is a replay: undo every repayment, undo disbursal and
 *    approval, modify, approve, disburse, and re-apply the cobro journal.
 *  - Open credit and Sunday-skipping daily loans are refused as
 *    UNSUPPORTED until their mapping is proven.
 *  - Archive, visits and cash closes live in the BFF's own store.
 */
import { z } from "zod/v4";
import {
  CONTRACT_VERSION,
  syncRequest,
  type Drift,
  type LoanStateV1,
  type Mutation,
  type MutationResult,
  type SyncResponse,
  type cashCloseCreate,
  type moraWaive
} from "@micobro/contract";
import {
  FineractDomainError,
  type FineractLoan,
  type FineractPort,
  type LoanCharge
} from "../fineract/port";
import { addDays, compareDates, daysBetween, weekday } from "../dates";
import { dueDateFor, simulateMora } from "../fineract/model";
import { randomUUID } from "crypto";
import {
  businessDateOf,
  centsToPesos,
  MORA_STOP_DAYS,
  moraRateBps,
  overdueCharge,
  PAYMENT_TYPE_NAME,
  PENALTY_CHARGE_NAME,
  pesosToCents,
  productFor,
  repaymentPeriod,
  versionedExternalId
} from "./mapping";

import {
  MemoryStore,
  type BackofficeStore,
  type Collect,
  type LoanRecord,
  type LoanTerms
} from "./store";

/** Outcomes a later replay of the same mutation can turn into "applied". */
const RETRYABLE: string[] = ["NOT_FOUND", "NOT_YET", "UPSTREAM"];

/** Fineract refusals that only mean "not yet": the business date hasn't caught up. */
const NOT_YET_CODES = ["error.msg.loan.transaction.cannot.be.a.future.date"];

class Rejection extends Error {
  constructor(
    readonly code: "NOT_FOUND" | "UNSUPPORTED" | "CONFLICT",
    message: string,
    readonly gap?: string
  ) {
    super(message);
  }
}

/** Penalties added by `repairMora` for mora Fineract's job missed. */
const MORA_ADJUSTMENT_CHARGE_NAME = "Mora (ajuste)";
const MORA_ADJUSTMENT_PREFIX = "mora-adj:";

/** Mora: Fineract's daily overdue charges plus the BFF's adjustments. */
function isMoraCharge(c: LoanCharge): boolean {
  return c.overdue || (c.externalId?.startsWith(MORA_ADJUSTMENT_PREFIX) ?? false);
}

/** Whether two loan terms would build the same Fineract loan (the app's `clientView` and notes aside). */
function sameTerms(a: LoanTerms, b: LoanTerms): boolean {
  const canonical = (t: LoanTerms) =>
    JSON.stringify(
      Object.entries(t)
        .filter(([key]) => key !== "clientView" && key !== "notes")
        .sort(([x], [y]) => x.localeCompare(y))
    );
  return canonical(a) === canonical(b);
}

/** Installment amount toward the cuotas (excludes penalties), in cents. */
function cuotaOf(p: FineractLoan["periods"][number]): number {
  return pesosToCents(p.principalDue + p.interestDue);
}

/** What has been paid toward a cuota itself (its principal and interest). */
function cuotaPaid(p: FineractLoan["periods"][number]): number {
  return pesosToCents(p.principalPaid + p.interestPaid);
}

export interface BackofficePolicy {
  /** Tenant-wide late days never charged (Fineract `penalty-wait-period`). Mikro uses 0. */
  graceDays: number;
}

export class Backoffice {
  private configured = false;
  /** The device of the batch being applied (Phase 2: from the auth token). */
  private deviceId = "";

  constructor(
    private readonly fineract: FineractPort,
    readonly store: BackofficeStore = new MemoryStore(),
    readonly policy: BackofficePolicy = { graceDays: 0 }
  ) {}

  private async configure() {
    if (this.configured) return;
    await this.fineract.prepareTenant?.();
    await this.fineract.setPenaltyGraceDays(this.policy.graceDays);
    this.configured = true;
  }

  /**
   * The nightly close for `date` (the day that is starting): move Fineract's
   * business date, let its overdue job accrue mora, and charge off every loan
   * whose oldest unpaid cuota has reached 90 days late, so no mora accrues
   * past day 90. When a loan crosses day 90 before `date`, the close stops on
   * that day first, so the stop is exact even if nights were skipped.
   */
  async closeDay(date: string): Promise<void> {
    await this.configure();
    for (;;) {
      const crossings = await this.moraStopDates();
      const from = await this.store.getLastClosed();
      const early = crossings
        .map((c) => c.stopOn)
        .filter((d) => compareDates(d, date) < 0 && (!from || compareDates(d, from) > 0))
        .sort(compareDates)[0];
      const step = early ?? date;
      await this.fineract.setBusinessDate(step);
      await this.fineract.runOverdueJob();
      for (const c of crossings) {
        if (compareDates(c.stopOn, step) > 0) continue;
        await this.fineract.chargeOff(c.loan.fineractId, step);
        c.loan.chargedOffOn = step;
        await this.store.putLoan(c.loan);
      }
      await this.store.setLastClosed(step);
      if (step === date) return;
    }
  }

  /** Loans still accruing mora, and the day their oldest unpaid cuota turns 90 days late. */
  private async moraStopDates(): Promise<{ loan: LoanRecord; stopOn: string }[]> {
    const out: { loan: LoanRecord; stopOn: string }[] = [];
    for (const loan of await this.store.listLoans()) {
      if (moraRateBps(loan.terms) === 0) continue;
      const fl = await this.fineract.getLoan(loan.fineractId);
      if (fl.chargedOff || fl.status !== "active") continue;
      const oldest = fl.periods.find((p) => cuotaOf(p) > 0 && cuotaPaid(p) < cuotaOf(p));
      if (oldest) out.push({ loan, stopOn: addDays(oldest.dueDate, MORA_STOP_DAYS) });
    }
    return out;
  }

  /** POST /v1/sync. The tenant would come from the auth token (Phase 2). */
  async handleSync(body: unknown): Promise<SyncResponse> {
    const request = syncRequest.parse(body);
    await this.configure();
    this.deviceId = request.deviceId;
    const results: MutationResult[] = [];
    for (const m of request.mutations) {
      const previous = await this.store.getResult(m.mutationId);
      if (previous) {
        results.push({
          ...previous,
          status: previous.status === "applied" ? "duplicate" : previous.status
        });
        continue;
      }
      const result = await this.apply(m);
      // Only final outcomes are remembered; NOT_FOUND/UPSTREAM may succeed on retry.
      if (result.status === "applied" || !RETRYABLE.includes(result.error?.code ?? "")) {
        await this.store.putResult(result);
      }
      results.push(result);
    }
    return { contractVersion: CONTRACT_VERSION, results };
  }

  private async apply(m: Mutation): Promise<MutationResult> {
    try {
      const drift = await this.dispatch(m);
      return { mutationId: m.mutationId, status: "applied", drift };
    } catch (error) {
      if (error instanceof Rejection) {
        return {
          mutationId: m.mutationId,
          status: "rejected",
          error: {
            code: error.code,
            message: error.message,
            ...(error.gap ? { gap: error.gap } : {})
          },
          drift: []
        };
      }
      if (error instanceof FineractDomainError) {
        return {
          mutationId: m.mutationId,
          status: "rejected",
          error: {
            code: NOT_YET_CODES.includes(error.code) ? "NOT_YET" : "CONFLICT",
            message: `${error.code}: ${error.message}`
          },
          drift: []
        };
      }
      return {
        mutationId: m.mutationId,
        status: "rejected",
        error: {
          code: "UPSTREAM",
          message: error instanceof Error ? error.message : String(error)
        },
        drift: []
      };
    }
  }

  private async dispatch(m: Mutation): Promise<Drift[]> {
    switch (m.type) {
      case "customer.upsert":
        return this.upsertCustomer(m.entityId, m.payload, businessDateOf(m.occurredAt));
      case "loan.create":
        return this.createLoan(m.entityId, m.payload);
      case "loan.update":
        return this.updateLoan(m.entityId, m.payload);
      case "loan.archive":
      case "loan.restore": {
        const loan = await this.loanRecord(m.entityId);
        loan.archived = m.type === "loan.archive";
        await this.store.putLoan(loan);
        return [];
      }
      case "payment.collect": {
        const loan = await this.loanRecord(m.payload.loanId);
        loan.cobros.push({ cobroId: m.entityId, collect: m.payload });
        // Saved only once applied: a failed cobro must not join the journal.
        const drift = await this.applyCollect(loan, m.payload);
        await this.store.putLoan(loan);
        return drift;
      }
      case "payment.void":
        return this.voidPayment(m.payload.loanId, m.payload.paymentId);
      case "mora.waive":
        return this.waiveMora(m.entityId, m.payload, businessDateOf(m.occurredAt));
      case "visit.log":
        if ((await this.store.getCustomer(m.payload.customerId)) === null) {
          throw new Rejection("NOT_FOUND", `Unknown customer ${m.payload.customerId}`);
        }
        await this.store.putVisit(m.entityId, m.payload);
        return [];
      case "cashClose.create":
        return this.closeCash(m.entityId, m.payload);
    }
  }

  // ── Customers ───────────────────────────────────────────────────────────

  private async upsertCustomer(
    id: string,
    c: { name: string; phone: string },
    activationDate: string
  ): Promise<Drift[]> {
    const existing =
      (await this.store.getCustomer(id)) ?? (await this.fineract.findClientIdByExternalId(id));
    if (existing) {
      await this.fineract.updateClient(existing, { fullname: c.name, mobileNo: c.phone });
      await this.store.putCustomer(id, existing);
      return [];
    }
    const clientId = await this.fineract.createClient({
      externalId: id,
      fullname: c.name,
      mobileNo: c.phone,
      activationDate
    });
    await this.store.putCustomer(id, clientId);
    return [];
  }

  // ── Loans ───────────────────────────────────────────────────────────────

  private async loanRecord(loanId: string): Promise<LoanRecord> {
    const loan = await this.store.getLoan(loanId);
    if (!loan) throw new Rejection("NOT_FOUND", `Unknown loan ${loanId}`);
    return loan;
  }

  private assertMappable(terms: Omit<LoanTerms, "customerId">) {
    if (terms.type === "open_credit") {
      throw new Rejection(
        "UNSUPPORTED",
        "Crédito abierto has no Fineract product mapping yet",
        "G-OPEN-CREDIT"
      );
    }
    if (terms.termCount === null) {
      throw new Rejection("UNSUPPORTED", "A term loan needs termCount");
    }
  }

  private async ensureProduct(terms: Omit<LoanTerms, "customerId">): Promise<number> {
    const rate = moraRateBps(terms);
    const charge = overdueCharge(rate);
    const chargeId =
      rate > 0 ? await this.fineract.ensureOverdueCharge(charge.name, charge.percentPerDay) : null;
    return this.fineract.ensureLoanProduct(productFor(terms, chargeId));
  }

  private loanRequestTerms(terms: Omit<LoanTerms, "customerId">, productId: number) {
    return {
      productId,
      principal: centsToPesos(terms.principalCents),
      interestRatePerPeriod: terms.interestRateBps / 100,
      numberOfRepayments: terms.termCount as number,
      ...repaymentPeriod(terms.frequency),
      expectedDisbursementDate: terms.startDate,
      submittedOnDate: terms.startDate
    };
  }

  private async createLoan(id: string, terms: LoanTerms): Promise<Drift[]> {
    this.assertMappable(terms);
    const clientId = await this.store.getCustomer(terms.customerId);
    if (!clientId) throw new Rejection("NOT_FOUND", `Unknown customer ${terms.customerId}`);

    let fineractId = await this.fineract.findLoanIdByExternalId(id);
    if (!fineractId) {
      const productId = await this.ensureProduct(terms);
      fineractId = await this.fineract.createLoan({
        externalId: id,
        clientId,
        ...this.loanRequestTerms(terms, productId)
      });
      await this.fineract.approveLoan(fineractId, terms.startDate);
      await this.fineract.disburseLoan(
        fineractId,
        terms.startDate,
        centsToPesos(terms.principalCents)
      );
      await this.skipSundays(fineractId, terms);
    }
    await this.store.putLoan({
      loanId: id,
      fineractId,
      terms,
      archived: false,
      chargedOffOn: null,
      version: 0,
      cobros: [],
      voided: []
    });
    return this.scheduleDrift(terms, await this.fineract.getLoan(fineractId));
  }

  /** Editar préstamo, as a replay — Fineract refuses term changes on an active loan. */
  private async updateLoan(id: string, change: Omit<LoanTerms, "customerId">): Promise<Drift[]> {
    const loan = await this.loanRecord(id);
    const terms: LoanTerms = { ...change, customerId: loan.terms.customerId };
    this.assertMappable(terms);
    if (terms.type !== loan.terms.type || terms.frequency !== loan.terms.frequency) {
      // A different product: Fineract can't move a loan between products.
      throw new Rejection(
        "UNSUPPORTED",
        "Changing loan type or frequency needs a new Fineract loan",
        "G-LOAN-CORRECTION"
      );
    }
    // An update on an archived loan is how the app restores it (its outbox
    // can't tell a restore from an edit). Unchanged terms need no replay.
    const restored = loan.archived;
    loan.archived = false;
    if (sameTerms(loan.terms, terms)) {
      if (restored) await this.store.putLoan(loan);
      return [];
    }
    await this.replayLoan(loan, terms);
    return this.scheduleDrift(terms, await this.fineract.getLoan(loan.fineractId));
  }

  /**
   * Rebuilds a loan in Fineract from its terms and cobro journal: undo every
   * repayment and the disbursal, modify, approve, disburse, re-apply the
   * live cobros under new external ids, then redo the mora. Used by Editar
   * préstamo (G-LOAN-CORRECTION) and to void a Tradicional Plus penalty,
   * since Fineract can't reschedule a cuota back to an earlier date (G-TP-VOID).
   */
  private async replayLoan(loan: LoanRecord, terms: LoanTerms): Promise<void> {
    const fl = await this.fineract.getLoan(loan.fineractId);
    for (const tx of fl.transactions) {
      if (tx.type === "repayment" && !tx.reversed && tx.externalId) {
        await this.undoByExternalId(loan, tx.externalId);
      }
    }
    await this.fineract.undoDisbursal(loan.fineractId);
    await this.fineract.undoApproval(loan.fineractId);
    const productId = await this.ensureProduct(terms);
    await this.fineract.modifyLoan(loan.fineractId, this.loanRequestTerms(terms, productId));
    await this.fineract.approveLoan(loan.fineractId, terms.startDate);
    await this.fineract.disburseLoan(
      loan.fineractId,
      terms.startDate,
      centsToPesos(terms.principalCents)
    );
    await this.skipSundays(loan.fineractId, terms);

    loan.terms = terms;
    loan.version += 1;
    // The replay re-records every part; drop the old ones so mora netting
    // only sees cobros already re-applied.
    await this.store.deletePartsOfLoan(loan.loanId);
    for (const { collect } of loan.cobros) {
      await this.applyCollect(loan, collect);
    }
    // Undoing the disbursal dropped every mora charge; the job re-accrues
    // what is late now (see G-LOAN-CORRECTION in GAP-ANALYSIS.md).
    await this.fineract.runOverdueJob();
    await this.repairMora(loan, [], null);
    await this.store.putLoan(loan);
  }

  private scheduleDrift(terms: Omit<LoanTerms, "customerId">, fl: FineractLoan): Drift[] {
    const drift: Drift[] = [];
    // Grace is one tenant-wide value in Fineract, not per loan.
    if (moraRateBps(terms) > 0 && terms.graceDays !== this.policy.graceDays) {
      drift.push({ field: "graceDays", client: terms.graceDays, server: this.policy.graceDays });
    }
    const view = terms.clientView;
    if (!view) return drift;
    const server = {
      totalRepayCents: fl.periods.reduce((s, p) => s + cuotaOf(p), 0),
      cuotaCents: fl.periods[0] ? cuotaOf(fl.periods[0]) : 0,
      lastCuotaCents: fl.periods.length ? cuotaOf(fl.periods[(terms.termCount ?? 1) - 1]!) : 0
    };
    for (const field of ["totalRepayCents", "cuotaCents", "lastCuotaCents"] as const) {
      if (view[field] !== server[field])
        drift.push({ field, client: view[field], server: server[field] });
    }
    const cuotas = fl.periods.filter((p) => cuotaOf(p) > 0);
    cuotas.forEach((p, i) => {
      // Middle installments can differ from cuotaCents/lastCuotaCents too.
      const clientAmount = i === cuotas.length - 1 ? view.lastCuotaCents : view.cuotaCents;
      if (i > 0 && i < cuotas.length - 1 && cuotaOf(p) !== clientAmount) {
        drift.push({
          field: `schedule[${i + 1}].amountCents`,
          client: clientAmount,
          server: cuotaOf(p)
        });
      }
      const clientDate = view.dueDates[i] ?? null;
      if (clientDate !== p.dueDate) {
        drift.push({ field: `schedule[${i + 1}].dueDate`, client: clientDate, server: p.dueDate });
      }
    });
    return drift;
  }

  // ── Payments ────────────────────────────────────────────────────────────

  private async applyCollect(loan: LoanRecord, collect: Collect): Promise<Drift[]> {
    const collectedOn = businessDateOf(collect.collectedAt);
    const before = await this.loanState(loan, collectedOn);
    const parts = collect.parts.filter((p) => !loan.voided.includes(p.paymentId));
    // A cobro dated before the last nightly close reaches Fineract after its
    // mora job already ran without it. Fix the mora first, while the wrong
    // charges are still unpaid (Fineract won't waive a paid charge).
    const lastClosed = await this.store.getLastClosed();
    if (lastClosed && compareDates(collectedOn, lastClosed) < 0) {
      await this.repairMora(
        loan,
        parts.map((p) => ({ date: collectedOn, amount: p.amountCents })),
        collect
      );
    }
    await this.postParts(loan, collect);

    const view = collect.clientView;
    if (!view) return [];
    const after = await this.loanState(loan, collectedOn);
    const drift: Drift[] = [];
    const pairs = [
      ["moraBeforeCents", view.moraBeforeCents, before.state.moraCents],
      ["installmentsPaidAfter", view.installmentsPaidAfter, after.state.installmentsPaid],
      ["balanceAfterCents", view.balanceAfterCents, after.state.balanceCents]
    ] as const;
    for (const [field, client, server] of pairs) {
      if (client !== server) drift.push({ field, client, server });
    }
    return drift;
  }

  /** Posts a cobro's live parts as Fineract repayments (one per part). */
  private async postParts(loan: LoanRecord, collect: Collect): Promise<void> {
    const collectedOn = businessDateOf(collect.collectedAt);
    const paymentTypeId = await this.fineract.ensurePaymentType(PAYMENT_TYPE_NAME[collect.method]);
    const parts = collect.parts.filter((p) => !loan.voided.includes(p.paymentId));

    // Mora parts are plain repayments now: Fineract owns the mora and
    // allocates every repayment oldest cuota first (its mora, interest,
    // principal). Only a Tradicional Plus penalty still needs a charge.
    const order = { mora: 0, penalty: 1, installment: 2 } as const;
    for (const part of [...parts].sort((a, b) => order[a.kind] - order[b.kind])) {
      const externalId = versionedExternalId(part.paymentId, loan.version);
      let chargeId: number | null = null;
      if (part.kind === "penalty") {
        if (loan.terms.type !== "tradicional_plus") {
          throw new Rejection("CONFLICT", "Penalty parts only apply to Tradicional Plus loans");
        }
        const fl = await this.fineract.getLoan(loan.fineractId);
        const firstUnpaid = fl.periods.find((p) => !p.complete);
        chargeId = await this.fineract.addLoanCharge(loan.fineractId, {
          chargeId: await this.fineract.ensurePenaltyCharge(PENALTY_CHARGE_NAME),
          amount: centsToPesos(part.amountCents),
          dueDate: firstUnpaid?.dueDate ?? collectedOn,
          externalId
        });
      }
      await this.fineract.repay(loan.fineractId, {
        transactionDate: collectedOn,
        amount: centsToPesos(part.amountCents),
        paymentTypeId,
        externalId
      });
      if (part.kind === "penalty") await this.movePendingCuotas(loan);
      await this.store.putPart(part.paymentId, {
        loanId: loan.loanId,
        kind: part.kind,
        collectedOn,
        amountCents: part.amountCents,
        externalId,
        chargeId
      });
    }
  }

  /**
   * Makes the loan's mora what Fineract would have charged had every cobro
   * reached it the day it was made (`simulateMora`, Fineract's own rules):
   * waives daily charges that shouldn't exist and adds a "Mora (ajuste)"
   * penalty for any that are missing. `pending` are repayments about to be
   * posted. If a wrong charge was already paid by an earlier repayment,
   * every repayment is undone first and re-posted after (Fineract refuses to
   * waive a paid charge), except the cobro being applied now (`current`).
   */
  private async repairMora(
    loan: LoanRecord,
    pending: { date: string; amount: number }[],
    current: Collect | null
  ): Promise<void> {
    const rate = moraRateBps(loan.terms);
    const until = await this.store.getLastClosed();
    if (rate === 0 || !until) return;
    const fl = await this.fineract.getLoan(loan.fineractId);
    const live = fl.transactions.filter((t) => t.type === "repayment" && !t.reversed);
    const expected = simulateMora({
      installments: fl.periods
        .filter((p) => cuotaOf(p) > 0)
        .map((p) => ({
          dueDate: p.dueDate,
          principal: pesosToCents(p.principalDue),
          interest: pesosToCents(p.interestDue)
        })),
      repayments: [
        ...live.map((t) => ({ date: t.date, amount: pesosToCents(t.amount) })),
        ...pending
      ],
      graceDays: this.policy.graceDays,
      percentPerDay: overdueCharge(rate).percentPerDay,
      until,
      stopOn: loan.chargedOffOn
    });

    const want = new Map<string, number>();
    const key = (date: string, cents: number) => `${date}|${cents}`;
    for (const e of expected)
      want.set(key(e.dueDate, e.amount), (want.get(key(e.dueDate, e.amount)) ?? 0) + 1);
    const surplus = fl.charges
      .filter((c) => isMoraCharge(c) && !c.waived)
      .sort((a, b) => compareDates(a.dueDate, b.dueDate) || a.id - b.id)
      .filter((c) => {
        const k = key(c.dueDate, pesosToCents(c.amount));
        const n = want.get(k) ?? 0;
        if (n === 0) return true;
        want.set(k, n - 1);
        return false;
      });
    const missing = [...want.entries()].flatMap(([k, n]) => {
      const [date, cents] = k.split("|");
      return Array.from({ length: n }, () => ({ date: date!, cents: Number(cents) }));
    });
    if (surplus.length === 0 && missing.length === 0) return;

    const replay = surplus.some((c) => c.amountPaid > 0);
    if (replay) {
      // One at a time: each undo re-creates the later repayments under new ids.
      for (const t of live) if (t.externalId) await this.undoByExternalId(loan, t.externalId);
    }
    for (const c of surplus) await this.fineract.waiveLoanCharge(loan.fineractId, c.id);
    if (missing.length > 0) {
      const chargeId = await this.fineract.ensurePenaltyCharge(MORA_ADJUSTMENT_CHARGE_NAME);
      for (const m of missing) {
        await this.fineract.addLoanCharge(loan.fineractId, {
          chargeId,
          amount: centsToPesos(m.cents),
          dueDate: m.date,
          externalId: `${MORA_ADJUSTMENT_PREFIX}${randomUUID()}`
        });
      }
    }
    if (replay) {
      loan.version += 1;
      for (const { collect } of loan.cobros) {
        if (collect !== current) await this.postParts(loan, collect);
      }
    }
  }

  /**
   * A daily loan that skips Sundays: Fineract has no per-loan working days,
   * and it refuses variable installments on flat-interest products. So
   * after disbursal the BFF reschedules from each cuota that lands on a
   * Sunday to the Monday; Fineract moves every later cuota with it (about
   * one reschedule per week of the loan).
   */
  private async skipSundays(fineractId: number, terms: Omit<LoanTerms, "customerId">) {
    if (terms.frequency !== "daily" || !terms.skipSundays) return;
    for (;;) {
      const fl = await this.fineract.getLoan(fineractId);
      const sunday = fl.periods.find((p) => cuotaOf(p) > 0 && weekday(p.dueDate) === 0);
      if (!sunday) return;
      await this.fineract.rescheduleLoan(fineractId, {
        rescheduleFromDate: sunday.dueDate,
        adjustedDueDate: addDays(sunday.dueDate, 1),
        submittedOnDate: terms.startDate
      });
    }
  }

  /** Undoes the live repayment with this external id, looked up fresh (see `PartRecord.externalId`). */
  private async undoByExternalId(loan: LoanRecord, externalId: string): Promise<void> {
    const fl = await this.fineract.getLoan(loan.fineractId);
    const tx = fl.transactions.find(
      (t) => t.type === "repayment" && !t.reversed && t.externalId === externalId
    );
    if (!tx) throw new Rejection("NOT_FOUND", `No live Fineract repayment ${externalId}`);
    await this.fineract.undoTransaction(loan.fineractId, tx.id);
  }

  /** Tradicional Plus: a penalty moves every unpaid cuota one cycle later. */
  private async movePendingCuotas(loan: LoanRecord) {
    const fl = await this.fineract.getLoan(loan.fineractId);
    const next = fl.periods.find((p) => cuotaPaid(p) < cuotaOf(p));
    if (!next) return;
    const { repaymentEvery, repaymentFrequencyType } = repaymentPeriod(loan.terms.frequency);
    await this.fineract.rescheduleLoan(loan.fineractId, {
      rescheduleFromDate: next.dueDate,
      adjustedDueDate: dueDateFor(next.dueDate, repaymentEvery, repaymentFrequencyType, 1),
      submittedOnDate: next.dueDate
    });
  }

  private async voidPayment(loanId: string, paymentId: string): Promise<Drift[]> {
    const loan = await this.loanRecord(loanId);
    const part = await this.store.getPart(paymentId);
    if (!part || part.loanId !== loanId)
      throw new Rejection("NOT_FOUND", `Unknown payment ${paymentId}`);
    if (part.kind === "penalty") {
      // The penalty moved every unpaid cuota, and Fineract refuses to
      // reschedule back to an earlier date: rebuild the loan without it.
      loan.voided.push(paymentId);
      await this.store.deletePart(paymentId);
      await this.replayLoan(loan, loan.terms);
      await this.store.putLoan(loan);
      return [];
    }
    await this.undoByExternalId(loan, part.externalId);
    loan.voided.push(paymentId);
    await this.store.deletePart(paymentId);
    await this.store.putLoan(loan);
    // Without this cobro, some days are late again: add the mora Fineract's
    // job won't re-create for days it already counted.
    await this.repairMora(loan, [], null);
    // The repair may have replayed the loan (a new external-id version).
    await this.store.putLoan(loan);
    return [];
  }

  // ── Mora waivers ────────────────────────────────────────────────────────

  /**
   * Waives whole daily mora charges, oldest first, without going over the
   * amount asked (Fineract can't waive part of a charge). Reports drift when
   * what was waived falls short of the request.
   */
  private async waiveMora(
    id: string,
    waive: z.infer<typeof moraWaive>,
    waivedOn: string
  ): Promise<Drift[]> {
    const loan = await this.loanRecord(waive.loanId);
    const fl = await this.fineract.getLoan(loan.fineractId);
    const open = fl.charges
      .filter((c) => isMoraCharge(c) && !c.waived && c.amountOutstanding > 0)
      .sort((a, b) => compareDates(a.dueDate, b.dueDate) || a.id - b.id);
    let waivedCents = 0;
    for (const c of open) {
      const amount = pesosToCents(c.amountOutstanding);
      if (waivedCents + amount > waive.amountCents) break;
      await this.fineract.waiveLoanCharge(loan.fineractId, c.id);
      waivedCents += amount;
    }
    await this.store.putWaiver(id, { ...waive, waivedCents, deviceId: this.deviceId, waivedOn });
    return waivedCents === waive.amountCents
      ? []
      : [{ field: "waivedCents", client: waive.amountCents, server: waivedCents }];
  }

  // ── Cash close ──────────────────────────────────────────────────────────

  private async closeCash(id: string, close: z.infer<typeof cashCloseCreate>): Promise<Drift[]> {
    let serverTotal = 0;
    for (const paymentId of close.paymentIds) {
      const part = await this.store.getPart(paymentId);
      if (!part) throw new Rejection("NOT_FOUND", `Cash close counts unknown payment ${paymentId}`);
      serverTotal += part.amountCents;
    }
    await this.store.putCashClose(id, close);
    return serverTotal === close.amountCents
      ? []
      : [{ field: "amountCents", client: close.amountCents, server: serverTotal }];
  }

  // ── Reads ───────────────────────────────────────────────────────────────

  /** GET /v1/loans/{id}/state?asOf=YYYY-MM-DD */
  async getLoanState(loanId: string, asOf: string): Promise<LoanStateV1> {
    return (await this.loanState(await this.loanRecord(loanId), asOf)).state;
  }

  private async loanState(
    loan: LoanRecord,
    asOf: string
  ): Promise<{ loanId: string; state: LoanStateV1 }> {
    const { loanId } = loan;
    const fl = await this.fineract.getLoan(loan.fineractId);
    // Periods past the last cuota only carry mora charged after maturity.
    const schedule = fl.periods
      .filter((p) => cuotaOf(p) > 0)
      .map((p) => {
        const amountCents = cuotaOf(p);
        const paidCents = cuotaPaid(p);
        const status: "paid" | "overdue" | "upcoming" =
          paidCents >= amountCents
            ? "paid"
            : compareDates(p.dueDate, asOf) < 0
              ? "overdue"
              : "upcoming";
        return { number: p.period, dueDate: p.dueDate, amountCents, paidCents, status };
      });
    const totalRepayCents = schedule.reduce((s, i) => s + i.amountCents, 0);
    const paidCents = schedule.reduce((s, i) => s + i.paidCents, 0);
    const oldestOverdue = schedule.find((i) => i.status === "overdue") ?? null;
    const nextUnpaid = schedule.find((i) => i.status !== "paid") ?? null;
    const moraCents = fl.charges
      .filter((c) => isMoraCharge(c) && !c.waived)
      .reduce((s, c) => s + pesosToCents(c.amountOutstanding), 0);
    return {
      loanId,
      state: {
        loanId,
        status: loan.archived ? "archived" : nextUnpaid || moraCents > 0 ? "active" : "paid",
        asOf,
        chargedOff: fl.chargedOff,
        principalCents: loan.terms.principalCents,
        totalRepayCents,
        paidCents,
        balanceCents: totalRepayCents - paidCents,
        installmentsPaid: schedule.filter((i) => i.status === "paid").length,
        nextDueDate: nextUnpaid?.dueDate ?? null,
        moraCents,
        moraDays: oldestOverdue ? daysBetween(oldestOverdue.dueDate, asOf) : 0,
        schedule
      }
    };
  }
}

/** Day after `date` — exported for scenario tests that walk the calendar. */
export const nextDay = (date: string) => addDays(date, 1);
