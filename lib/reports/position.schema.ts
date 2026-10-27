/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Contract: openspec/changes/cartera-figures-fix/design.md.
 */
export interface PositionByType {
  loanCount: number;
  /** Still to collect on loans of this type. */
  outstandingCents: number;
}

export interface OwnerPosition {
  /**
   * Capital still to collect ("Prestado activo"): a term loan's balance
   * minus its interest share, or a crédito abierto's capital pendiente.
   */
  capitalCents: number;
  /** Still to collect: the sum of every active loan's balance. */
  receivableCents: number;
  /**
   * Interés por cobrar: the interest still inside `receivableCents` — a term
   * loan's flat interest share of its balance, or a crédito abierto's
   * intereses sumados. Always `capitalCents + interestCents === receivableCents`.
   */
  interestCents: number;
  overdue: {
    /** Past due (term: cuotas due before today; crédito abierto: intereses sumados), net of what was paid. */
    cents: number;
    /** Loans with a past-due amount above zero. */
    loanCount: number;
    /** Share of `receivableCents`, rounded; 0 when nothing is to collect. */
    percent: number;
  };
  byType: { term: PositionByType; openCredit: PositionByType };
  month: {
    /** Every payment made this month, whatever its loan's state now. */
    collectedCents: number;
    /** Still due by month end, net of what is already paid. */
    remainingCents: number;
    /** Best case: collected + remaining. */
    expectedCents: number;
    /** collected / expected, 0..1; 0 when nothing is expected. */
    progress: number;
  };
}
