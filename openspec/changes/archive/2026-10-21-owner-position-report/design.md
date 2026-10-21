## Context

Loans, payments and the loan math (`loanViews.ts`, `openCredit.ts`) already exist; `composeRouteDay.ts` shows the pattern of a pure composer fed by a thin validated-function reader. The screen design is approved (`designs/app.pen`, "Mi cartera — reporte").

## Goals / Non-Goals

**Goals:** a report whose numbers are sums plus one percentage, reusing the existing loan math so it always agrees with loan detail.

**Non-Goals:** trends, collection-rate projections, per-customer views, mora in the projection, exporting.

## Decisions

1. **Pure `composePosition({ loans, payments, today })`**, wrapped by `createGetPosition({ db })` (validated-function pattern), exposed through a new `reports` repo with real and mock implementations like `route`.
2. **Only active loans count** (`status === "active"`) and only those that still owe something (balance above zero).
3. **Definitions (all from existing math):**
   - _Prestado activo_: term loan → `principalCents`; crédito abierto → `principalBalanceCents` (capital pendiente).
   - _Por cobrar_: the loan's `balanceCents` (term: total to repay minus paid; open credit: balance incl. intereses sumados).
   - _Margen de beneficio_: the interest earned on those loans — term: the loan's total interest; crédito abierto: intereses sumados plus the interest the next payment will cost.
   - _En atraso_: por cobrar of loans with an unpaid installment past its due date (term) or with intereses sumados above zero (open credit). Percent is of por cobrar, rounded.
   - _Este mes_: cobrado = payments dated in the current month on those loans; falta = for term loans, installments due by month end minus paid so far (never below zero); for open credit, the catch-up amount if its next due date is by month end. Best case = cobrado + falta.
4. **Percentage of por cobrar, not of prestado**, so numerator and denominator are the same kind of amount (balance includes interest). The design copy changes to "de lo por cobrar".
5. **Type rows show por cobrar** so they add up to the headline.
6. **Entry point**: a "Mi cartera" row in Mi cuenta under a "Mi negocio" section; it is a report, not a primary action, so Hoy stays untouched.

## Risks / Trade-offs

- Mora is excluded from falta, so the best case is slightly conservative → stated in the note ("Si todos pagan a tiempo").
- Reading every loan and payment on each open is O(n) → fine at on-device scale, same as the route.
