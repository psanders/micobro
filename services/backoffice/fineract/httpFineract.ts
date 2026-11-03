/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * `FineractPort` over a real Fineract server's REST API, with plain `fetch`.
 * Used only by the live suite against `backoffice/fineract/compose.yaml`.
 * Phase 1 quality: enough to calibrate FakeFineract, not production code
 * (no retries, no connection pooling, basic auth with the demo user).
 */
import {
  FineractDomainError,
  type CreateClientRequest,
  type CreateLoanRequest,
  type FineractLoan,
  type FineractLoanStatus,
  type FineractPort,
  type LoanCharge,
  type LoanProductSpec
} from "./port";

export interface HttpFineractOptions {
  baseUrl: string;
  tenantId: string;
  username: string;
  password: string;
}

const FORMAT = { locale: "en", dateFormat: "yyyy-MM-dd" };

type Json = Record<string, unknown>;
type DateArray = [number, number, number];

function isoOf(date: DateArray | string): string {
  if (typeof date === "string") return date;
  const [y, m, d] = date;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export class HttpFineract implements FineractPort {
  private readonly auth: string;
  private rescheduleReasonId: number | null = null;

  constructor(private readonly options: HttpFineractOptions) {
    this.auth = `Basic ${Buffer.from(`${options.username}:${options.password}`).toString("base64")}`;
  }

  async request<T = Json>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.options.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: this.auth,
        "Fineract-Platform-TenantId": this.options.tenantId,
        "Content-Type": "application/json"
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    const json = text ? (JSON.parse(text) as Json) : {};
    if (response.status === 404)
      throw new FineractDomainError(`${method} ${path}: not found`, "http.404");
    if (!response.ok) {
      const errors = (json.errors as Json[] | undefined) ?? [];
      const code = String(
        errors[0]?.userMessageGlobalisationCode ??
          json.userMessageGlobalisationCode ??
          `http.${response.status}`
      );
      const detail =
        errors
          .map((e) => `${String(e.parameterName ?? "")} ${String(e.defaultUserMessage)}`)
          .join("; ") || String(json.defaultUserMessage ?? json.developerMessage ?? text);
      const message = `${method} ${path}: ${detail}`;
      if (response.status >= 500) throw new Error(`Fineract ${response.status}: ${message}`);
      throw new FineractDomainError(message, code);
    }
    return json as T;
  }

  private async maybe<T>(promise: Promise<T>): Promise<T | null> {
    try {
      return await promise;
    } catch (error) {
      if (error instanceof FineractDomainError && error.code === "http.404") return null;
      throw error;
    }
  }

  // ── Setup (tenant configuration the BFF needs) ───────────────────────────

  prepareTenant(): Promise<void> {
    return this.configureTenant();
  }

  /** Enables DOP, business dates, and the reschedule reason code. Idempotent. */
  async configureTenant(): Promise<void> {
    const currencies = await this.request<{ selectedCurrencyOptions: { code: string }[] }>(
      "GET",
      "/currencies"
    );
    const codes = currencies.selectedCurrencyOptions.map((c) => c.code);
    if (!codes.includes("DOP"))
      await this.request("PUT", "/currencies", { currencies: [...codes, "DOP"] });

    const config = await this.request<{
      globalConfiguration: { id: number; name: string; enabled: boolean }[];
    }>("GET", "/configurations");
    const businessDate = config.globalConfiguration.find((c) => c.name === "enable-business-date");
    if (businessDate && !businessDate.enabled) {
      await this.request("PUT", `/configurations/${businessDate.id}`, { enabled: true });
    }
    await this.ensureRescheduleReason();
  }

  /** Build info from `/actuator/info` (git commit and time), recorded with each observation. */
  async serverBuild(): Promise<string> {
    const root = this.options.baseUrl.replace(/\/api\/v1$/, "");
    const info = (await (await fetch(`${root}/actuator/info`)).json()) as {
      git?: { commit?: { id?: { abbrev?: string }; time?: string } };
    };
    return `git ${info.git?.commit?.id?.abbrev ?? "?"} (${info.git?.commit?.time ?? "?"})`;
  }

  async setBusinessDate(date: string): Promise<void> {
    await this.request("POST", "/businessdate", { type: "BUSINESS_DATE", date, ...FORMAT });
    await this.request("POST", "/businessdate", { type: "COB_DATE", date, ...FORMAT });
  }

  async setPenaltyGraceDays(days: number): Promise<void> {
    const config = await this.request<{ globalConfiguration: { id: number; name: string }[] }>(
      "GET",
      "/configurations"
    );
    const wait = config.globalConfiguration.find((c) => c.name === "penalty-wait-period");
    if (!wait) throw new Error("penalty-wait-period configuration missing");
    await this.request("PUT", `/configurations/${wait.id}`, { value: days, enabled: true });
  }

  /** Job 12, "Apply penalty to overdue loans". It runs asynchronously; poll until it has finished. */
  async runOverdueJob(): Promise<void> {
    type Job = {
      jobId: number;
      displayName: string;
      currentlyRunning: boolean;
      lastRunHistory?: { version?: number };
    };
    const jobs = await this.request<Job[]>("GET", "/jobs");
    const job = jobs.find((j) => j.displayName === "Apply penalty to overdue loans");
    if (!job) throw new Error("Overdue penalty job missing");
    const before = job.lastRunHistory?.version ?? 0;
    await this.request("POST", `/jobs/${job.jobId}?command=executeJob`, {});
    for (let i = 0; i < 720; i++) {
      await new Promise((r) => setTimeout(r, 250));
      const now = await this.request<Job>("GET", `/jobs/${job.jobId}`);
      if (!now.currentlyRunning && (now.lastRunHistory?.version ?? 0) > before) return;
    }
    throw new Error("Overdue penalty job did not finish in 3 minutes");
  }

  private async ensureRescheduleReason(): Promise<number> {
    if (this.rescheduleReasonId) return this.rescheduleReasonId;
    const codes = await this.request<{ id: number; name: string }[]>("GET", "/codes");
    const code = codes.find((c) => c.name === "LoanRescheduleReason");
    if (!code) throw new Error("LoanRescheduleReason code missing");
    const values = await this.request<{ id: number; name: string }[]>(
      "GET",
      `/codes/${code.id}/codevalues`
    );
    const existing = values.find((v) => v.name === "Penalidad");
    this.rescheduleReasonId = existing
      ? existing.id
      : (
          await this.request<{ subResourceId: number }>("POST", `/codes/${code.id}/codevalues`, {
            name: "Penalidad"
          })
        ).subResourceId;
    return this.rescheduleReasonId;
  }

  // ── Catalog ─────────────────────────────────────────────────────────────

  async ensureLoanProduct(spec: LoanProductSpec): Promise<number> {
    const products = await this.request<{ id: number; shortName: string }[]>(
      "GET",
      "/loanproducts"
    );
    const existing = products.find((p) => p.shortName === spec.shortName);
    if (existing) return existing.id;
    const created = await this.request<{ resourceId: number }>("POST", "/loanproducts", {
      ...FORMAT,
      name: spec.name,
      shortName: spec.shortName,
      currencyCode: spec.currencyCode,
      digitsAfterDecimal: spec.digitsAfterDecimal,
      inMultiplesOf: 0,
      installmentAmountInMultiplesOf: spec.installmentAmountInMultiplesOf,
      charges: spec.overdueChargeId === null ? [] : [{ id: spec.overdueChargeId }],
      principal: 1000,
      minPrincipal: 1,
      maxPrincipal: 100000000,
      numberOfRepayments: 1,
      minNumberOfRepayments: 1,
      maxNumberOfRepayments: 1000,
      repaymentEvery: spec.repaymentEvery,
      repaymentFrequencyType: spec.repaymentFrequencyType,
      interestRatePerPeriod: 0,
      minInterestRatePerPeriod: 0,
      maxInterestRatePerPeriod: 1000,
      interestRateFrequencyType: spec.interestRateFrequencyType,
      interestType: spec.interestType,
      amortizationType: 1,
      interestCalculationPeriodType: 1,
      transactionProcessingStrategyCode: spec.transactionProcessingStrategyCode,
      daysInYearType: 1,
      daysInMonthType: 1,
      isInterestRecalculationEnabled: false,
      accountingRule: 1,
      loanScheduleType: "CUMULATIVE",
      // Variable installments (moving due dates before disbursal) is the
      // candidate for Sunday skipping — not exercised yet, see G-SKIP-SUNDAYS.
      allowVariableInstallments: false
    });
    return created.resourceId;
  }

  async ensureOverdueCharge(name: string, percentPerDay: number): Promise<number> {
    const charges = await this.request<{ id: number; name: string }[]>("GET", "/charges");
    const existing = charges.find((c) => c.name === name);
    if (existing) return existing.id;
    const created = await this.request<{ resourceId: number }>("POST", "/charges", {
      locale: "en",
      name,
      currencyCode: "DOP",
      chargeAppliesTo: 1,
      chargeTimeType: 9,
      // % of the cuota's principal + interest.
      chargeCalculationType: 3,
      chargePaymentMode: 0,
      amount: percentPerDay,
      penalty: true,
      active: true,
      feeFrequency: 0,
      feeInterval: 1
    });
    return created.resourceId;
  }

  async ensurePenaltyCharge(name: string): Promise<number> {
    const charges = await this.request<{ id: number; name: string }[]>("GET", "/charges");
    const existing = charges.find((c) => c.name === name);
    if (existing) return existing.id;
    const created = await this.request<{ resourceId: number }>("POST", "/charges", {
      locale: "en",
      name,
      currencyCode: "DOP",
      chargeAppliesTo: 1,
      chargeTimeType: 2,
      chargeCalculationType: 1,
      chargePaymentMode: 0,
      amount: 1,
      penalty: true,
      active: true
    });
    return created.resourceId;
  }

  async ensurePaymentType(name: string): Promise<number> {
    const types = await this.request<{ id: number; name: string }[]>("GET", "/paymenttypes");
    const existing = types.find((t) => t.name === name);
    if (existing) return existing.id;
    const created = await this.request<{ resourceId: number }>("POST", "/paymenttypes", {
      name,
      description: name,
      isCashPayment: name === "Efectivo",
      position: types.length + 1
    });
    return created.resourceId;
  }

  // ── Clients ─────────────────────────────────────────────────────────────

  async findClientIdByExternalId(externalId: string): Promise<number | null> {
    const client = await this.maybe(
      this.request<{ id: number }>("GET", `/clients/external-id/${externalId}`)
    );
    return client?.id ?? null;
  }

  async createClient(req: CreateClientRequest): Promise<number> {
    const created = await this.request<{ clientId: number }>("POST", "/clients", {
      ...FORMAT,
      officeId: 1,
      legalFormId: 1,
      fullname: req.fullname,
      mobileNo: req.mobileNo,
      externalId: req.externalId,
      active: true,
      activationDate: req.activationDate,
      submittedOnDate: req.activationDate
    });
    return created.clientId;
  }

  async updateClient(
    clientId: number,
    change: { fullname: string; mobileNo: string }
  ): Promise<void> {
    await this.request("PUT", `/clients/${clientId}`, change);
  }

  // ── Loans ───────────────────────────────────────────────────────────────

  async findLoanIdByExternalId(externalId: string): Promise<number | null> {
    const loan = await this.maybe(
      this.request<{ id: number }>("GET", `/loans/external-id/${externalId}`)
    );
    return loan?.id ?? null;
  }

  private loanBody(req: Omit<CreateLoanRequest, "externalId" | "clientId">) {
    return {
      ...FORMAT,
      productId: req.productId,
      principal: req.principal,
      loanTermFrequency: req.numberOfRepayments * req.repaymentEvery,
      loanTermFrequencyType: req.repaymentFrequencyType,
      numberOfRepayments: req.numberOfRepayments,
      repaymentEvery: req.repaymentEvery,
      repaymentFrequencyType: req.repaymentFrequencyType,
      interestRatePerPeriod: req.interestRatePerPeriod,
      amortizationType: 1,
      interestType: 1,
      interestCalculationPeriodType: 1,
      transactionProcessingStrategyCode: "mifos-standard-strategy",
      expectedDisbursementDate: req.expectedDisbursementDate,
      submittedOnDate: req.submittedOnDate,
      loanType: "individual"
    };
  }

  async createLoan(req: CreateLoanRequest): Promise<number> {
    const created = await this.request<{ loanId: number }>("POST", "/loans", {
      ...this.loanBody(req),
      clientId: req.clientId,
      externalId: req.externalId
    });
    return created.loanId;
  }

  async modifyLoan(
    loanId: number,
    req: Omit<CreateLoanRequest, "externalId" | "clientId">
  ): Promise<void> {
    await this.request("PUT", `/loans/${loanId}`, this.loanBody(req));
  }

  async approveLoan(loanId: number, approvedOnDate: string): Promise<void> {
    await this.request("POST", `/loans/${loanId}?command=approve`, { ...FORMAT, approvedOnDate });
  }

  async undoApproval(loanId: number): Promise<void> {
    await this.request("POST", `/loans/${loanId}?command=undoApproval`, {});
  }

  async disburseLoan(loanId: number, date: string, amount: number): Promise<void> {
    await this.request("POST", `/loans/${loanId}?command=disburse`, {
      ...FORMAT,
      actualDisbursementDate: date,
      transactionAmount: amount
    });
  }

  async undoDisbursal(loanId: number): Promise<void> {
    await this.request("POST", `/loans/${loanId}?command=undoDisbursal`, {});
  }

  async getLoan(loanId: number): Promise<FineractLoan> {
    const raw = await this.request<Json>(
      "GET",
      `/loans/${loanId}?associations=repaymentSchedule,transactions,charges`
    );
    const status = raw.status as { code: string };
    const statusMap: Record<string, FineractLoanStatus> = {
      "loanStatusType.submitted.and.pending.approval": "submitted",
      "loanStatusType.approved": "approved",
      "loanStatusType.active": "active",
      "loanStatusType.closed.obligations.met": "closed_obligations_met",
      "loanStatusType.overpaid": "overpaid"
    };
    const schedule = (raw.repaymentSchedule as { periods: Json[] } | undefined)?.periods ?? [];
    const summary = (raw.summary as Json | undefined) ?? {};
    const transactions = (raw.transactions as Json[] | undefined) ?? [];
    const charges = (raw.charges as Json[] | undefined) ?? [];
    return {
      id: raw.id as number,
      externalId: raw.externalId as string,
      status: statusMap[status.code] ?? (status.code as FineractLoanStatus),
      principal: raw.principal as number,
      totalExpectedRepayment: Number(summary.totalExpectedRepayment ?? 0),
      totalRepayment: Number(summary.totalRepayment ?? 0),
      totalOutstanding: Number(summary.totalOutstanding ?? 0),
      chargedOff: Boolean(raw.chargedOff),
      charges: charges.map((c): LoanCharge => ({
        id: c.id as number,
        externalId: (c.externalId as string | undefined) ?? null,
        dueDate: isoOf(c.dueDate as DateArray),
        amount: Number(c.amount ?? 0),
        amountPaid: Number(c.amountPaid ?? 0),
        amountOutstanding: Number(c.amountOutstanding ?? 0),
        penalty: Boolean(c.penalty),
        overdue: (c.chargeTimeType as Json | undefined)?.id === 9,
        waived: Boolean(c.waived)
      })),
      periods: schedule
        .filter((p) => typeof p.period === "number")
        .map((p) => ({
          period: p.period as number,
          dueDate: isoOf(p.dueDate as DateArray),
          principalDue: Number(p.principalDue ?? 0),
          interestDue: Number(p.interestDue ?? 0),
          penaltyChargesDue: Number(p.penaltyChargesDue ?? 0),
          penaltyChargesWaived: Number(p.penaltyChargesWaived ?? 0),
          principalPaid: Number(p.principalPaid ?? 0),
          interestPaid: Number(p.interestPaid ?? 0),
          totalDue: Number(p.totalDueForPeriod ?? 0),
          totalPaid: Number(p.totalPaidForPeriod ?? 0),
          complete: Boolean(p.complete)
        })),
      transactions: transactions.map((t) => {
        const type = t.type as Json;
        return {
          id: t.id as number,
          externalId: (t.externalId as string | undefined) ?? null,
          type: type.disbursement
            ? "disbursement"
            : type.repayment
              ? "repayment"
              : type.accrual
                ? "accrual"
                : "other",
          date: isoOf(t.date as DateArray),
          amount: Number(t.amount ?? 0),
          principalPortion: Number(t.principalPortion ?? 0),
          interestPortion: Number(t.interestPortion ?? 0),
          penaltyChargesPortion: Number(t.penaltyChargesPortion ?? 0),
          reversed: Boolean(t.manuallyReversed)
        };
      })
    };
  }

  // ── Charges and transactions ────────────────────────────────────────────

  async addLoanCharge(
    loanId: number,
    req: { chargeId: number; amount: number; dueDate: string; externalId: string }
  ): Promise<number> {
    const created = await this.request<{ resourceId: number }>("POST", `/loans/${loanId}/charges`, {
      ...FORMAT,
      ...req
    });
    return created.resourceId;
  }

  async waiveLoanCharge(loanId: number, loanChargeId: number): Promise<void> {
    await this.request("POST", `/loans/${loanId}/charges/${loanChargeId}?command=waive`, {});
  }

  async findLoanChargeIdByExternalId(loanId: number, externalId: string): Promise<number | null> {
    const charge = await this.maybe(
      this.request<{ id: number }>("GET", `/loans/${loanId}/charges/external-id/${externalId}`)
    );
    return charge?.id ?? null;
  }

  async repay(
    loanId: number,
    req: { transactionDate: string; amount: number; paymentTypeId: number; externalId: string }
  ): Promise<number> {
    const created = await this.request<{ resourceId: number }>(
      "POST",
      `/loans/${loanId}/transactions?command=repayment`,
      {
        ...FORMAT,
        transactionDate: req.transactionDate,
        transactionAmount: req.amount,
        paymentTypeId: req.paymentTypeId,
        externalId: req.externalId
      }
    );
    return created.resourceId;
  }

  async chargeOff(loanId: number, date: string): Promise<void> {
    await this.request("POST", `/loans/${loanId}/transactions?command=charge-off`, {
      ...FORMAT,
      transactionDate: date
    });
  }

  async undoTransaction(loanId: number, transactionId: number): Promise<void> {
    const tx = await this.request<{ date: DateArray }>(
      "GET",
      `/loans/${loanId}/transactions/${transactionId}`
    );
    await this.request("POST", `/loans/${loanId}/transactions/${transactionId}?command=undo`, {
      ...FORMAT,
      transactionDate: isoOf(tx.date),
      transactionAmount: 0
    });
  }

  async rescheduleLoan(
    loanId: number,
    req: { rescheduleFromDate: string; adjustedDueDate: string; submittedOnDate: string }
  ): Promise<void> {
    const created = await this.request<{ resourceId: number }>("POST", "/rescheduleloans", {
      ...FORMAT,
      loanId,
      rescheduleFromDate: req.rescheduleFromDate,
      adjustedDueDate: req.adjustedDueDate,
      submittedOnDate: req.submittedOnDate,
      rescheduleReasonId: await this.ensureRescheduleReason()
    });
    await this.request("POST", `/rescheduleloans/${created.resourceId}?command=approve`, {
      ...FORMAT,
      approvedOnDate: req.submittedOnDate
    });
  }
}
