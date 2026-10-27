## 1. Contract

- [x] 1.1 `OwnerPosition` in `lib/reports/position.schema.ts`: `capitalCents`, `interestCents`, past-due `overdue`

## 2. Tests (written from the contract, independently of the implementation)

- [x] 2.1 `__tests__/composePosition.test.ts`: every scenario in `design.md` and the spec delta
- [x] 2.2 `__tests__/getPosition.test.ts`: new field names

## 3. Implementation (written from the contract, independently of the tests)

- [x] 3.1 `lib/reports/composePosition.ts` per `design.md`
- [x] 3.2 `MyPortfolioScreen`: new fields, "Interés por cobrar" label
- [x] 3.3 Extract `PortfolioReport` + `PortfolioReport.stories.tsx` (Storybook "Screens/MiCartera")

## 4. Verify

- [x] 4.1 lint, typecheck, `npm test`
- [x] 4.2 portfolio simulation smoke test reconciles every figure
- [ ] 4.3 Pencil "Mi cartera — reporte" copy: "Interés por cobrar" — waived for now, validated in Storybook; owed later
