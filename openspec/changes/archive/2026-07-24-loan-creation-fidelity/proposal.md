# Proposal: loan-creation-fidelity

## Why

Change 1 of the Loans-screen epic. Two coupled gaps on the Nuevo Préstamo
flow, both about closing the distance between the app and the approved
Pencil design (`06b Nuevo Préstamo`, `Mac4Z`):

1. **Fidelity.** The design has drifted ahead of `NewLoanFormScreen.tsx`.
   The design renders **Frecuencia de pago** and **Tipo de préstamo** as
   selects, a **styled** mora switch, and a selected-client **card**; the
   app still renders frecuencia as chips, a bare RN switch, and a chip
   picker, and has no Tipo de préstamo control at all. There is no reusable
   select component in the app — "selects" are currently faked with chips.
   The design intentionally keeps the existing **Primer pago** control, so
   the app keeps it too (and the design will gain the field for parity).

2. **Installment sizing.** Cuotas are currently rounded **up to the nearest
   50 pesos** (`CUOTA_ROUNDING_CENTS`, ported from mikro), with the final
   cuota absorbing the remainder. In practice the round-to-50 makes cuotas
   land on odd totals and inflates the schedule above `principal + interés`.
   The lender wants **equal-size installments** instead: every cuota the
   same whole-peso amount, the final cuota absorbing the few-peso remainder
   so the schedule still sums exactly to `totalRepay`.

## What Changes

- **`components/SelectField.tsx` (new)**: a reusable dropdown "select"
  matching the design's `m/select-field` — an input-styled pressable row
  with the current label and a chevron, opening a modal list of options.
  Replaces the chip-based fake-selects.
- **`components/screens/NewLoanFormScreen.tsx`**: Frecuencia chips →
  `SelectField`; add a **Tipo de préstamo** `SelectField` (single option
  "Tradicional"/`term` for now — Crédito Abierto, a later change, adds the
  second option and wires it); restyle the mora **Switch** to the design's
  green style; show a selected-client **card**; keep **Primer pago**;
  reorder fields to the design. No schema/persistence change — `loanType` is
  a UI placeholder that matches the design.
- **`lib/loans/loanMath.ts`**: replace round-up-to-50 with equal whole-peso
  cuotas — base cuota = `round(totalRepay / termCount)` to the nearest whole
  peso; `lastCuotaCents` absorbs the remainder. Exported function names and
  signatures unchanged; only the internal rounding changes. The `#60`
  new-loan preview ("Última cuota" line when it differs) still applies — the
  difference is now a few pesos, not up to 50.

## Non-goals

- **Crédito Abierto** (open-credit loan type, #55) — a later change adds the
  second Tipo de préstamo option and all its mechanics. This change only
  lays the (single-option) Tipo control for design parity.
- **Sunday-skip flag** (#54) — separate change.
- No change to `installmentDueDate`, `mora.ts`, sync, or persistence.
