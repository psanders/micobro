/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: owner-position "This month's outlook" — issue #191 item 13, settled by
 * Pedro on 2026-11-03: Mi cartera's "Margen de beneficio" was replaced in #188
 * by "Interés por cobrar" (interest still inside por cobrar), so collected
 * Tradicional Plus penalties show in "Cobrado este mes" and never in what is
 * still to collect.
 */
import { composePosition } from "../lib/reports/composePosition";
import { day, penalty, plusLoan } from "./helpers/tradicionalPlusFixture";

const today = day(3, 20);

describe("composePosition — Tradicional Plus penalties", () => {
  it("counts collected penalties in Cobrado este mes and leaves por cobrar unchanged", () => {
    const penalties = [penalty(day(3, 20)), penalty(day(3, 20))];

    const without = composePosition({ loans: [plusLoan], payments: [], today });
    const withPenalties = composePosition({ loans: [plusLoan], payments: penalties, today });

    expect(withPenalties.month.collectedCents - without.month.collectedCents).toBe(60_000);
    expect(withPenalties.receivableCents).toBe(without.receivableCents);
    expect(withPenalties.interestCents).toBe(without.interestCents);
    expect(withPenalties.capitalCents).toBe(without.capitalCents);
  });
});
