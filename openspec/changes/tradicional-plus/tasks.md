# Tasks

## 1. Design (gate)

- [ ] 1.1 (Waived for the first build by Pedro on 2026-10-27 — UI shipped first; frames still owed.) In `designs/app.pen`, add frames for Nuevo Préstamo with Tradicional Plus (Penalidad field, Quincenal locked, no mora fields), Registrar cobro in its three states (cuota due, cuota not due yet, penalties owed), Préstamo Detalle (chips, "Corrida N veces", Total a pagar hoy with penalties) and a penalty receipt. Verify: Pedro approves the frames before any UI task starts.

## 2. Data model

- [x] 2.1 Add `"term_plus"` to `loanTypes`, `penalty` (whole pesos > 0, required only for `term_plus`) to `loanTermsShape` with a refine, `penaltyCents` to `Loan` and `loanTermsFields` (stores `moraEnabled: false`, `loanType: "term_plus"`). Verify: new cases in `__tests__/` for create/update schema pass (missing penalty rejected, other types store null).
- [x] 2.2 Add nullable `penalty_cents` to `loans` in `lib/db/schema.ts` and run `npm run db:generate`. Verify: the generated migration adds only that column, and `createLoan`/`updateLoan` tests persist it.
- [x] 2.3 Add `PENALTY_NOTE` and an `isPrincipalPayment(p)` helper in `lib/loans/loanViews.ts`, and replace every "not mora" filter that means "counts toward principal" with it (`principalPaidCents`, receipt numbering, history, receipt line ordering, Mi cartera). Verify: `grep -rn "MORA_NOTE" lib` shows no remaining principal filter, and existing loanViews/mora tests still pass.

## 3. Cycle engine

- [x] 3.1 Create `lib/loans/tradicionalPlus.ts` with `tradicionalPlusState(loan, payments, today)` per design §3, exported from `lib/loans/index.ts`. Verify: `__tests__/tradicionalPlus.test.ts` covers every scenario in `specs/tradicional-plus-schedule` (cuota covers, penalty moves one quincena, unlimited moves, within grace, past grace, accumulation, paid off after moves, atraso and back al día).
- [x] 3.2 Branch `installmentDueDate`/`loanEndDate`, `buildLoanDetailView`, `oldestOverdueInstallment`/`computeLoanMora` (always zero) and the route and Mi cartera overdue checks on `term_plus` to use the engine. Verify: tests show a moved schedule in the detail view, the route overdue with the right days, and Mi cartera counting the loan as término fijo en atraso.

## 4. Collecting

- [x] 4.1 Add `resolveTradicionalPlusPayOptions(state)` beside `openCreditPayOptions.ts` and return the engine state from `getCollectContext`. Verify: unit tests for the three states in the collect-payment spec (cuota preselected and penalty enabled when due; penalty disabled before due; "Cobrar penalidad (N)" preselected and cuota disabled with "Primero debe pagar N penalidades").
- [x] 4.2 In `collectPayment`, re-run the engine and reject (ValidationError) any Tradicional Plus amount that isn't the next cuota with nothing owed, or the owed penalties (or one penalty when due), and write one `PENALTY_NOTE` row per penalty with a shared `paidAt`. Verify: tests for RD$800 rejected, cuota rejected while penalties are owed, two penalties written as two rows.
- [x] 4.3 Build the penalty receipt lines ("Penalidad · Cuota N pasa al <fecha>") and the moved end date for the digital receipt, the reprint (`getPaymentReceipt`) and the thermal printer. Verify: receipt tests for a penalty cobro and a cuota cobro on a moved loan.

## 5. Screens

- [x] 5.1 `NewLoanFormScreen`: third Tipo option, Penalidad field, Frecuencia locked to Quincenal (unlocked on switching back), mora fields hidden; same for Editar préstamo. Verify: Storybook story per state matches the approved frames; screen tests for the loan-configuration scenarios. — Verified on the emulator E2E run (2026-10-27); Storybook stories still to add.
- [x] 5.2 `CollectPaymentScreen`: the Tradicional Plus option list, notes and readout. Verify: Storybook stories for the three states match the frames. — Verified on the emulator E2E run (2026-10-27); Storybook stories still to add.
- [x] 5.3 Loan detail: Tradicional Plus and Penalidad chips, moved Vence, "Corrida N veces", penalties in Total a pagar hoy, moved Plan de pagos dates, and "Penalidad" rows in Histórico de Pagos. Verify: Storybook story plus tests for each loan-detail scenario. — Verified on the emulator E2E run (2026-10-27); Storybook stories still to add.

## 6. Sync

- [x] 6.1 Append "Penalidad (centavos)" to the Préstamos header, `loanRowValues` and `loanFromRow`, and write the `Q1` header once when missing (cached in `sync_meta`); `provisionSheet` includes it. Verify: tests with the fake Google server for an old Sheet (header added, no cells moved), a new Sheet, and a `term_plus` loan round-tripping push → pull.

## 7. Integration

- [ ] 7.1 Run `npm test`, `npm run lint` and `npx tsc --noEmit`, then walk the flow on the emulator (back up the DB first): create a Tradicional Plus loan, collect a cuota, pay one penalty, let two cycles lapse, collect the owed penalties, sync and check the Sheet. Verify: every step matches the specs, and the Sheet shows `term_plus`, the penalty column and the penalty rows.

## 8. Blocking decisions (from the emulator E2E run, 2026-10-27)

Do not merge until each one is decided and, where it applies, built.

- [ ] 8.1 Penalty flag lives in the editable Pagos "Notas" cell. Editing or clearing it in the Sheet turns a penalty into principal: the balance drops and the schedule moves back, with no warning. Mora has the same latent risk. Decide: protect the column (Sheets protected range) or move the payment kind to its own column (e.g. "Tipo": cuota / mora / penalidad) and stop reading `notes`. Verify: a pull of a Pagos row with an edited kind can't change a loan's balance or schedule.
- [ ] 8.2 Older app builds reject `term_plus` rows on pull and show them as row errors. Decide the rollout: gate creating Tradicional Plus behind a minimum version recorded in the Sheet, or require every device to update first. Verify: an old-version pull of a Sheet with a `term_plus` loan doesn't corrupt or drop data.
- [ ] 8.3 "Total a pagar hoy" shows the next cuota right after a penalty is paid, though nothing is due until the next quincena — invites collecting twice. Decide: show "Nada pendiente hoy" (and the next date) for Tradicional Plus, or for every loan type.
- [ ] 8.4 Penalties collected are invisible on the loan detail ("Pagado RD$0") and excluded from Mi cartera's margin. Decide: add "Penalidades cobradas" to the detail and count them as income in Mi cartera.
- [ ] 8.5 Home "Meta de hoy" counts the full cuota even when the borrower legitimately pays the penalty. Decide whether the goal should count the penalty as met.
- [ ] 8.6 Receipt numbers skip one per extra penalty row (R-00002 → R-00004 after two penalties). Decide: one receipt number per cobro.
- [ ] 8.7 Form polish: the validation error shows the field key ("penalty: La penalidad es obligatoria"), stays after the field is filled until resubmit, and the "300" placeholder looks like a typed value.
- [ ] 8.8 Not covered end to end: Google Sheet sync on a real account (unit tests only) and the thermal printer. Run both before merge.

## Workflow follow-up

- Update the docs-site page for loan types with `/ps:docs` once shipped.
- Archive the change after the PR merges.
