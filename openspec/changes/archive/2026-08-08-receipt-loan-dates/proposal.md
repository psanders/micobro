## Why

A receipt is the only artifact the customer keeps. Today it identifies the
payment — number, cliente, fecha, método, amounts — but says nothing about the
loan's lifetime, so neither party can tell from the paper when the loan
started or when it finishes. Lenders asked for it. Closes #108.

Neither receipt surface carried the dates, and neither did the type behind
them: `PaymentReceipt` had no loan-date fields, so the digital
(`components/ReceiptView.tsx`) and printed (`lib/printer.ts`) renderings had
nothing to show.

## What Changes

- Both receipt surfaces gain the loan's start date and its vencimiento,
  labelled per loan type, on both receipt entry points (the live one right
  after a cobro and the historical one reopened from Histórico de Pagos).
- Crédito abierto has no maturity, so its vencimiento row states the loan
  type rather than negating the field — which also makes the receipt the one
  place that says which kind of loan it is.
- Dates render `dd/mm/yyyy`. The existing `formatShortDate` is día/mes only
  (deliberately, for the collection screens); a receipt outlives the month it
  was printed in, so `Vencimiento: 31/01` would be ambiguous. A sibling
  formatter is added; `formatShortDate` is untouched.
- The printed receipt uses shorter labels than the digital one. This is
  forced, not stylistic: `lib/printer.ts` is capped at `LINE_WIDTH = 32`, and
  `Fecha de pago: 14/08, 12:14 a. m.` is 33 characters. Overflow does not
  fail — the thermal printer wraps the remainder onto its own line, which
  looks like a misprint.
- A date that isn't known drops its row instead of rendering blank, for the
  same reason.
- No schema or migration. `buildPaymentReceipt` already receives the whole
  `Loan`, so the dates come from data already in hand.

## Capabilities

### Modified Capabilities

- `collect-payment`: the receipt's contents grow by two rows, and the
  payment-date row is relabelled to stay distinguishable from them.
  `payment-history`'s "Ver recibo desde el historial" requirement already
  specifies "the same layout ... as the receipt shown right after collecting
  a payment", so it inherits this with no edit of its own.

## Impact

- `lib/utils/dates.ts` — new `formatFullDate`.
- `lib/repo/types.ts` — `PaymentReceipt` gains `loanStartDate`, `loanEndDate`,
  `isOpenCredit`.
- `lib/loans/loanViews.ts` — new `loanEndDate(loan)`; `buildPaymentReceipt`
  populates the new fields.
- `lib/payments/collectPayment.ts`, `lib/repo/mock/index.ts` — both `collect()`
  implementations populate them too.
- `components/ReceiptView.tsx`, `lib/printer.ts` — the two renderings; each
  derives its own labels from the loan-type flag rather than receiving
  pre-baked copy from a screen.
- `components/ReceiptActions.tsx`, `components/screens/PaymentConfirmedScreen.tsx`,
  `components/screens/PaymentReceiptScreen.tsx`,
  `components/screens/CollectPaymentScreen.tsx`, `app/pago-confirmado.tsx` —
  wiring. The live path crosses a router-param boundary where every value is
  a string, so the dates cross as ISO and the flag as `"true"`/`"false"`.
- Tests: `__tests__/printer.test.ts`, `__tests__/loanViews.test.ts`,
  `__tests__/getPaymentReceipt.test.ts`.
