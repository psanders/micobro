/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * The back office's own state, for one lending business (tenant). Fineract
 * holds the loans and money; this holds what Fineract has no home for (the
 * app-id ↔ Fineract-id mappings, the cobro journal a replay re-applies,
 * visits, cash closes, mora waivers) and what makes sync idempotent (the
 * result of every mutation already applied).
 *
 * Two implementations: `MemoryStore` (tests, the fake back office) and
 * `PostgresStore` (the server). Every method is async and the store is
 * already scoped to one tenant, so callers can't read across businesses.
 */
import type { z } from "zod/v4";
import type {
  cashCloseCreate,
  loanTerms,
  moraWaive,
  MutationResult,
  paymentCollect,
  visitLog
} from "@micobro/contract";

export type LoanTerms = z.infer<typeof loanTerms>;
export type Collect = z.infer<typeof paymentCollect>;

export interface LoanRecord {
  loanId: string;
  fineractId: number;
  terms: LoanTerms;
  archived: boolean;
  /** How many times the loan was replayed (external-id version). */
  version: number;
  /** Cobros in arrival order — the journal a replay re-applies. */
  cobros: { cobroId: string; collect: Collect }[];
  /** Voided payment row ids. */
  voided: string[];
  /** When the nightly close charged the loan off (mora stopped). */
  chargedOffOn: string | null;
}

export interface PartRecord {
  loanId: string;
  kind: "installment" | "mora" | "penalty";
  collectedOn: string;
  amountCents: number;
  /**
   * The Fineract external id of its repayment. Not the transaction id:
   * Fineract re-creates every later repayment under a new id whenever one is
   * undone or a backdated one is posted.
   */
  externalId: string;
  chargeId: number | null;
}

export type Visit = z.infer<typeof visitLog>;
export type CashClose = z.infer<typeof cashCloseCreate>;
/** Mora forgiven by a collector: what was asked, what Fineract waived, and why. */
export type Waiver = z.infer<typeof moraWaive> & {
  waivedCents: number;
  deviceId: string;
  waivedOn: string;
};

export interface BackofficeStore {
  getResult(mutationId: string): Promise<MutationResult | null>;
  putResult(result: MutationResult): Promise<void>;

  /** App customer id → Fineract client id. */
  getCustomer(appId: string): Promise<number | null>;
  putCustomer(appId: string, clientId: number): Promise<void>;

  getLoan(appId: string): Promise<LoanRecord | null>;
  putLoan(loan: LoanRecord): Promise<void>;
  listLoans(): Promise<LoanRecord[]>;

  getPart(paymentId: string): Promise<PartRecord | null>;
  putPart(paymentId: string, part: PartRecord): Promise<void>;
  deletePart(paymentId: string): Promise<void>;
  deletePartsOfLoan(loanId: string): Promise<void>;

  putVisit(id: string, visit: Visit): Promise<void>;
  listVisits(): Promise<Visit[]>;
  putCashClose(id: string, close: CashClose): Promise<void>;
  listCashCloses(): Promise<CashClose[]>;
  putWaiver(id: string, waiver: Waiver): Promise<void>;
  listWaivers(): Promise<Waiver[]>;

  /** The last business date the nightly close ran for. */
  getLastClosed(): Promise<string | null>;
  setLastClosed(date: string): Promise<void>;
}

const clone = <T>(value: T): T => structuredClone(value);

/** In memory. Its maps are public so tests can look inside. */
export class MemoryStore implements BackofficeStore {
  readonly results = new Map<string, MutationResult>();
  readonly customers = new Map<string, number>();
  readonly loans = new Map<string, LoanRecord>();
  readonly parts = new Map<string, PartRecord>();
  readonly visits = new Map<string, Visit>();
  readonly cashCloses = new Map<string, CashClose>();
  readonly waivers = new Map<string, Waiver>();
  lastClosed: string | null = null;

  async getResult(mutationId: string) {
    return this.results.get(mutationId) ?? null;
  }
  async putResult(result: MutationResult) {
    this.results.set(result.mutationId, clone(result));
  }
  async getCustomer(appId: string) {
    return this.customers.get(appId) ?? null;
  }
  async putCustomer(appId: string, clientId: number) {
    this.customers.set(appId, clientId);
  }
  // Records are copied in and out, so callers must `putLoan` to persist a
  // change — the same contract the Postgres store has.
  async getLoan(appId: string) {
    const loan = this.loans.get(appId);
    return loan ? clone(loan) : null;
  }
  async putLoan(loan: LoanRecord) {
    this.loans.set(loan.loanId, clone(loan));
  }
  async listLoans() {
    return [...this.loans.values()].map(clone);
  }
  async getPart(paymentId: string) {
    const part = this.parts.get(paymentId);
    return part ? clone(part) : null;
  }
  async putPart(paymentId: string, part: PartRecord) {
    this.parts.set(paymentId, clone(part));
  }
  async deletePart(paymentId: string) {
    this.parts.delete(paymentId);
  }
  async deletePartsOfLoan(loanId: string) {
    for (const [id, part] of this.parts) if (part.loanId === loanId) this.parts.delete(id);
  }
  async putVisit(id: string, visit: Visit) {
    this.visits.set(id, clone(visit));
  }
  async listVisits() {
    return [...this.visits.values()].map(clone);
  }
  async putCashClose(id: string, close: CashClose) {
    this.cashCloses.set(id, clone(close));
  }
  async listCashCloses() {
    return [...this.cashCloses.values()].map(clone);
  }
  async putWaiver(id: string, waiver: Waiver) {
    this.waivers.set(id, clone(waiver));
  }
  async listWaivers() {
    return [...this.waivers.values()].map(clone);
  }
  async getLastClosed() {
    return this.lastClosed;
  }
  async setLastClosed(date: string) {
    this.lastClosed = date;
  }
}
