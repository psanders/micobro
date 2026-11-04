/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * In-memory stand-in for Apache Fineract, modeling only the behaviors the
 * back office depends on. Every one of them is checked against a real
 * server by the calibration probes (`calibration.ts`, `observed.json`).
 *
 *  - Flat whole-term schedules, with a centavo currency and cuotas in
 *    multiples of 1 peso: each cuota's principal is first rounded to a whole
 *    peso, interest to the centavo, the sum to a whole peso (principal
 *    absorbs that last step), and the final cuota takes both remainders.
 *    Rounding is HALF_EVEN (tenant `rounding-mode` 6).
 *  - Mora as Fineract does it: the "Apply penalty to overdue loans" job
 *    adds one penalty charge per late cuota per day, `percentPerDay` of
 *    what is still owed on that cuota, from its due date on. The tenant's
 *    `penalty-wait-period` days are never charged. Charge-off stops it.
 *  - A charge belongs to the installment whose period contains its date;
 *    charges past the last cuota open an extra period.
 *  - Allocation by replay with "mifos-standard-strategy": installment by
 *    installment, oldest first, each one penalties → interest → principal.
 *    Every undo re-allocates every later transaction.
 *  - Lifecycle rules: terms change only while "submitted"; undoing a
 *    disbursal reverses every repayment; external ids are unique; mobile
 *    numbers are unique per tenant; no transaction after the business date.
 *
 * Money is integer cents inside, decimal pesos at the port boundary.
 */
import { compareDates } from "../dates";
import {
  allocate,
  dueDateFor,
  flatSchedule,
  overdueJob,
  periodIndexFor,
  type Charge,
  type Installment,
  type Repayment
} from "./model";
import {
  FineractDomainError,
  type CreateClientRequest,
  type CreateLoanRequest,
  type FineractLoan,
  type FineractLoanStatus,
  type FineractPort,
  type FineractTransaction,
  type LoanCharge,
  type LoanProductSpec,
  type SchedulePeriod
} from "./port";

export interface FakeFineractOptions {
  uniqueMobileNo?: boolean;
}

interface Client {
  id: number;
  externalId: string;
  fullname: string;
  mobileNo: string;
  activationDate: string;
}

/** A model charge plus the external id Fineract stores on manually added charges. */
type LoanChargeRow = Charge & { externalId: string | null };

type Terms = Omit<CreateLoanRequest, "externalId" | "clientId">;

interface Loan {
  id: number;
  externalId: string;
  clientId: number;
  terms: Terms;
  status: "submitted" | "approved" | "active";
  disbursedOn: string | null;
  chargedOffOn: string | null;
  installments: Installment[];
  charges: LoanChargeRow[];
  repayments: (Repayment & { externalId: string })[];
}

const toCents = (pesos: number) => Math.round(pesos * 100);
const toPesos = (cents: number) => cents / 100;

export class FakeFineract implements FineractPort {
  private seq = 1;
  private readonly products = new Map<string, { id: number; spec: LoanProductSpec }>();
  private readonly namedIds = new Map<string, number>();
  private readonly overduePercent = new Map<number, number>();
  private readonly clients = new Map<number, Client>();
  private readonly loans = new Map<number, Loan>();
  private readonly uniqueMobileNo: boolean;
  /** Fineract's BUSINESS_DATE; null = unchecked. */
  businessDate: string | null = null;
  /** Tenant `penalty-wait-period`. 2 is a fresh Fineract tenant's default. */
  penaltyGraceDays = 2;
  /** Every call, in order — lets tests assert what the BFF asked Fineract to do. */
  readonly calls: string[] = [];

  constructor(options: FakeFineractOptions = {}) {
    this.uniqueMobileNo = options.uniqueMobileNo ?? true;
  }

  private nextId(): number {
    return this.seq++;
  }

  // ── Tenant and catalog ──────────────────────────────────────────────────

  async setBusinessDate(date: string): Promise<void> {
    this.businessDate = date;
  }

