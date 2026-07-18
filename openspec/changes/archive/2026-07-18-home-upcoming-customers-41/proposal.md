# Proposal: home-upcoming-customers-41

## Why

Closes #41. The Hoy screen's "Próximas visitas" card only ever shows today's
actionable route (`day.visits`, sourced from `composeRouteDay`'s "due today
or overdue" rule) and falls back to a plain "No hay visitas programadas para
hoy." empty state whenever nothing is due or overdue. On a day with no
overdue clients — which is the outcome a healthy lender's book should trend
toward — the screen goes blank under the fold, even though the lender may
have plenty of active, on-time clients whose next cuota is simply a few days
out. The issue asks to show _customers_, not more visits: it should not
redefine what counts as an actionable route stop.

## What Changes

- `composeRouteDay` gains a second, independent output alongside
  `visits`: `upcomingCustomers` — active-loan customers whose next unpaid
  installment is due _after_ today (not yet due, so explicitly excluded
  from `visits`), one entry per customer (soonest loan wins when a customer
  has more than one), sorted soonest-due-first. This does **not** change
  the inclusion rule for `visits`/`goalCents`/`clientCount`/`pendingCount`,
  so Mi Ruta (`route-view`) is untouched — it keeps meaning "today's
  actionable collection route."
- New pure builder `lib/route/composeUpcomingCustomers.ts` (composed by
  `composeRouteDay`), mirroring the existing `composeRouteDay` /
  `loanViews` pattern — no DB, fully unit-testable.
- `RouteDay` (`lib/repo/types.ts`) gains `upcomingCustomers:
UpcomingCustomer[]`. No new `RouteRepo` method or extra fetch is needed —
  it rides along on the existing `route.getToday()` call both screens
  already make.
- **Hoy screen** (`components/screens/HomeScreen.tsx`): when `day.visits`
  has nothing pending/overdue to show, the "Próximas visitas" card falls
  back to `day.upcomingCustomers` (capped at 4, matching the existing
  visits cap) instead of the plain empty-state line. Each fallback row
  shows the customer's name/avatar/address and their next cuota amount and
  date ("Próx. cuota RD$X · 22 jul"), so it reads as a distinct "coming
  soon" list rather than a duplicate of today's visits or of Buscar's
  "Mis clientes". The true empty state (no visits _and_ no upcoming
  customers — e.g. no active loans at all) is unchanged.
- Mock fixtures (`lib/repo/mock/routeFixtures.ts`) gain a small
  `upcomingCustomersFixture` for `routeDayFixture.upcomingCustomers`, for
  test/story coverage. The mock's curated demo day always has pending
  visits, so this fallback isn't visually reachable via the shipped demo
  data — same as several other structured fields it already carries.

## Capabilities

### Modified Capabilities

- `home-dashboard`: "Próximas visitas list" requirement's empty-state line
  changes — an empty day now falls back to an upcoming-customers list
  before showing the true empty state.

## Impact

- `lib/repo/types.ts` — new `UpcomingCustomer` type; `RouteDay` gains
  `upcomingCustomers`.
- `lib/route/composeUpcomingCustomers.ts` — new pure builder.
- `lib/route/composeRouteDay.ts` — composes the new builder into its
  return value; doc comment updated.
- `lib/route/index.ts` — barrel export.
- `lib/repo/mock/routeFixtures.ts` — `upcomingCustomersFixture` +
  `routeDayFixture.upcomingCustomers`.
- `components/screens/HomeScreen.tsx` — fallback rendering + copy.
- Tests: new `__tests__/composeUpcomingCustomers.test.ts`; updated
  `__tests__/composeRouteDay.test.ts` for the new field.
