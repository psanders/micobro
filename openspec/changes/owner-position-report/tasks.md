## 1. Domain

- [ ] 1.1 `lib/reports/position.schema.ts`: `OwnerPosition` type
- [ ] 1.2 `lib/reports/composePosition.ts`: pure composer over loans + payments + today
- [ ] 1.3 `lib/reports/getPosition.ts` validated-function factory + `index.ts`
- [ ] 1.4 `ReportsRepo` in `lib/repo/types.ts`, real repo, mock repo (+ fixture), wire into `Repos`/`RepoProvider`

## 2. UI

- [ ] 2.1 `MyPositionScreen` per the approved design, `app/mi-posicion.tsx`, `_layout` entry
- [ ] 2.2 "Mi posición" quick action on `HomeScreen`

## 3. Tests

- [ ] 3.1 `composePosition` scenarios (mixed loans, late loan, empty, archived/settled, month outlook)
- [ ] 3.2 `getPosition` reads the tables and rejects invalid input
- [ ] 3.3 lint, typecheck, `npm test`

## 4. Design sync

- [ ] 4.1 Update the Pencil copy to "de lo por cobrar" and "POR COBRAR POR TIPO"
