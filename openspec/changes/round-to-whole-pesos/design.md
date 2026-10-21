## Context

Money is stored as integer cents (`*Cents` columns and functions). Cents currently leak in through mora (`lib/loans/mora.ts`), flat interest (`loanMath.ts` `totalInterestCents`), crédito abierto interest (`openCredit.ts`), typed amounts (`parseAmountToCents` accepts two decimals), and the receipt printer (always two decimals). Three screens also format by hand with `/ 100` + `toLocaleString`, bypassing the shared formatters. Cuotas are already rounded to the nearest peso (`roundToNearestPeso` in `loanMath.ts`).

The app is new, so there is no installed base of fractional amounts to preserve.

## Goals / Non-Goals

**Goals:**

- Every computed amount is a whole peso, so displayed figures always add up.
- Every entered amount is a whole peso.
- One formatting path, no decimals.

**Non-Goals:**

- Renaming `*Cents` columns/functions or changing the schema.
- Migrating or tolerating legacy fractional data.
- Changing what the Google Sheet receives.

## Decisions

1. **Round at the source, not at display.** Rounding only in the formatters would let hidden fractions accumulate (a RD$0.40 remainder keeps a loan "unpaid" while the screen says RD$0). Rounding where amounts are computed keeps the stored invariant: every amount is a multiple of 100. Alternative: display-only rounding — rejected for that reason.
2. **Keep cents as the storage unit.** Switching to pesos would rename or change nearly every file, the schema and the sync format for no visible benefit. A shared helper `roundToPeso(cents)` in `lib/utils/money.ts` (moving `roundToNearestPeso` out of `loanMath.ts`) is the single rounding rule: nearest peso, halves up.
3. **Reject, don't round, typed decimals.** Silently rounding "1105.50" to RD$1,106 changes what the customer owes without the lender noticing. `parseAmountToCents` returns `null` for any decimal part, and the forms' existing invalid-amount path shows a Spanish "Solo pesos enteros" message.
4. **Formatters lose the cents branch.** `formatCurrency` and `formatAmount` always use 0 fraction digits. With the invariant in place no safety net or legacy tolerance is added. The three hand-rolled screens and `lib/printer.ts` `formatRD` switch to the shared formatter.
5. **Sheet untouched.** `lib/sync` keeps sending stored cents.

## Risks / Trade-offs

- Mora and interest shift by under RD$1 versus today's values → acceptable; these are small fines and interest figures and the lender only ever sees whole pesos.
- Existing dev/test devices may hold fractional rows → no tolerance by decision; reinstall or clear the data (the emulator rebuild already wipes the DB).
- Rounding each cycle's interest independently (crédito abierto) compounds tiny differences → each cycle is rounded once, from an already whole-peso balance, so the error cannot grow beyond RD$0.50 per cycle.
