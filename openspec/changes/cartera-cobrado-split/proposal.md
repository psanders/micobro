## Why

Mi cartera's "Este mes" shows one "Cobrado" total, so a lender who wants to
know what they earned this month (interest, mora, penalidades) versus capital
coming back has to add up receipts by hand (#212).

## What Changes

- "Cobrado" becomes **"Total cobrado"**, with three rows under it that always
  add up to it: **"Capital cobrado"**, **"Interés cobrado"** and **"Mora y
  penalidades"**.
- A term cuota carries its loan's flat interest share, the same rule as
  "Interés por cobrar"; a crédito abierto cobro is split like its receipt
  (cycle interest, then intereses sumados, then capital). Mora and penalidad
  payments go to their own row.
- The progress bar, "Falta por cobrar" and the month-end note are unchanged.

## Capabilities

### Modified Capabilities

- `owner-position`: "This month's outlook" breaks cobrado down.

## Impact

- `lib/reports/position.schema.ts`, `lib/reports/composePosition.ts`
- `lib/loans/openCredit.ts`: the receipt's split moves into `openCreditPaymentSplit`, with the same output
- `components/PortfolioReport.tsx`, `components/PortfolioReport.stories.tsx`
- `__tests__/composePosition.test.ts`
- `designs/app.pen` "Mi cartera — reporte" (Cobrado desglose, approved)
