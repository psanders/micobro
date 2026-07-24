# Tasks: 3-mi-ruta-domain

## 1. Route composition domain

- [x] 1.1 `lib/route/composeRouteDay.ts` — pure function: inclusion
      (due-today-or-overdue, snapshotted before today's payments),
      ordering (ascending due date), status (overdue/pending/done),
      aggregates (goalCents/collectedCents/clientCount/pendingCount).
      Consumes `buildLoanDetailView` + `computeLoanMora` from `lib/loans/`
      — no loan math reimplemented.
- [x] 1.2 `lib/route/getRouteDay.ts` — validated-function DB read
      (customers/loans/payments full-table selects) delegating to
      `composeRouteDay`.
- [x] 1.3 `lib/route/index.ts` barrel.
- [x] 1.4 `lib/repo/real/routeRepo.ts` — `createRealRouteRepo({ db })`
      wraps `getRouteDay`; `lib/repo/real/index.ts` passes `db`.
- [x] 1.5 `lib/repo/types.ts` — update `RouteRepo`'s doc comment.

## 2. Tests & gates

- [x] 2.1 `__tests__/composeRouteDay.test.ts`: empty day (nothing due,
      loan fully paid, inactive loan), overdue-before-today's-due ordering + amount (cuota + mora), done-vs-pending after a today payment,
      goal/collected/client/pending aggregates — fixed injected `today`.
- [x] 2.2 `__tests__/routeRepo.test.ts` updated: empty-tables zeroed day,
      confirms all three tables are read.
- [x] 2.3 Walked `RouteScreen`/`HomeScreen`/`CuadreScreen`/`ProfileScreen`
      field usage against `RouteVisit`/`RouteDay` to confirm every field
      the real composer populates is the field those screens read (no UI
      changes needed — the shape is unchanged from the mock).
- [x] 2.4 `npm run lint`, `npm run typecheck`, `npm run test`,
      `npm run format:check` all green.
- [x] 2.5 `openspec validate 3-mi-ruta-domain --strict`.
