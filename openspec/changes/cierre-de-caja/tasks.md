## 1. Data seam

- [ ] 1.1 Add `cash_closes` table to `lib/db/schema.ts` (`id`, `amountCents`, `closedAt`, `createdAt`); `npm run db:generate`
- [ ] 1.2 `lib/cashClose/cashClose.schema.ts` — `CashClose` type; `closeCashSchema` (empty input — the amount is derived, not user-entered)
- [ ] 1.3 `lib/cashClose/getCashBalance.ts` (validated function) — sums `payments.amountCents` where `method != "transfer"` and `paidAt > lastClose.closedAt` (or all cash payments if no close exists yet)
- [ ] 1.4 `lib/cashClose/closeCash.ts` (validated function) — reads the current balance via `getCashBalance`; throws a `ValidationError` if balance is 0; otherwise inserts a `cash_closes` row and enqueues a `pending_mutations` row (`entity: "cashClose"`, `operation: "create"`), mirroring `createPayment`'s enqueue shape
- [ ] 1.5 Barrel `lib/cashClose/index.ts`

## 2. Repo wiring

- [ ] 2.1 Add a `CashCloseRepo` interface to `lib/repo/types.ts`: `getBalance(): Promise<number>`, `close(): Promise<CashClose>`
- [ ] 2.2 `createRealCashCloseRepo` in `lib/repo/real/cashCloseRepo.ts`, composing `getCashBalance`/`closeCash` against `db`
- [ ] 2.3 Mock `cashCloseRepo` in `lib/repo/mock/` — stateful in-memory balance seeded with a representative value
- [ ] 2.4 Wire `CashCloseRepo` into `lib/repo/RepoProvider.tsx` (both real and mock factories)

## 3. Sync

- [ ] 3.1 `lib/sync/push.ts`: add `cashClose: "Cierres!A:D"` to `ENTITY_RANGES`; add `cashCloseRowValues` mapper (`[id, amountCents, closedAt, createdAt]`) to `ROW_MAPPERS`
- [ ] 3.2 `lib/sync/provisionSheet.ts`: add `TAB_HEADERS.cashClose` (`["ID", "Monto (centavos)", "Cerrado", "Creado"]`) so the "Cierres" tab is provisioned automatically like the existing four

## 4. Design (Pencil) — do before UI wiring, per this repo's design-first convention

- [ ] 4.1 Update Cuadre General (`h48VL`) in `pencil.pen`: a "Caja" section showing the running balance and a "Cerrar caja" button, visually distinct from the existing efectivo esperado/contado card and "Cerrar día y sincronizar" action

## 5. UI wiring

- [ ] 5.1 `CuadreScreen.tsx`: display the caja balance (`useAsync(() => cashCloseRepo.getBalance(), [])`, reloaded via the same `useFocusEffect` pattern used for `route`/`today`); "Cerrar caja" button disabled when balance is 0; on press, calls `cashCloseRepo.close()` then reloads the balance

## 6. Tests

- [ ] 6.1 `getCashBalance.test.ts` — sums cash payments correctly; excludes transfers; respects the last-close cutoff (payments before a close don't count); sums everything when no close exists yet
- [ ] 6.2 `closeCash.test.ts` — creates a ledger row and a `pending_mutations` row with the correct payload; rejects (validation error, no side effect) when balance is 0
- [ ] 6.3 `push.test.ts` — a `cashClose` create mutation pushes to `Cierres!A:D` in the right column order
- [ ] 6.4 `provisionSheet.test.ts` — the "Cierres" tab's header row matches `ENTITY_RANGES.cashClose`'s width, same pattern as the existing width-guard test

## 7. Verify

- [ ] 7.1 `npm run typecheck`, `npm run lint`, `npm test` pass
- [ ] 7.2 `openspec validate cierre-de-caja` passes
- [ ] 7.3 On-device walk: collect a cash payment, confirm the caja balance rises on Cuadre; tap "Cerrar caja", confirm the balance resets and (once synced) a row appears in the real Datos sheet's "Cierres" tab