  async setPenaltyGraceDays(days: number): Promise<void> {
    this.penaltyGraceDays = days;
  }

  async ensureLoanProduct(spec: LoanProductSpec): Promise<number> {
    const existing = this.products.get(spec.shortName);
    if (existing) return existing.id;
    const id = this.nextId();
    this.products.set(spec.shortName, { id, spec });
    this.calls.push(`ensureLoanProduct ${spec.shortName}`);
    return id;
  }

  private productById(id: number): LoanProductSpec | null {
    for (const p of this.products.values()) if (p.id === id) return p.spec;
    return null;
  }

  private ensureNamed(kind: string, name: string): number {
    const key = `${kind}:${name}`;
    const existing = this.namedIds.get(key);
    if (existing) return existing;
    const id = this.nextId();
    this.namedIds.set(key, id);
    return id;
  }

  async ensurePenaltyCharge(name: string): Promise<number> {
    return this.ensureNamed("charge", name);
  }

  async ensureOverdueCharge(name: string, percentPerDay: number): Promise<number> {
    const id = this.ensureNamed("overdue", name);
    this.overduePercent.set(id, percentPerDay);
    return id;
  }

  async ensurePaymentType(name: string): Promise<number> {
    return this.ensureNamed("paymentType", name);
  }

  // ── Clients ─────────────────────────────────────────────────────────────

  async findClientIdByExternalId(externalId: string): Promise<number | null> {
    for (const c of this.clients.values()) if (c.externalId === externalId) return c.id;
    return null;
  }

  async createClient(req: CreateClientRequest): Promise<number> {
    this.calls.push(`createClient ${req.externalId}`);
    if (await this.findClientIdByExternalId(req.externalId)) {
      throw new FineractDomainError(
        "External id already exists",
        "error.msg.client.duplicate.externalId"
      );
    }
    this.assertMobileNoFree(req.mobileNo, null);
    const id = this.nextId();
    this.clients.set(id, {
      id,
      externalId: req.externalId,
      fullname: req.fullname,
      mobileNo: req.mobileNo,
      activationDate: req.activationDate
    });
    return id;
  }

  async updateClient(
    clientId: number,
    change: { fullname: string; mobileNo: string }
  ): Promise<void> {
    this.calls.push(`updateClient ${clientId}`);
    const client = this.clients.get(clientId);
    if (!client) throw new FineractDomainError("Client not found", "error.msg.client.id.invalid");
    this.assertMobileNoFree(change.mobileNo, clientId);
    client.fullname = change.fullname;
    client.mobileNo = change.mobileNo;
  }

