# Tasks: home-upcoming-customers-41

## 1. Data layer

- [x] 1.1 `lib/repo/types.ts` — add `UpcomingCustomer`; `RouteDay` gains
      `upcomingCustomers: UpcomingCustomer[]`
- [x] 1.2 `lib/route/composeUpcomingCustomers.ts` — pure builder: active
      loans whose next unpaid installment is due after today, deduped to
      one entry per customer (soonest loan wins), sorted soonest-first
- [x] 1.3 `lib/route/composeRouteDay.ts` — composes the new builder into
      its return value; doc comment updated to describe the new field
- [x] 1.4 `lib/route/index.ts` — barrel export for the new builder

## 2. Mock fixtures

- [x] 2.1 `lib/repo/mock/routeFixtures.ts` — `upcomingCustomersFixture` +
      `routeDayFixture.upcomingCustomers`

## 3. Hoy screen

- [x] 3.1 `components/screens/HomeScreen.tsx` — fall back to
      `day.upcomingCustomers` (capped at 4) when there's nothing
      pending/overdue to show, with distinct copy/labeling from both the
      due-today rows and Buscar's "Mis clientes"; true empty state
      (neither visits nor upcoming customers) unchanged

## 4. Tests

- [x] 4.1 New `__tests__/composeUpcomingCustomers.test.ts` — inclusion
      rule (future due date only, active loans only, fully-paid loans
      excluded), one-entry-per-customer dedup, sort order
- [x] 4.2 Update `__tests__/composeRouteDay.test.ts` for the new
      `upcomingCustomers` field on `RouteDay`
- [x] 4.3 lint/typecheck/test green

## 5. Spec reconcile

- [x] 5.1 `specs/home-dashboard/spec.md` delta — MODIFIED "Próximas
      visitas list" empty-state behavior
- [x] 5.2 `openspec validate home-upcoming-customers-41 --strict`
