## 1. Bug fix — retry query and stuck count (do first, everything else depends on it)

- [x] 1.1 In `lib/sync/push.ts`, widen the push query to `status IN ('pending', 'failed') AND retryCount < MAX_RETRIES`
- [x] 1.2 In `lib/repo/real/syncRepo.ts`, widen `getStatus()`'s pending query to the same predicate
- [x] 1.3 Add `stuckCount` to `getStatus()` — `status = 'failed' AND retryCount >= MAX_RETRIES`
- [x] 1.4 Add `stuckCount: number` to `SyncStatus` (`lib/repo/types.ts`) and to the mock repo's status shape
- [x] 1.5 `SyncSettingsScreen` renders a distinct "necesita atención" line when `stuckCount > 0`

## 2. Dependency

- [x] 2.1 `npx expo install @react-native-community/netinfo` (promote the existing transitive dependency to direct)

## 3. Event bus (`lib/sync/syncEvents.ts`)

- [x] 3.1 Implement a tiny typed pub/sub: `notifyMutationQueued()` and `onMutationQueued(cb): () => void`
- [x] 3.2 Wire `customerRepo.create`, `loanRepo.create`, `paymentRepo.create`/`collect`, `visitRepo.record` (real repos only) to call `notifyMutationQueued()` after their underlying domain call resolves

## 4. Auto-push policy (`lib/sync/autoPushPolicy.ts`)

- [x] 4.1 Implement `shouldAutoPush({ isOnline, isPushing, pendingCount }): boolean`

## 5. SyncProvider (`lib/sync/SyncProvider.tsx`)

- [x] 5.1 Subscribe to `NetInfo.addEventListener` for `isOnline` (event-driven, no polling)
- [x] 5.2 Hold `status` (from `syncRepo.getStatus()`), refreshed on mount, on `onMutationQueued`, on reconnect, and after every push attempt
- [x] 5.3 Implement `push(silent: boolean)` guarded by a `pushingRef`/`isPushing` in-flight lock; `!silent` failures alert, `silent` failures only log
- [x] 5.4 Track offline→online transition via a `wasOnlineRef`; on transition, call `shouldAutoPush` after refreshing status and push silently if true
- [x] 5.5 On `onMutationQueued`, refresh status, call `shouldAutoPush`, push silently if true
- [x] 5.6 Expose `{ isOnline, isPushing, status, push }` via context; mount `SyncProvider` in `app/_layout.tsx` inside `RepoProvider`

## 6. Wire manual push through the shared guard

- [x] 6.1 `SyncSettingsScreen`'s "Sincronizar ahora" calls the provider's `push(false)` instead of `syncRepo.pushNow()` directly
- [x] 6.2 `CuadreScreen`'s push call does the same

## 7. Sync status pill (Home + Ajustes)

- [x] 7.1 Design pass in Pencil (`pencil.pen`) for the Hoy header pill's four states — Sincronizado / Pendiente de sincronizar / Necesita atención / No conectado — colors and copy
- [x] 7.2 Implement `lib/sync/syncStatusLabel.ts`: pure `computeSyncStatusLabel({ isSignedIn, isOnline, pendingCount, stuckCount })` returning the four-state priority (not_connected > needs_attention > pending > synced)
- [x] 7.3 `HomeScreen.tsx` uses `SyncProvider`'s `isOnline`/`status` + `computeSyncStatusLabel` to render the pill per the Pencil design, replacing the current `status.connected ? "Conectado" : "Sin conexión"` binary
- [x] 7.4 `SyncSettingsScreen.tsx` uses the same function for its status line, alongside the existing pendingCount/stuckCount detail

## 8. Tests

- [x] 8.1 `push.test.ts` — add a case: a `status: "failed"` row below the retry cap is included in the push query
- [x] 8.2 `syncRepo`/status test — `pendingCount` includes retryable-failed rows; `stuckCount` includes only retry-cap-exhausted rows
- [x] 8.3 `autoPushPolicy.test.ts` — table-test `shouldAutoPush` across online/pushing/pendingCount combinations
- [x] 8.4 `syncEvents.test.ts` — `notifyMutationQueued` invokes all subscribed callbacks; unsubscribe stops delivery
- [x] 8.5 `syncStatusLabel.test.ts` — table-test `computeSyncStatusLabel` across all state combinations, confirming priority order (a stuck mutation wins over merely offline, etc.)

## 9. Verify

- [x] 9.1 `npm run typecheck`, `npm run lint`, `npm test` pass
- [x] 9.2 On device/emulator: create a customer while online → confirm it appears in `Datos` without opening Ajustes; toggle airplane mode on/off with a queued mutation → confirm it pushes on reconnect without user action. Done 2026-07-18 against the real connected Datos sheet: created "QA SyncTest" while offline (queued), re-enabled connectivity, and the reconnect trigger auto-pushed it with no manual action — confirmed via Sincronización con Google's "Último respaldo" timestamp matching the reconnect moment and "Pendientes por respaldar: 0".
- [x] 9.3 On device/emulator: confirm the Hoy pill now reads "Pendiente de sincronizar" (not "Sincronizado"/"Conectado") when connectivity is cut with the app already open — the exact gap found this session. Done 2026-07-18: cut wifi+data via `adb shell svc wifi/data disable` with Home open — pill flipped from "Sincronizado" to "Pendiente de sincronizar" immediately (NetInfo event-driven, no polling delay), then back to "Sincronizado" on reconnect.
