## Why

A simulated portfolio (60 loans, 450 payments) run through `composePosition`
showed three Mi cartera figures that don't hold up:

- **Margen de beneficio** reported a term loan's _whole_ interest no matter
  how much was paid, next to an _original_ principal, so "prestado + margen"
  never matched "por cobrar" (RD$1,179,350 vs RD$887,448). For crédito
  abierto it added the next cycle's interest, which isn't in "por cobrar" yet.
- **En atraso** reported the entire balance of any loan with one late cuota
  (RD$273,306 vs RD$160,806 actually past due) — one cuota a day late made
  a 12-cuota loan 100% "en atraso".
- **Cobrado este mes** dropped every payment on a loan that is now settled,
  usually the month's largest ones (RD$97,613 vs RD$155,801 received).

## What Changes

- "Prestado activo" becomes the **capital still to collect**; the margin row
  becomes **"Interés por cobrar"**, the interest still inside "por cobrar".
  The two always add up to "por cobrar".
- "En atraso" becomes the **amount actually past due** — the same cuotas
  the loan screen marks ATRASO, or a crédito abierto's intereses sumados; a
  loan is late only when that amount is above zero.
- "Cobrado" counts **every payment made this month**, whatever the loan's
  current state.

## Capabilities

### Modified Capabilities

- `owner-position`: the figures above change meaning.

## Impact

- `lib/reports/position.schema.ts`, `lib/reports/composePosition.ts`
- `components/screens/MyPortfolioScreen.tsx` (one label)
- `__tests__/composePosition.test.ts`, `__tests__/getPosition.test.ts`
- `designs/app.pen` "Mi cartera — reporte" label copy
