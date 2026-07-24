# Tasks: loan-creation-fidelity

## 1. Select component

- [ ] 1.1 `components/SelectField.tsx` — reusable dropdown select matching
      `m/select-field` (label + current value + chevron; taps open a modal
      option list). Generic over the value type; Spanish.
- [ ] 1.2 Storybook story only if sibling `.stories.tsx` files are the norm
      and it's cheap; otherwise skip.

## 2. Nuevo Préstamo fidelity

- [ ] 2.1 Frecuencia chips → `SelectField` (daily/weekly/biweekly/monthly).
- [ ] 2.2 Add "Tipo de préstamo" `SelectField` — single option
      "Tradicional" (`term`); `loanType` state, not persisted (design
      placeholder for the later Crédito Abierto change).
- [ ] 2.3 Restyle the mora `Switch` to the design's green style
      (trackColor brandSky / thumb white).
- [ ] 2.4 Selected-client **card** (avatar + name + "Cliente seleccionado"),
      keeping a way to change selection and the `initialCustomerId` path.
- [ ] 2.5 Keep "Primer pago"; reorder fields to the design order.

## 3. Equal-size installments

- [ ] 3.1 `lib/loans/loanMath.ts` — replace round-up-to-50
      (`CUOTA_ROUNDING_CENTS`) with equal whole-peso cuotas; final cuota
      absorbs the remainder. Function names/signatures unchanged; update the
      module doc + inline comments.
- [ ] 3.2 Update every test whose expected cuota values assumed round-to-50
      (loanMath, and any of mora/loanViews/paymentHistory/collect/route that
      assert cuota amounts). Recompute expected values from the new formula.

## 4. Design parity (Pencil)

- [ ] 4.1 Add "Primer pago" (and the grace field under mora) to `Mac4Z` so
      the design shows what the app keeps.
- [ ] 4.2 Move the misplaced "10 Permiso de Impresión" screen into the
      Collectors User Flow cluster (`l7i5GB`).

## 5. Verify

- [ ] 5.1 `npx tsc --noEmit` clean.
- [ ] 5.2 `npm run lint` clean (ignoring the stray `.claude/worktrees/` copy).
- [ ] 5.3 `npx jest` green (ignoring `/node_modules/` and `/.claude/`).
- [ ] 5.4 Manual test on the `mikro-test` emulator — user confirms fidelity.
