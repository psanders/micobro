# Tasks: loan-grace-period

## 1. Schema + loan configuration

- [x] 1.1 `lib/db/schema.ts` — nullable `loans.graceDays` column
- [x] 1.2 `npm run db:generate` — migration `0006_unknown_mastermind.sql`
- [x] 1.3 `lib/loans/loan.schema.ts` — `DEFAULT_GRACE_DAYS = 7`;
      `createLoanSchema` gains optional `graceDays`; `Loan.graceDays`
- [x] 1.4 `lib/loans/createLoan.ts` + `lib/repo/mock/index.ts`'s
      `createLoan` — persist `graceDays` (`params.graceDays ?? null`)

## 2. Wire grace into mora accrual

- [x] 2.1 `lib/loans/mora.ts` — `effectiveGraceDays(loan)` /
      `loanMoraPolicy(loan)` helpers; `DEFAULT_MORA_POLICY` left as the
      formula-level (no-grace) default
- [x] 2.2 `lib/customers/getCustomerDetail.ts`,
      `lib/loans/getLoanDetailView.ts`, `lib/payments/getCollectContext.ts`,
      `lib/route/composeRouteDay.ts` — every `computeLoanMora` call site
      passes `loanMoraPolicy(loan)`
- [x] 2.3 `lib/loans/index.ts` barrel — export the new symbols

## 3. Nuevo Préstamo form

- [x] 3.1 `components/screens/NewLoanFormScreen.tsx` — "Período de gracia
      (días)" numeric field, pre-filled with `DEFAULT_GRACE_DAYS`

## 4. Sync round-trip

- [x] 4.1 `lib/sync/push.ts` — `ENTITY_RANGES.loan` → `Préstamos!A:L`,
      `loanRowValues` emits `graceDays`
- [x] 4.2 `lib/sync/pull.ts` — `rowToLoan` parses the new column
- [x] 4.3 `lib/sync/provisionSheet.ts` — `TAB_HEADERS.loan` gains the
      header (width still guarded by the existing
      `provisionSheet.test.ts` test)

## 5. Fixtures + tests

- [x] 5.1 `lib/repo/mock/fixtures.ts` — every loan fixture gets an explicit
      `graceDays: null`
- [x] 5.2 `__tests__/mora.test.ts` — `effectiveGraceDays`, `loanMoraPolicy`,
      end-to-end grace suppression/accrual via `computeLoanMora`
- [x] 5.3 `__tests__/composeRouteDay.test.ts` — grace-suppressed mora on a
      still-within-grace overdue visit (status stays "overdue", `hasMora`
      false) and a per-loan `graceDays: 0` override
- [x] 5.4 `__tests__/push.test.ts` / `__tests__/pull.test.ts` — updated for
      the 12-column loan row
- [x] 5.5 `npx jest`, `npx tsc --noEmit`, `npx eslint` on changed files —
      all clean

## 6. Spec reconcile

- [x] 6.1 `specs/loan-detail/spec.md` delta — MODIFIED "Total a pagar hoy"
      (mora is grace-gated) and "Plan de pagos schedule" (ATRASO stays
      due-date-only; clarifying note)
- [x] 6.2 `openspec validate 43-loan-grace-period --strict`
