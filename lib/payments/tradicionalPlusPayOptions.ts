/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * The two cobrar options a Tradicional Plus loan offers — "Cobrar cuota" and
 * "Cobrar penalidad" — each for its exact amount, with no custom or partial
 * amount (see the collect-payment spec). Owed penalties come first: while any
 * are owed, the penalty is preselected for all of them and the cuota is
 * locked. A disabled option stays on screen with `note` saying why.
 *
 * Pure and cheap: safe to call on every render. `collectPayment` re-checks
 * the same rules against the stored payments.
 */
import type { TradicionalPlusView } from "../repo/types";

export type TradicionalPlusPayOption = "cuota" | "penalty";

export interface TradicionalPlusOptionView {
  label: string;
  amountCents: number;
  enabled: boolean;
  /** Why the option is disabled; null when enabled. */
  note: string | null;
}

export interface TradicionalPlusPayOptionsView {
  cuota: TradicionalPlusOptionView;
  penalty: TradicionalPlusOptionView & { count: number };
  /** null only when nothing is collectible (paid off). */
  defaultOption: TradicionalPlusPayOption | null;
}

export function resolveTradicionalPlusPayOptions(
  plus: TradicionalPlusView
): TradicionalPlusPayOptionsView {
  const count = plus.penaltyCountToCollect;
  const owed = plus.owedPenalties;
  const paidOff = !plus.canCollectCuota && !plus.canCollectPenalty && owed === 0;

  const cuotaNote = paidOff
    ? "Este préstamo ya está saldado."
    : owed > 0
      ? `Primero debe pagar ${owed} ${owed === 1 ? "penalidad" : "penalidades"}`
      : null;
  const penaltyNote = plus.canCollectPenalty
    ? null
    : paidOff
      ? "Este préstamo ya está saldado."
      : "La cuota aún no vence";

  return {
    cuota: {
      label: "Cobrar cuota",
      amountCents: plus.nextCuotaCents,
      enabled: plus.canCollectCuota,
      note: plus.canCollectCuota ? null : cuotaNote
    },
    penalty: {
      label: count > 1 ? `Cobrar penalidad (${count})` : "Cobrar penalidad",
      amountCents: count * plus.penaltyCents,
      count,
      enabled: plus.canCollectPenalty,
      note: penaltyNote
    },
    defaultOption: owed > 0 ? "penalty" : plus.canCollectCuota ? "cuota" : null
  };
}
