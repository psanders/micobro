# Proposal: 3-mi-ruta-domain

## Why

`lib/repo/real/routeRepo.ts` always returns a zeroed empty day — there is no
domain for "which customers to visit today, in what order, for how much."
That was spec-compliant (`route-view` explicitly required an empty real
state, since no visits domain existed), but it means Mi Ruta — one of the
four main tabs — and the Home "Meta de hoy" hero are permanently empty for
every real user (GitHub issue #3). This change builds the real domain.

A parallel change (#6) is reworking cuota/interest/schedule math in
`lib/loans/`. This change does not touch or reimplement any of that math —
it composes today's route entirely from the existing public builders
(`buildLoanDetailView`, `computeLoanMora` in `lib/loans/loanViews.ts` and
`lib/loans/mora.ts`) the same way `getLoanDetailView.ts` already does for
the Préstamo Detalle screen. Route amounts will auto-correct once #6 lands.

## What Changes

- **New `lib/route/` domain**: `composeRouteDay.ts`, a pure function that
  takes every customer, loan, and payment plus an injectable "today" and
  returns a `RouteDay` — no DB access, fully unit-testable. `getRouteDay.ts`
  wraps it as a validated-function DB read (customers/loans/payments,
  three full-table selects, matching the existing `listLoans`/
  `listPaymentsToday` pattern).
- **Inclusion rule**: an active loan gets a visit when its earliest unpaid
  installment — as of _before_ today's payments — is due today or overdue.
  One visit per loan (so one customer with two active loans can get two
  visits). Payments made today are deliberately excluded from that
  "earliest unpaid" snapshot; otherwise a cobro collected this morning
  would advance the loan's next due date and the visit would vanish from
  the route instead of showing as done.
- **Amount**: `dueTodayCents` from `buildLoanDetailView` — the same
  "Total a pagar hoy" figure the Préstamo Detalle screen shows (bare cuota
  when nothing is overdue; overdue cuota(s) + accrued mora when there is).
- **Ordering**: ascending by the earliest unpaid due date. Overdue due
  dates are always earlier than today's due dates, so this single sort key
  produces "most overdue first, then today's-due" for free.
- **Status**: `overdue` (due date in the past, nothing collected today),
  `pending` (due today, nothing collected today), or `done` (any payment
  recorded against the loan today — `paidAt` is the latest such payment).
  This change does not produce `promise`-status visits; that requires
  wiring the existing `visits`/outcome domain into the route, which is
  left as a follow-up.
- **Aggregates**: `goalCents` sums each visit's expected `dueTodayCents`;
  `collectedCents` sums today's actual payment amounts against route
  loans (not the expected amount, so partial/short payments show
  honestly); `clientCount` is the count of distinct customers across
  visits; `pendingCount` is visits not yet `done`.
- **`createRealRouteRepo({ db })`** now takes a `db` dependency (previously
  none) and delegates to `getRouteDay`. Updated at its one call site in
  `lib/repo/real/index.ts`.

## Capabilities

### Modified Capabilities

- `route-view`: the real client now composes today's visits from
  due/overdue installments instead of always returning an empty day.

## Impact

- `lib/route/` — new domain: `composeRouteDay.ts` (pure), `getRouteDay.ts`
  (validated-function DB read), barrel `index.ts`.
- `lib/repo/real/routeRepo.ts` — composes instead of returning zeros;
  `lib/repo/real/index.ts` passes `db` to `createRealRouteRepo`.
- `lib/repo/types.ts` — `RouteRepo`'s doc comment updated to describe real
  composition; no interface/shape changes (`RouteDay`/`RouteVisit` are
  unchanged, so `RouteScreen`/`HomeScreen`/`CuadreScreen`/`ProfileScreen`
  need no changes).
- No DB schema changes; no new tables.
- `__tests__/composeRouteDay.test.ts` (new) and `__tests__/routeRepo.test.ts`
  (updated) — the empty-day assertion moves from "always" to "empty
  tables"; the composition rules are covered with a fixed injected "today".
