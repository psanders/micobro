/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Which cobrar options a Crédito Abierto loan may be collected with right
 * now, derived from the replayed cycle state (`openCreditState`).
 *
 * The rule that drives everything: once the CURRENT cycle's interest has been
 * covered, `OpenCreditState.interestDueCents` deliberately rolls forward to the
 * NEXT cycle's interest so a capital paydown lowers the figure immediately (see
 * `lib/loans/openCredit.ts`). That is right for the loan-detail screen and
 * wrong for the collect screen, where offering it would collect next cycle's
 * interest early. So the interest options are locked out at that point and
 * "Solo capital" opens up instead — no payment-type column needed, because the
 * engine already routes anything paid beyond the cycle's interest to capital.
 *
 * Pure and cheap: safe to call on every render.
 */
import type { OpenCreditState } from "../loans/openCredit";

export type OpenCreditPayOption = "interest" | "interest_capital" | "capital";

export interface OpenCreditPayOptionsView {
  /** True once the current cycle's interest has been fully covered. */
  interestCovered: boolean;
  /**
   * Interest still collectible for the CURRENT cycle — zero once covered.
   * Never the following cycle's amount.
   */
  dueInterestCents: number;
  interestEnabled: boolean;
  interestCapitalEnabled: boolean;
  capitalEnabled: boolean;
  /**
   * What to select on entering the screen. `null` once the interest is
   * covered: paying capital without interest is not the ordinary case, so
   * "Solo capital" is never inherited — the lender picks it deliberately.
   */
  defaultOption: OpenCreditPayOption | null;
}

export function resolveOpenCreditPayOptions(state: OpenCreditState): OpenCreditPayOptionsView {
  const currentCycle = state.cycles.length > 0 ? state.cycles[state.cycles.length - 1]! : null;

  // A closed loan owes nothing: every option is off and there is nothing to
  // collect, whatever the cycle history says.
  if (state.isClosed) {
    return {
      interestCovered: true,
      dueInterestCents: 0,
      interestEnabled: false,
      interestCapitalEnabled: false,
      capitalEnabled: false,
      defaultOption: null
    };
  }

  // No cycle has started yet (a future-dated loan): nothing is collectible for
  // a cycle that hasn't begun, but the interest is not "covered" either.
  if (!currentCycle) {
    return {
      interestCovered: false,
      dueInterestCents: state.interestDueCents,
      interestEnabled: true,
      interestCapitalEnabled: true,
      capitalEnabled: false,
      defaultOption: "interest"
    };
  }

  // A zero-interest cycle counts as covered — there is nothing to collect for
  // it, so capital is the only thing left to pay.
  const interestCovered = currentCycle.paidCents >= currentCycle.interestDueCents;

  return {
    interestCovered,
    dueInterestCents: interestCovered ? 0 : state.interestDueCents,
    interestEnabled: !interestCovered,
    interestCapitalEnabled: !interestCovered,
    capitalEnabled: interestCovered,
    defaultOption: interestCovered ? null : "interest"
  };
}
