# Tasks: customer-detail-open-credit

## 1. Design (Pencil)

- [x] 1.1 `05c Cliente Detalle — Crédito Abierto` screen in the
      `Visit & Collection Flow` section, in the open-credit sub-chain
      (after the `I803X` arrow, before `06c Crédito Abierto Detalle`).
- [x] 1.2 Owner approval on the design.

## 2. Types + view model

- [x] 2.1 `lib/repo/types.ts` — `CustomerLoanSummary` gains an optional
      open-credit shape: outstanding capital, capital-paid ratio (0–1,
      clamped), and next-cycle interest. Term loans keep the existing
      `installmentsPaid`/`installmentsTotal` fields.
- [x] 2.2 `lib/loans/loanViews.ts` — `buildCustomerLoanSummary` branches on
      `effectiveLoanType(loan)`, taking an optional `OpenCreditState` for the
      open-credit case rather than reading term-only schedule fields.

## 3. Data path

- [x] 3.1 `lib/customers/getCustomerDetail.ts` — branch on
      `effectiveLoanType`: use `openCreditState` for open-credit loans, skip
      `computeLoanMora` for them (open credit accrues no mora, so they must
      never drive the standing pill to "En mora").
- [x] 3.2 Same file — activity descriptions become "Pago ciclo <n>" for
      open-credit payments, keeping "Pago cuota <n>" for term loans and
      "Pago de mora" for mora rows.
- [x] 3.3 `lib/repo/mock/index.ts` — mirror 3.1 and 3.2 in the mock
      `getDetail`, so mock mode and Storybook match real mode. (The mock's
      `viewOf` already branches on `effectiveLoanType`; `getDetail` does not.)

## 4. Screen

- [x] 4.1 Extract the loan card into `components/LoanSummaryCard.tsx` (this
      repo's Storybook covers component kits, never whole screens — see
      `CuotaRow`/`KvRow`/`MetaChip`), with a `Kit/*` story showing the term
      variant, the open-credit variant, and the 0%-clamped variant.
- [x] 4.2 `components/screens/CustomerDetailScreen.tsx` — render
      `LoanSummaryCard`; open-credit variant shows "Capital pagado <n>%",
      a capital-repaid progress bar, and the interest-based due label;
      term loans render exactly as before.

## 5. Tests

- [x] 5.1 `__tests__/getCustomerDetail.test.ts` — open-credit loan yields a
      summary with capital-paid ratio and next-cycle interest, no cuota
      count; a capitalized-over-principal balance clamps to 0%; an
      open-credit loan with a skipped cycle leaves standing "al_dia";
      activity rows read "Pago ciclo N"; term-loan behavior unchanged.
- [x] 5.2 A validation-failure case asserting the structured
      `ValidationError` and that no query ran.
- [x] 5.3 `npm run lint`, typecheck, and `npm test` green.
