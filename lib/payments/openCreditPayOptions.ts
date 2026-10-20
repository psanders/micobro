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
 * "Ponerse al día" (catch up) is offered whenever unpaid interest was added
 * to the balance (intereses sumados): it collects the current cycle's
 * outstanding interest plus those sumados in one go, and is pre-selected so
 * a lender never mistakes "Solo interés" for the customer being current.
 *
 * Pure and cheap: safe to call on every render.
 */
import type { OpenCreditState } from "../loans/openCredit";

export type OpenCreditPayOption = "catch_up" | "interest" | "interest_capital" | "capital";

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
  /** "Ponerse al día" — only when there are intereses sumados to clear. */
  catchUpEnabled: boolean;
  /** What "Ponerse al día" collects: outstanding interest + intereses sumados. */
  catchUpCents: number;
  /**
   * What to select on entering the screen: whichever option covers the main
   * case for this loan right now — "Solo interés" while there is interest to
   * collect, "Solo capital" once there isn't. `null` only when nothing is
   * collectible at all (a closed loan), so the lender always lands on a live
   * selection rather than an empty form.
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
      catchUpEnabled: false,
      catchUpCents: 0,
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
      catchUpEnabled: false,
      catchUpCents: 0,
      defaultOption: "interest"
    };
  }

  // A zero-interest cycle counts as covered — there is nothing to collect for
  // it, so capital is the only thing left to pay.
  const interestCovered = currentCycle.paidCents >= currentCycle.interestDueCents;
  const catchUpEnabled = state.capitalizedInterestCents > 0;

  return {
    interestCovered,
    dueInterestCents: interestCovered ? 0 : state.interestDueCents,
    interestEnabled: !interestCovered,
    interestCapitalEnabled: !interestCovered,
    capitalEnabled: interestCovered,
    catchUpEnabled,
    catchUpCents: catchUpEnabled ? state.catchUpCents : 0,
    defaultOption: catchUpEnabled ? "catch_up" : interestCovered ? "capital" : "interest"
  };
}
