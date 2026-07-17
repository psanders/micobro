## 1. Bug fix — retry query and stuck count (do first, everything else depends on it)

- [ ] 1.1 In `lib/sync/push.ts`, widen the push query to `status IN ('pending', 'failed') AND retryCount < MAX_RETRIES`
- [ ] 1.2 In `lib/repo/real/syncRepo.ts`, widen `getStatus()`'s pending query to the same predicate
- [ ] 1.3 Add `stuckCount` to `getStatus()` — `status = 'failed' AND retryCount >= MAX_RETRIES`
- [ ] 1.4 Add `stuckCount: number` to `SyncStatus` (`lib/repo/types.ts`) and to the mock repo's status shape
- [ ] 1.5 `SyncSettingsScreen` renders a distinct "necesita atención" line when `stuckCount > 0`

## 2. Dependency

- [ ] 2.1 `npx expo install @react-native-community/netinfo` (promote the existing transitive dependency to direct)

## 3. Event bus (`lib/sync/syncEvents.ts`)

- [ ] 3.1 Implement a tiny typed pub/sub: `notifyMutationQueued()` and `onMutationQueued(cb): () => void`
- [ ] 3.2 Wire `customerRepo.create`, `loanRepo.create`, `paymentRepo.create`/`collect`, `visitRepo.record` (real repos only) to call `notifyMutationQueued()` after their underlying domain call resolves

## 4. Auto-push policy (`lib/sync/autoPushPolicy.ts`)

- [ ] 4.1 Implement `shouldAutoPush({ isOnline, isPushing, pendingCount }): boolean`

## 5. SyncProvider (`lib/sync/SyncProvider.tsx`)

- [ ] 5.1 Subscribe to `NetInfo.addEventListener` for `isOnline` (event-driven, no polling)
- [ ] 5.2 Hold `status` (from `syncRepo.getStatus()`), refreshed on mount, on `onMutationQueued`, on reconnect, and after every push attempt
- [ ] 5.3 Implement `push(silent: boolean)` guarded by a `pushingRef`/`isPushing` in-flight lock; `!silent` failures alert, `silent` failures only log
- [ ] 5.4 Track offline→online transition via a `wasOnlineRef`; on transition, call `shouldAutoPush` after refreshing status and push silently if true
- [ ] 5.5 On `onMutationQueued`, refresh status, call `shouldAutoPush`, push silently if true
- [ ] 5.6 Expose `{ isOnline, isPushing, status, push }` via context; mount `SyncProvider` in `app/_layout.tsx` inside `RepoProvider`

## 6. Wire manual push through the shared guard

- [ ] 6.1 `SyncSettingsScreen`'s "Sincronizar ahora" calls the provider's `push(false)` instead of `syncRepo.pushNow()` directly
- [ ] 6.2 `CuadreScreen`'s push call does the same

## 7. Sync status pill (Home + Ajustes)

- [ ] 7.1 Design pass in Pencil (`pencil.pen`) for the Hoy header pill's four states — Sincronizado / Pendiente de sincronizar / Necesita atención / No conectado — colors and copy
- [ ] 7.2 Implement `lib/sync/syncStatusLabel.ts`: pure `computeSyncStatusLabel({ isSignedIn, isOnline, pendingCount, stuckCount })` returning the four-state priority (not_connected > needs_attention > pending > synced)
- [ ] 7.3 `HomeScreen.tsx` uses `SyncProvider`'s `isOnline`/`status` + `computeSyncStatusLabel` to render the pill per the Pencil design, replacing the current `status.connected ? "Conectado" : "Sin conexión"` binary
- [ ] 7.4 `SyncSettingsScreen.tsx` uses the same function for its status line, alongside the existing pendingCount/stuckCount detail

## 8. Tests

- [ ] 8.1 `push.test.ts` — add a case: a `status: "failed"` row below the retry cap is included in the push query
- [ ] 8.2 `syncRepo`/status test — `pendingCount` includes retryable-failed rows; `stuckCount` includes only retry-cap-exhausted rows
- [ ] 8.3 `autoPushPolicy.test.ts` — table-test `shouldAutoPush` across online/pushing/pendingCount combinations
- [ ] 8.4 `syncEvents.test.ts` — `notifyMutationQueued` invokes all subscribed callbacks; unsubscribe stops delivery
- [ ] 8.5 `syncStatusLabel.test.ts` — table-test `computeSyncStatusLabel` across all state combinations, confirming priority order (a stuck mutation wins over merely offline, etc.)

## 9. Verify

- [ ] 9.1 `npm run typecheck`, `npm run lint`, `npm test` pass
- [ ] 9.2 On device/emulator: create a customer while online → confirm it appears in `Datos` without opening Ajustes; toggle airplane mode on/off with a queued mutation → confirm it pushes on reconnect without user action
- [ ] 9.3 On device/emulator: confirm the Hoy pill now reads "Pendiente de sincronizar" (not "Sincronizado"/"Conectado") when connectivity is cut with the app already open — the exact gap found this session
