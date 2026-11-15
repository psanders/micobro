## 1. Contract

- [x] 1.1 `OwnerPosition.month` in `lib/reports/position.schema.ts`: `capitalCollectedCents`, `interestCollectedCents`, `moraCollectedCents`
- [x] 1.2 `openCreditPaymentSplit` in `lib/loans/openCredit.ts`; `openCreditReceiptBreakdown` uses it

## 2. Tests

- [x] 2.1 `__tests__/composePosition.test.ts` "cobrado desglosado": every scenario in the spec delta and #212's acceptance criteria
- [x] 2.2 `__tests__/openCreditReceiptBreakdown.test.ts` unchanged and green

## 3. Implementation

- [x] 3.1 `composePosition` splits this month's payments
- [x] 3.2 `PortfolioReport`: "Total cobrado" plus the three rows; stories fixture

## 4. Verify

- [x] 4.1 lint, typecheck, `npm test`, format
- [x] 4.2 Demo build on the emulator: collecting a late cuota + mora moves each row by the expected amount