  async activateClientBy(clientId: number, date: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) throw new FineractDomainError("Client not found", "error.msg.client.id.invalid");
    if (client.activationDate <= date) return;
    this.calls.push(`activateClientBy ${clientId} ${date}`);
    client.activationDate = date;
  }

  private assertSubmittableFor(clientId: number, submittedOnDate: string) {
    if (submittedOnDate < this.clients.get(clientId)!.activationDate) {
      throw new FineractDomainError(
        "The date on which a loan is submitted cannot be earlier than client's activation date.",
        "error.msg.loan.submittal.cannot.be.before.client.activation.date"
      );
    }
  }

  private assertMobileNoFree(mobileNo: string, selfId: number | null) {
    if (!this.uniqueMobileNo || !mobileNo) return;
    for (const c of this.clients.values()) {
      if (c.mobileNo === mobileNo && c.id !== selfId) {
        throw new FineractDomainError(
          `Client with mobileNo ${mobileNo} already exists`,
          "error.msg.client.duplicate.mobileNo"
        );
      }
    }
  }

  // ── Loan lifecycle ──────────────────────────────────────────────────────

  async findLoanIdByExternalId(externalId: string): Promise<number | null> {
    for (const l of this.loans.values()) if (l.externalId === externalId) return l.id;
    return null;
  }

  async createLoan(req: CreateLoanRequest): Promise<number> {
    this.calls.push(`createLoan ${req.externalId}`);
    if (!this.clients.has(req.clientId)) {
      throw new FineractDomainError("Client not found", "error.msg.client.id.invalid");
    }
    if (await this.findLoanIdByExternalId(req.externalId)) {
      throw new FineractDomainError(
        "External id already exists",
        "error.msg.loan.duplicate.externalId"
      );
    }
    this.assertSubmittableFor(req.clientId, req.submittedOnDate);
    const { externalId, clientId, ...terms } = req;
    const id = this.nextId();
    this.loans.set(id, {
      id,
      externalId,
      clientId,
      terms,
      status: "submitted",
      disbursedOn: null,
      chargedOffOn: null,
      installments: [],
      charges: [],
      repayments: []
    });
    return id;
  }

  private loan(loanId: number): Loan {
    const loan = this.loans.get(loanId);
    if (!loan) throw new FineractDomainError("Loan not found", "error.msg.loan.id.invalid");
    return loan;
  }

  async modifyLoan(loanId: number, terms: Terms): Promise<void> {
    this.calls.push(`modifyLoan ${loanId}`);
    const loan = this.loan(loanId);
    if (loan.status !== "submitted") {
      throw new FineractDomainError(
        "Loan application can only be modified while submitted and pending approval",
        "error.msg.loan.application.cannot.be.modified"
      );
    }
    this.assertSubmittableFor(loan.clientId, terms.submittedOnDate);
    loan.terms = terms;
  }

  async approveLoan(loanId: number): Promise<void> {
    this.calls.push(`approveLoan ${loanId}`);
    const loan = this.loan(loanId);
    if (loan.status !== "submitted")
      throw new FineractDomainError("Not submitted", "error.msg.loan.approve.state");
    loan.status = "approved";
  }

  async undoApproval(loanId: number): Promise<void> {
    this.calls.push(`undoApproval ${loanId}`);
    const loan = this.loan(loanId);
    if (loan.status !== "approved")
      throw new FineractDomainError("Not approved", "error.msg.loan.undoapproval.state");
    loan.status = "submitted";
  }

  async disburseLoan(loanId: number, date: string, amount: number): Promise<void> {
    this.calls.push(`disburseLoan ${loanId}`);
    const loan = this.loan(loanId);
    if (loan.status !== "approved")
      throw new FineractDomainError("Not approved", "error.msg.loan.disburse.state");
    if (amount !== loan.terms.principal) {
      throw new FineractDomainError("Tranche disbursals are not modeled", "fake.unsupported");
    }
    loan.status = "active";
    loan.disbursedOn = date;
    loan.installments = flatSchedule({
      principalCents: toCents(loan.terms.principal),
      interestRatePct: loan.terms.interestRatePerPeriod,
      n: loan.terms.numberOfRepayments,
      repaymentEvery: loan.terms.repaymentEvery,
      repaymentFrequencyType: loan.terms.repaymentFrequencyType,
      disbursedOn: date
    });
  }

  async undoDisbursal(loanId: number): Promise<void> {
    this.calls.push(`undoDisbursal ${loanId}`);
    const loan = this.loan(loanId);
    if (loan.status !== "active")
      throw new FineractDomainError("Not active", "error.msg.loan.undodisbursal.state");
    // Real Fineract reverses every repayment along with the disbursal.
    for (const r of loan.repayments) r.reversed = true;
    loan.status = "approved";
    loan.disbursedOn = null;
    loan.chargedOffOn = null;
    loan.installments = [];
    loan.charges = [];
  }

  async chargeOff(loanId: number, date: string): Promise<void> {
    this.calls.push(`chargeOff ${loanId} ${date}`);
    const loan = this.loan(loanId);
    if (loan.status !== "active" || loan.chargedOffOn) {
      throw new FineractDomainError("Loan cannot be charged off", "error.msg.loan.chargeoff.state");
    }
    loan.chargedOffOn = date;
  }

  async rescheduleLoan(
    loanId: number,
    req: { rescheduleFromDate: string; adjustedDueDate: string; submittedOnDate: string }
  ): Promise<void> {
    this.calls.push(`rescheduleLoan ${loanId} ${req.rescheduleFromDate}→${req.adjustedDueDate}`);
    const loan = this.loan(loanId);
    const from = loan.installments.findIndex((i) => i.dueDate === req.rescheduleFromDate);
    if (from < 0) {
      throw new FineractDomainError(
        "Reschedule from date must be an installment due date",
        "error.msg.loan.reschedule.from.date.not.installment"
      );
    }
    const { repaymentEvery, repaymentFrequencyType } = loan.terms;
    for (let i = from; i < loan.installments.length; i++) {
      loan.installments[i]!.dueDate = dueDateFor(
        req.adjustedDueDate,
        repaymentEvery,
        repaymentFrequencyType,
        i - from
      );
    }
  }

  // ── Charges and transactions ────────────────────────────────────────────

  async addLoanCharge(
    loanId: number,
    req: { chargeId: number; amount: number; dueDate: string; externalId: string }
  ): Promise<number> {
    this.calls.push(`addLoanCharge ${loanId} ${req.amount}@${req.dueDate}`);
    const loan = this.loan(loanId);
    if (loan.status !== "active")
      throw new FineractDomainError("Not active", "error.msg.loan.charge.state");
    if (this.overduePercent.has(req.chargeId)) {
      throw new FineractDomainError(
        "Installment charge cannot be added to the loan.",
        "error.msg.loanCharge.cannot.be.added.as.overdue.charge"
      );
    }
    if (loan.charges.some((c) => c.externalId === req.externalId)) {
      throw new FineractDomainError(
        "External id already exists",
        "error.msg.loancharge.duplicate.externalId"
      );
    }
    if (loan.disbursedOn && compareDates(req.dueDate, loan.disbursedOn) < 0) {
      throw new FineractDomainError(
        "Charge due date before disbursement",
        "error.msg.loan.charge.due.date.before.disbursement"
      );
    }
    const id = this.nextId();
    loan.charges.push({
      id,
      externalId: req.externalId,
      amount: toCents(req.amount),
      dueDate: req.dueDate,
      waived: false,
      origin: null
    });
    return id;
  }

  async waiveLoanCharge(loanId: number, loanChargeId: number): Promise<void> {
    this.calls.push(`waiveLoanCharge ${loanId} ${loanChargeId}`);
    const charge = this.loan(loanId).charges.find((c) => c.id === loanChargeId);
    if (!charge || charge.waived)
      throw new FineractDomainError("Charge not found", "error.msg.loancharge.id.invalid");
    const loan = this.loan(loanId);
    const { chargeOutstanding } = allocate(loan.installments, loan.charges, loan.repayments);
    if ((chargeOutstanding.get(charge.id) ?? charge.amount) === 0) {
      throw new FineractDomainError(
        "This loan charge has been completely paid",
        "error.msg.loan.charge.already.paid"
      );
    }
    charge.waived = true;
  }

  async findLoanChargeIdByExternalId(loanId: number, externalId: string): Promise<number | null> {
    return this.loan(loanId).charges.find((c) => c.externalId === externalId)?.id ?? null;
  }

  async repay(
    loanId: number,
    req: { transactionDate: string; amount: number; paymentTypeId: number; externalId: string }
  ): Promise<number> {
    this.calls.push(`repay ${loanId} ${req.amount}@${req.transactionDate}`);
    const loan = this.loan(loanId);
    if (loan.status !== "active")
      throw new FineractDomainError("Loan is not active", "error.msg.loan.repayment.state");
    if (loan.repayments.some((r) => r.externalId === req.externalId)) {
      throw new FineractDomainError(
        "External id already exists",
        "error.msg.loantransaction.duplicate.externalId"
      );
    }
    if (this.businessDate && compareDates(req.transactionDate, this.businessDate) > 0) {
      throw new FineractDomainError(
        "The transaction date cannot be in the future",
        "error.msg.loan.transaction.cannot.be.a.future.date"
      );
    }
    if (loan.disbursedOn && compareDates(req.transactionDate, loan.disbursedOn) < 0) {
      throw new FineractDomainError(
        "Transaction before disbursement",
        "error.msg.loan.transaction.before.disbursement"
      );
    }
    const id = this.nextId();
    const backdated = loan.repayments.some(
      (r) => !r.reversed && compareDates(r.date, req.transactionDate) > 0
    );
    loan.repayments.push({
      id,
      externalId: req.externalId,
      date: req.transactionDate,
      amount: toCents(req.amount),
      reversed: false
    });
    if (backdated) this.reprocessAfter(loan, req.transactionDate, id);
    return id;
  }

  async undoTransaction(loanId: number, transactionId: number): Promise<void> {
    this.calls.push(`undoTransaction ${loanId} ${transactionId}`);
    const tx = this.loan(loanId).repayments.find((r) => r.id === transactionId);
    if (!tx || tx.reversed)
      throw new FineractDomainError(
        "Transaction not found",
        "error.msg.loantransaction.id.invalid"
      );
    tx.reversed = true;
    this.reprocessAfter(this.loan(loanId), tx.date, tx.id);
  }

  /**
   * Fineract's reverse-replay: every live repayment after (date, id) is
   * reversed and re-created under a new id, keeping its external id.
   */
  private reprocessAfter(loan: Loan, date: string, id: number) {
    const later = loan.repayments
      .filter(
        (r) => !r.reversed && (compareDates(r.date, date) > 0 || (r.date === date && r.id > id))
      )
      .sort((a, b) => compareDates(a.date, b.date) || a.id - b.id);
    for (const r of later) r.id = this.nextId();
  }

  /**
   * The overdue-installment job as of the business date: for every late cuota
   * of every active, not charged-off loan whose product charges mora, add the
   * daily charges it is missing — one per late day after the grace, each
   * `percentPerDay` of what is still owed on that cuota right now.
   */
  async runOverdueJob(): Promise<void> {
    const today = this.businessDate;
    if (!today) throw new Error("FakeFineract: set a business date before running the overdue job");
    this.calls.push(`runOverdueJob ${today}`);
    for (const loan of this.loans.values()) {
      if (loan.status !== "active" || loan.chargedOffOn) continue;
      const chargeId = this.productById(loan.terms.productId)?.overdueChargeId ?? null;
      const percent = chargeId === null ? undefined : this.overduePercent.get(chargeId);
      if (percent === undefined) continue;
      loan.charges.push(
        ...overdueJob({
          installments: loan.installments,
          charges: loan.charges,
          repayments: loan.repayments,
          today,
          graceDays: this.penaltyGraceDays,
          percentPerDay: percent,
          nextId: () => this.nextId()
        }).map((c) => ({ ...c, externalId: null }))
      );
    }
  }

  // ── Reads ───────────────────────────────────────────────────────────────

  async getLoan(loanId: number): Promise<FineractLoan> {
    const loan = this.loan(loanId);
    const { penaltyDue, paid, portions, overpaid, chargeOutstanding, ordered } = allocate(
      loan.installments,
      loan.charges,
      loan.repayments
    );
    // Fineract keeps waived charges in a period's penalty total and reports them as waived.
    const waived = new Array<number>(loan.installments.length + 1).fill(0);
    for (const c of loan.charges) {
      if (c.waived) waived[periodIndexFor(loan.installments, c.dueDate)]! += c.amount;
    }

    const periods: SchedulePeriod[] = loan.installments.map((inst, i) => {
      const p = paid[i]!;
      const penalties = penaltyDue[i]! + waived[i]!;
      const totalDue = inst.principal + inst.interest + penalties;
      const totalPaid = p.principal + p.interest + p.penalty;
      return {
        period: i + 1,
        dueDate: inst.dueDate,
        principalDue: toPesos(inst.principal),
        interestDue: toPesos(inst.interest),
        penaltyChargesDue: toPesos(penalties),
        penaltyChargesWaived: toPesos(waived[i]!),
        principalPaid: toPesos(p.principal),
        interestPaid: toPesos(p.interest),
        totalDue: toPesos(totalDue),
        totalPaid: toPesos(totalPaid),
        complete: totalPaid + waived[i]! >= totalDue
      };
    });
    const extra = loan.installments.length;
    const extraPenalties = penaltyDue[extra]! + waived[extra]!;
    if (extraPenalties > 0) {
      const lastDate = loan.charges
        .filter((c) => periodIndexFor(loan.installments, c.dueDate) === extra)
        .reduce(
          (d, c) => (compareDates(c.dueDate, d) > 0 ? c.dueDate : d),
          loan.installments[extra - 1]!.dueDate
        );
      periods.push({
        period: extra + 1,
        dueDate: lastDate,
        principalDue: 0,
        interestDue: 0,
        penaltyChargesDue: toPesos(extraPenalties),
        penaltyChargesWaived: toPesos(waived[extra]!),
        principalPaid: 0,
        interestPaid: 0,
        totalDue: toPesos(extraPenalties),
        totalPaid: toPesos(paid[extra]!.penalty),
        complete: paid[extra]!.penalty + waived[extra]! >= extraPenalties
      });
    }

    const transactions: FineractTransaction[] = [];
    if (loan.disbursedOn) {
      transactions.push({
        id: 0,
        externalId: null,
        type: "disbursement",
        date: loan.disbursedOn,
        amount: loan.terms.principal,
        principalPortion: loan.terms.principal,
        interestPortion: 0,
        penaltyChargesPortion: 0,
        reversed: false
      });
    }
    for (const r of ordered) {
      const portion = portions.get(r.id)!;
      transactions.push({
        id: r.id,
        externalId: loan.repayments.find((x) => x.id === r.id)!.externalId,
        type: "repayment",
        date: r.date,
        amount: toPesos(r.amount),
        principalPortion: toPesos(portion.principal),
        interestPortion: toPesos(portion.interest),
        penaltyChargesPortion: toPesos(portion.penalty),
        reversed: r.reversed
      });
    }

    const charges: LoanCharge[] = loan.charges.map((c) => ({
      id: c.id,
      externalId: c.externalId,
      dueDate: c.dueDate,
      amount: toPesos(c.amount),
      amountPaid: c.waived ? 0 : toPesos(c.amount - (chargeOutstanding.get(c.id) ?? 0)),
      amountOutstanding: c.waived ? 0 : toPesos(chargeOutstanding.get(c.id) ?? 0),
      penalty: true,
      overdue: c.origin !== null,
      waived: c.waived
    }));

    const expected = periods.reduce((s, p) => s + toCents(p.totalDue), 0);
    const outstanding = periods.reduce(
      (s, p) => s + toCents(p.totalDue) - toCents(p.totalPaid) - toCents(p.penaltyChargesWaived),
      0
    );
    const repaid = ordered.filter((r) => !r.reversed).reduce((s, r) => s + r.amount, 0);
    let status: FineractLoanStatus = loan.status;
    if (loan.status === "active" && outstanding === 0) {
      status = overpaid > 0 ? "overpaid" : "closed_obligations_met";
    }
    return {
      id: loan.id,
      externalId: loan.externalId,
      status,
      principal: loan.terms.principal,
      totalExpectedRepayment: toPesos(expected),
      totalRepayment: toPesos(repaid),
      totalOutstanding: toPesos(outstanding),
      chargedOff: loan.chargedOffOn !== null,
      periods,
      transactions,
      charges
    };
  }
}
