/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: collect-payment "Tradicional Plus cobro options" (issue #191 items
 * 1, 3–5) — "Penalidades + cuota" first and preselected while penalties are
 * owed, "Cobrar penalidad" for 1..N, and "Cobrar cuota" only once nothing is
 * owed and the cuota is due.
 */
import {
  resolveTradicionalPlusPayOptions,
  tradicionalPlusBreakdown
} from "../lib/payments/tradicionalPlusPayOptions";
import { day, plusAt } from "./helpers/tradicionalPlusFixture";
import type { Payment } from "../lib/payments/payment.schema";

const optionsAt = (today: Date, payments: Payment[] = []) =>
  resolveTradicionalPlusPayOptions(plusAt(payments, today));

describe("resolveTradicionalPlusPayOptions", () => {
  it("offers the combo first and preselected when 2 penalties are owed", () => {
    const options = optionsAt(day(3, 20));

    expect(options.defaultOption).toBe("combo");
    expect(options.combo).toEqual({
      label: "Penalidades + cuota",
      amountCents: 190_000,
      count: 2,
      enabled: true,
      note: null
    });
  });

  it("lets the penalty stepper run from 1 to N, starting at N", () => {
    const options = optionsAt(day(3, 20));

    expect(options.penalty).toMatchObject({
      label: "Cobrar penalidad",
      min: 1,
      max: 2,
      initial: 2,
      amountCents: 60_000,
      enabled: true
    });
  });

  it("disables the cuota alone with the owed count, for 2 and for 1", () => {
    expect(optionsAt(day(3, 20)).cuota).toMatchObject({
      label: "Cobrar cuota",
      enabled: false,
      note: "Primero debe pagar 2 penalidades"
    });

    const one = optionsAt(day(3, 5));
    expect(one.cuota.note).toBe("Primero debe pagar 1 penalidad");
    expect(one.combo).toMatchObject({ label: "Penalidad + cuota", amountCents: 160_000 });
    expect(one.penalty).toMatchObject({ max: 1, initial: 1 });
  });

  it("preselects the cuota on its due date and offers exactly 1 penalty, no combo", () => {
    const options = optionsAt(day(3, 1));

    expect(options.defaultOption).toBe("cuota");
    expect(options.cuota).toMatchObject({ enabled: true, amountCents: 130_000, note: null });
    expect(options.penalty).toMatchObject({ enabled: true, max: 1, initial: 1 });
    expect(options.combo).toBeNull();
  });

  it("keeps the cuota collectable within the grace days (3 Mar)", () => {
    const options = optionsAt(day(3, 3));

    expect(options.defaultOption).toBe("cuota");
    expect(options.cuota.enabled).toBe(true);
    expect(options.combo).toBeNull();
  });

  it("disables both and preselects nothing before the cuota is due", () => {
    const options = optionsAt(day(2, 24));

    expect(options.defaultOption).toBeNull();
    expect(options.cuota).toMatchObject({ enabled: false, note: "Vence el 01/03" });
    expect(options.penalty).toMatchObject({ enabled: false, note: "La cuota aún no vence" });
    expect(options.combo).toBeNull();
  });
});

describe("tradicionalPlusBreakdown", () => {
  it("lists the penalties, the move and the cuota for the combo", () => {
    expect(tradicionalPlusBreakdown(plusAt([], day(3, 20)), "combo", 2, 10)).toEqual([
      { label: "Penalidades (2) · no abonan", amountCents: 60_000 },
      { label: "El plan se corre 2 quincenas", amountCents: 0 },
      { label: "Cuota 1/10", amountCents: 130_000 }
    ]);
  });

  it("says how many penalties stay owed after k of N", () => {
    expect(tradicionalPlusBreakdown(plusAt([], day(3, 20)), "penalty", 1, 10)).toEqual([
      { label: "Penalidad · no abona", amountCents: 30_000 },
      { label: "El plan se corre una quincena", amountCents: 0 },
      { label: "Queda 1 penalidad pendiente", amountCents: 0 }
    ]);
    // At k = N the "Queda(n)" line is gone.
    expect(
      tradicionalPlusBreakdown(plusAt([], day(3, 20)), "penalty", 2, 10).map((l) => l.label)
    ).toEqual(["Penalidades (2) · no abonan", "El plan se corre 2 quincenas"]);
  });

  it("names the next cuota and its date when nothing is collectable", () => {
    expect(tradicionalPlusBreakdown(plusAt([], day(2, 24)), null, 1, 10)).toEqual([
      { label: "Próxima cuota 1/10 · vence 01/03", amountCents: 0 }
    ]);
  });
});
