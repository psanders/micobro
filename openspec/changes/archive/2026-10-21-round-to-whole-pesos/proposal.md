## Why

Lenders in the Dominican Republic deal in whole pesos; centavos mean nothing in this market. Today cents leak into the app from several places (mora, interest, typed payments, receipts), so screens show amounts like RD$1,105.50 that nobody will ever collect. The app is new, so we can fix it at the source instead of papering over it.

## What Changes

- Every amount the app computes is rounded to the nearest whole peso at the source: flat interest, mora, and crédito abierto interest.
- Payment and principal inputs accept whole pesos only; a decimal entry is rejected with a clear Spanish message.
- Amounts display without decimals everywhere, through the shared formatters (the three screens that format by hand switch to them).
- Printed receipts show whole pesos.
- **BREAKING**: no legacy handling. Storage stays in cents (always a multiple of 100) with unchanged column and function names, but there is no migration and no tolerance for previously stored fractional amounts.
- The synced Google Sheet keeps the raw stored values.

## Capabilities

### New Capabilities

- `whole-peso-amounts`: every monetary amount the lender enters, sees or prints is a whole peso, and every computed amount is rounded to the nearest peso at the source.

### Modified Capabilities

## Impact

- `lib/loans/loanMath.ts`, `lib/loans/mora.ts`, `lib/loans/openCredit.ts` — round to the peso.
- `lib/utils/money.ts` — `parseAmountToCents` whole-peso only; `formatCurrency` / `formatAmount` drop the cents branch.
- `lib/printer.ts` — receipt amounts without decimals.
- `components/screens/LoanDetailScreen.tsx`, `CollectPaymentScreen.tsx`, `PaymentHistoryScreen.tsx` — use shared formatters.
- Amount inputs in the loan and payment forms — whole-peso validation message.
- Tests for each of the above. No schema change, no dependency change.
