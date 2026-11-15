# Tasks

- [x] Add `daysPastEnd` to `RouteVisit`, set by `composeRouteDay` from `loanEndDate(loan, paymentsBeforeToday)`
- [x] Move Mi ruta's chip rules into `lib/route/routeFilters.ts` with Vencidos = past the end date
- [x] Read the vencido row as "Venció hace N días" from the end date, singular for one
- [x] Keep one vencido in the mock route
- [x] Tests: `composeRouteDay`, `routeFilters`, `routeRepo`
