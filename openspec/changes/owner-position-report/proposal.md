## Why

A lender has no single view of their own position: how much money is out on the street, how much of it is late, and what the month is likely to bring in. Today they would have to open every loan and add it up by hand.

## What Changes

- New "Mi posición" report: capital lent, amount still to collect, and amount collected so far.
- A "en atraso" figure with its share of what is to collect and the number of late loans.
- The still-to-collect amount split by loan type (término fijo vs crédito abierto).
- A "este mes" block: collected so far, still due this month, and the best-case month-end total.
- Entry from the Hoy screen. Everything is derived on read from loans and payments (no new tables, no sync changes).
- No trends, collection-rate estimates or per-customer rankings.

## Capabilities

### New Capabilities

- `owner-position`: the lender's own financial position — lent, to collect, collected, late, by loan type, and this month's outlook.

### Modified Capabilities

## Impact

- New `lib/reports/` (pure composer + validated-function factory), a `reports` repo (real + mock), `MyPositionScreen` + `app/mi-posicion.tsx`, a Hoy quick action.
- Tests for the composer and the factory. No schema, sync or dependency changes.
