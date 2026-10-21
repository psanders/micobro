/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
export interface PositionByType {
  loanCount: number;
  /** Still to collect on loans of this type. */
  outstandingCents: number;
}

export interface OwnerPosition {
  /** Capital lent on active loans (capital pendiente for crédito abierto). */
  lentCents: number;
  /** Still to collect: the sum of every active loan's balance. */
  receivableCents: number;
  /** Everything collected (mora included) on active loans. */
  collectedTotalCents: number;
  overdue: {
    /** Still to collect on late loans. */
    cents: number;
    loanCount: number;
    /** Share of `receivableCents`, rounded; 0 when nothing is to collect. */
    percent: number;
  };
  byType: { term: PositionByType; openCredit: PositionByType };
  month: {
    collectedCents: number;
    /** Still due by month end, net of what is already paid. */
    remainingCents: number;
    /** Best case: collected + remaining. */
    expectedCents: number;
    /** collected / expected, 0..1; 0 when nothing is expected. */
    progress: number;
  };
}
