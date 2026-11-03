/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Micobro concept → Fineract request. Pure functions, no I/O, so each
 * mapping decision is visible and testable on its own. GAP-ANALYSIS.md
 * explains why each one is the way it is.
 */
import { z } from "zod/v4";
import {
  InterestRateFrequency,
  InterestType,
  PeriodFrequency,
  type LoanProductSpec
} from "../fineract/port";
import type { frequencies, loanTerms } from "../contract/v1";

type Frequency = (typeof frequencies)[number];
type LoanTerms = z.infer<typeof loanTerms>;

export const centsToPesos = (cents: number) => cents / 100;
export const pesosToCents = (pesos: number) => Math.round(pesos * 100);

/**
 * Micobro's quincenal is a fixed 15 days (`lib/loans/frequency.ts`), not
 * Fineract's 2-week period, so it maps to "every 15 days".
 */
export function repaymentPeriod(frequency: Frequency): {
  repaymentEvery: number;
  repaymentFrequencyType: PeriodFrequency;
} {
  switch (frequency) {
    case "daily":
      return { repaymentEvery: 1, repaymentFrequencyType: PeriodFrequency.DAYS };
    case "weekly":
      return { repaymentEvery: 1, repaymentFrequencyType: PeriodFrequency.WEEKS };
    case "biweekly":
      return { repaymentEvery: 15, repaymentFrequencyType: PeriodFrequency.DAYS };
    case "monthly":
      return { repaymentEvery: 1, repaymentFrequencyType: PeriodFrequency.MONTHS };
  }
}

const FREQUENCY_CODE: Record<Frequency, string> = {
  daily: "D",
  weekly: "W",
  biweekly: "Q",
  monthly: "M"
};

/**
 * The loan's mora rate as Fineract will charge it: only term loans with mora
 * on carry one. Tradicional Plus has its own fixed penalty instead, and open
 * credit capitalizes unpaid interest.
 */
export function moraRateBps(terms: Pick<LoanTerms, "type" | "mora">): number {
  return terms.type === "term" && terms.mora.enabled ? terms.mora.rateBps : 0;
}

/** Fineract's overdue charge: a monthly rate (per 30 days) charged daily, as % of the late cuota. */
export function overdueCharge(rateBps: number): { name: string; percentPerDay: number } {
  return {
    name: `Mora ${rateBps / 100}% / 30 días`,
    percentPerDay: Number((rateBps / 100 / 30).toFixed(6))
  };
}

/**
 * One Fineract product per (loan type × frequency × mora rate). Micobro has
 * no product concept — every loan carries its own terms — so products are a
 * catalog the BFF creates on first use, and the per-loan numbers (principal,
 * rate, term) ride on each loan. The mora rate has to be part of the
 * product because Fineract only accepts an overdue charge on a product.
 *
 * shortName (Fineract allows 4 characters): type, frequency, and the mora
 * rate in tenths of a percent as two base-36 digits (10% → "2s").
 */
export function productFor(
  terms: Pick<LoanTerms, "type" | "frequency" | "mora">,
  overdueChargeId: number | null
): LoanProductSpec {
  const typeCode = terms.type === "tradicional_plus" ? "P" : "T";
  const rate = moraRateBps(terms);
  const rateCode = Math.round(rate / 10)
    .toString(36)
    .padStart(2, "0");
  return {
    shortName: `${typeCode}${FREQUENCY_CODE[terms.frequency]}${rateCode}`,
    name: `Micobro ${terms.type} ${terms.frequency} mora ${rate / 100}%`,
    currencyCode: "DOP",
    digitsAfterDecimal: 2,
    installmentAmountInMultiplesOf: 1,
    overdueChargeId: rate > 0 ? overdueChargeId : null,
    interestType: InterestType.FLAT,
    interestRateFrequencyType: InterestRateFrequency.WHOLE_TERM,
    ...repaymentPeriod(terms.frequency),
    transactionProcessingStrategyCode: "mifos-standard-strategy"
  };
}

/** Mora stops (by charge-off) once the oldest unpaid cuota is this many days late. */
export const MORA_STOP_DAYS = 90;

export const PENALTY_CHARGE_NAME = "Penalidad Tradicional Plus";

export const PAYMENT_TYPE_NAME: Record<"cash" | "transfer", string> = {
  cash: "Efectivo",
  transfer: "Transferencia"
};

/**
 * External ids for Fineract objects the BFF may have to recreate when it
 * replays a loan (an Editar préstamo correction): Fineract keeps reversed
 * transactions with their external id, so a replayed one needs a new one.
 */
export function versionedExternalId(id: string, version: number): string {
  return version === 0 ? id : `${id}~v${version}`;
}

/** The local date part of an ISO instant with offset — the device's business date. */
export function businessDateOf(instantWithOffset: string): string {
  return instantWithOffset.slice(0, 10);
}
