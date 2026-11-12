/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * The cobrar options a Tradicional Plus loan offers, each for an exact
 * amount, with no custom amount (see the collect-payment spec):
 *
 * - "Penalidades + cuota" (N = 1: "Penalidad + cuota"): every owed penalty
 *   plus the next cuota in one cobro. Only while penalties are owed, and
 *   then preselected.
 * - "Cobrar penalidad": 1..N owed penalties (a stepper, starting at N), or
 *   exactly 1 when nothing is owed and the cuota is due.
 * - "Cobrar cuota": the cuota alone, only with nothing owed and the cuota due.
 *
 * A disabled option stays on screen with `note` saying why. Pure and cheap:
 * safe to call on every render. `collectPayment` re-checks the same rules
 * against the stored payments.
 */
import { formatShortDate } from "../utils/dates";
import type { TradicionalPlusView } from "../repo/types";

export type TradicionalPlusPayOption = "combo" | "cuota" | "penalty";

export interface TradicionalPlusOptionView {
  label: string;
  amountCents: number;
  enabled: boolean;
  /** Why the option is disabled; null when enabled. */
  note: string | null;
}

export interface TradicionalPlusPayOptionsView {
  /** "Penalidades + cuota"; null unless penalties are owed. */
  combo: (TradicionalPlusOptionView & { count: number }) | null;
  /** `amountCents` is for `initial` penalties; the stepper ranges `min`..`max`. */
  penalty: TradicionalPlusOptionView & { min: 1; max: number; initial: number };
  cuota: TradicionalPlusOptionView;
  /** null when nothing is collectable today (cuota not due yet, or paid off). */
  defaultOption: TradicionalPlusPayOption | null;
}

/** "1 penalidad" / "2 penalidades". */
export function penaltyCountLabel(count: number): string {
  return `${count} ${count === 1 ? "penalidad" : "penalidades"}`;
}

export function resolveTradicionalPlusPayOptions(
  plus: TradicionalPlusView
): TradicionalPlusPayOptionsView {
  const owed = plus.owedPenalties;
  const paidOff = plus.nextCuotaNumber === null;
  const max = plus.maxPenaltyCount;

  const cuotaNote = plus.canCollectCuota
    ? null
    : paidOff
      ? "Este préstamo ya está saldado."
      : owed > 0
        ? `Primero debe pagar ${penaltyCountLabel(owed)}`
        : plus.nextDueDate
          ? `Vence el ${formatShortDate(plus.nextDueDate)}`
          : null;
  const penaltyNote = plus.canCollectPenalty
    ? null
    : paidOff
      ? "Este préstamo ya está saldado."
      : "La cuota aún no vence";

  return {
    combo:
      owed > 0
        ? {
            label: owed === 1 ? "Penalidad + cuota" : "Penalidades + cuota",
            amountCents: owed * plus.penaltyCents + plus.nextCuotaCents,
            count: owed,
            enabled: true,
            note: null
          }
        : null,
    penalty: {
      label: "Cobrar penalidad",
      amountCents: max * plus.penaltyCents,
      min: 1,
      max,
      initial: max,
      enabled: plus.canCollectPenalty,
      note: penaltyNote
    },
    cuota: {
      label: "Cobrar cuota",
      amountCents: plus.nextCuotaCents,
      enabled: plus.canCollectCuota,
      note: cuotaNote
    },
    defaultOption: owed > 0 ? "combo" : plus.canCollectCuota ? "cuota" : null
  };
}

/**
 * The CÓMO SE APLICA lines for a Tradicional Plus option. `count` is the
 * stepper's value for "Cobrar penalidad"; `installmentsTotal` the loan's
 * cuota count ("Cuota 1/10"); `option` null means nothing is
 * collectable today, so the card names the next cuota and its date.
 */
export function tradicionalPlusBreakdown(
  plus: TradicionalPlusView,
  option: TradicionalPlusPayOption | null,
  count: number,
  installmentsTotal: number
): { label: string; amountCents: number }[] {
  const cuotaLine = (label: string) =>
    plus.nextCuotaNumber !== null ? [{ label, amountCents: plus.nextCuotaCents }] : [];
  const total = `${plus.nextCuotaNumber ?? 0}/${installmentsTotal}`;
  const penaltyLines = (k: number) => [
    {
      label: k === 1 ? "Penalidad · no abona" : `Penalidades (${k}) · no abonan`,
      amountCents: k * plus.penaltyCents
    },
    { label: `El plan se corre ${k === 1 ? "una quincena" : `${k} quincenas`}`, amountCents: 0 }
  ];

  if (option === "combo") {
    return [...penaltyLines(plus.owedPenalties), ...cuotaLine(`Cuota ${total}`)];
  }
  if (option === "penalty") {
    const left = plus.owedPenalties - count;
    return [
      ...penaltyLines(count),
      ...(left > 0
        ? [
            {
              label:
                left === 1
                  ? "Queda 1 penalidad pendiente"
                  : `Quedan ${left} penalidades pendientes`,
              amountCents: 0
            }
          ]
        : [])
    ];
  }
  if (option === "cuota") return cuotaLine(`Cuota ${total}`);
  return plus.nextCuotaNumber !== null && plus.nextDueDate
    ? [
        {
          label: `Próxima cuota ${total} · vence ${formatShortDate(plus.nextDueDate)}`,
          amountCents: 0
        }
      ]
    : [];
}
