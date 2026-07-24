# Tasks: open-credit-loans

## 1. Schema + migration

- [x] 1.1 `lib/db/schema.ts` — nullable `loan_type` text column on `loans`.
- [x] 1.2 `npm run db:generate` (do not hand-edit).

## 2. Domain — model + cycle engine

- [x] 2.1 `lib/loans/loan.schema.ts` — `loanType` (`"term" | "open_credit"`);
      `Loan.loanType`; `createLoanSchema` makes `termCount` optional for open
      credit (required for term); interest is per-cycle for open credit.
- [x] 2.2 `lib/loans/openCredit.ts` (new, pure) — cycle-replay engine:
      `openCreditState(loan, payments, today)` returning current
      `balanceCents`, `interestDueCents`, `cycles[]` (each: index, window,
      interestDue, paid, capitalPaid, status
      `paid|interest_only|interest_plus_capital|skipped|pending`), and
      `isClosed` (balance 0). Interest = balance × rate per cycle; payments
      cover interest first then capital; a cycle short of interest by its end
      capitalizes the shortfall. No mora.
- [x] 2.3 Export from `lib/loans/index.ts`.

## 3. Create flow

- [x] 3.1 `lib/loans/createLoan.ts` + `lib/repo/mock/index.ts` — persist
      `loanType`; open-credit loans store capital/rate/frequency, no termCount.
- [x] 3.2 `NewLoanFormScreen.tsx` — Tipo de préstamo gains "Crédito Abierto";
      selecting it hides Plazo (cuotas) and the Primer-pago/mora specifics as
      appropriate, and labels interest as per-cycle.

## 4. Detail view (06c)

- [x] 4.1 `lib/loans/getLoanDetailView.ts` + repo types — open-credit branch:
      Capital pendiente, Interés pendiente, próximo pago, Historial de ciclos.
- [x] 4.2 `components/screens/LoanDetailScreen.tsx` — render the open-credit
      variant per the `06c Crédito Abierto Detalle` design.

## 5. Collect flow (07c)

- [x] 5.1 `lib/payments/getCollectContext.ts` — open-credit branch: interest
      due, Solo interés vs Interés + capital, "después del pago" preview.
- [x] 5.2 `lib/payments/collectPayment.ts` — record an open-credit payment
      (amount = interest + optional capital); close the loan when balance → 0.
      (No change needed: `moraCents: 0` already yields one clean row — verified
      by `__tests__/collectOpenCredit.test.ts`; closing stays derived via
      `openCreditState.isClosed`, never stored.)
- [x] 5.3 `components/screens/CollectPaymentScreen.tsx` — open-credit variant
      per `07c Cobrar Crédito Abierto`.

## 6. Sync

- [x] 6.1 `push.ts` / `pull.ts` / `provisionSheet.ts` — `loan_type` column.

## 7. Tests

- [x] 7.1 `__tests__/openCredit.test.ts` — cycle engine: interest-only holds
      balance; interest+capital reduces balance and next interest; skip
      capitalizes; close on zero; first interest one cycle out. Worked example
      from the design (RD$10,000 @ 5%/cycle).
- [x] 7.2 `createLoan` open-credit + validation-failure case.
- [x] 7.3 collect open-credit; push/pull round-trip `loan_type`. (push/pull done
      Pass 1; collect covered in Pass 2 by `__tests__/collectOpenCredit.test.ts` + `getLoanDetailView.test.ts`/`getCollectContext.test.ts`'s open-credit
      branches)
- [x] 7.4 Fixtures: add an open-credit exemplar loan; `loanType` on all loans.

## 8. Verify

- [x] 8.1 `tsc --noEmit`; `npm run lint`; `npx jest` — all green. (Pass 1: 289/289; re-run after Pass 2)
- [ ] 8.2 Manual test on emulator: create an open-credit loan, view detail,
      collect interés-only and interés+capital.

## 9. Design parity (Pencil)

- [ ] 9.1 The two screens (06c/07c) already exist and are in the Collectors
      cluster; add the "Crédito Abierto" option to the Nuevo Préstamo design.
