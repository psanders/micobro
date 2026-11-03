/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: owner-position "Tradicional Plus in Mi cartera" — issue #191 items 13
 * and 14, both settled by Pedro on 2026-11-03. Collected penalties show in
 * "Cobrado este mes" and never in what is still to collect (#188 replaced the
 * margin with "Interés por cobrar"). A Tradicional Plus loan's "En atraso" is
 * its owed penalties, and "Falta por cobrar" assumes they're paid and the
 * plan moves.
 */
import { composePosition } from "../lib/reports/composePosition";
import { cuota, day, penalty, plusLoan } from "./helpers/tradicionalPlusFixture";

describe("composePosition — Tradicional Plus penalties", () => {
  it("counts collected penalties in Cobrado este mes and leaves por cobrar unchanged", () => {
    const today = day(3, 20);
    const penalties = [penalty(day(3, 20)), penalty(day(3, 20))];

    const without = composePosition({ loans: [plusLoan], payments: [], today });
    const withPenalties = composePosition({ loans: [plusLoan], payments: penalties, today });

    expect(withPenalties.month.collectedCents - without.month.collectedCents).toBe(60_000);
    expect(withPenalties.receivableCents).toBe(without.receivableCents);
    expect(withPenalties.interestCents).toBe(without.interestCents);
    expect(withPenalties.capitalCents).toBe(without.capitalCents);
  });
});

describe("composePosition — Tradicional Plus arrears and month outlook", () => {
  // Cuota 1 paid on 1 Mar; cuotas 2 (16 Mar) and 3 (31 Mar) missed.
  const paid = () => [cuota(day(3, 1))];

  it("counts owed penalties as En atraso, not the missed cuotas", () => {
    const position = composePosition({ loans: [plusLoan], payments: paid(), today: day(4, 4) });

    expect(position.overdue.cents).toBe(60_000);
    expect(position.overdue.loanCount).toBe(1);
  });

  it("counts owed penalties plus the moved cuotas due by month end as Falta por cobrar", () => {
    // Paying both penalties moves cuota 2 to 15 Apr and cuota 3 to 30 Apr.
    const position = composePosition({ loans: [plusLoan], payments: paid(), today: day(4, 4) });

    expect(position.month.remainingCents).toBe(60_000 + 130_000 + 130_000);
  });

  it("counts the cuota past its date as En atraso while still within grace", () => {
    const position = composePosition({ loans: [plusLoan], payments: [], today: day(3, 3) });

    expect(position.overdue.cents).toBe(130_000);
    expect(position.overdue.loanCount).toBe(1);
    expect(position.month.remainingCents).toBe(130_000 + 130_000 + 130_000);
  });

  it("owes nothing late once the penalties are paid and the cuota isn't due", () => {
    const payments = [...paid(), penalty(day(4, 4)), penalty(day(4, 4))];

    const position = composePosition({ loans: [plusLoan], payments, today: day(4, 6) });

    expect(position.overdue.cents).toBe(0);
    expect(position.overdue.loanCount).toBe(0);
    expect(position.month.remainingCents).toBe(260_000);
  });

  it("leaves a Tradicional loan with the same dates and payments unchanged", () => {
    const tradicional = { ...plusLoan, loanType: null, penaltyCents: null };

    const position = composePosition({ loans: [tradicional], payments: paid(), today: day(4, 4) });

    // Cuotas 2 and 3 past due; cuotas 2–5 due by 30 Apr (cuota 4 15 Apr, 5 30 Apr).
    expect(position.overdue.cents).toBe(260_000);
    expect(position.month.remainingCents).toBe(4 * 130_000);
  });
});
