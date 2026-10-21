## 1. Domain

- [x] 1.1 `lib/reports/position.schema.ts`: `OwnerPosition` type
- [x] 1.2 `lib/reports/composePosition.ts`: pure composer over loans + payments + today
- [x] 1.3 `lib/reports/getPosition.ts` validated-function factory + `index.ts`
- [x] 1.4 `ReportsRepo` in `lib/repo/types.ts`, real repo, mock repo (+ fixture), wire into `Repos`/`RepoProvider`

## 2. UI

- [x] 2.1 `MyPortfolioScreen` per the approved design, `app/mi-cartera.tsx`, `_layout` entry
- [x] 2.2 "Mi cartera" row in `ProfileScreen` (Mi cuenta)

## 3. Tests

- [x] 3.1 `composePosition` scenarios (mixed loans, late loan, empty, archived/settled, month outlook)
- [x] 3.2 `getPosition` reads the tables and rejects invalid input
- [x] 3.3 lint, typecheck, `npm test`

## 4. Design sync

- [x] 4.1 Update the Pencil copy to "de lo por cobrar" and "POR COBRAR POR TIPO", "Margen de beneficio (interés)"
