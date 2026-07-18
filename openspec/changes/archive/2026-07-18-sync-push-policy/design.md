## Context

Today, `pushPendingMutations(db)` (`lib/sync/push.ts`) only runs from
`sheet-provisioning`'s first-connect backfill or the user tapping "Sincronizar
ahora" (`SyncSettingsScreen`/`CuadreScreen`, both calling `syncRepo.pushNow()`
directly). Nothing pushes on a fresh mutation or on reconnect.

A sibling project, Mikro (`~/Projects/mikro`, `mods/mobile/lib/offline/`),
solved the same shape of problem with a `SyncProvider` React context: it
watches connectivity + a pending count, auto-pushes via a guarded `useEffect`,
and mutation call sites call `refreshState()` right after queuing so the
provider's effect fires. Mikro detects connectivity by polling its own
backend's `/health` every 10s (`useNetworkStatus.ts`) — Micobro has no
first-party backend (Google Sheets/Drive is the remote), so that specific
mechanism doesn't transfer; NetInfo does (decided with the user).

Also found while reading the current code — a real bug, not a hypothetical:
`push.ts`'s query and `syncRepo.getStatus()`'s pending count both filter
`status = "pending"` only. Once `push.ts` marks a row `"failed"` (any single
failed attempt — including a push attempted while offline, which "push
immediately" makes routine), that row is invisible to every future push query
_and_ to the pendingCount the lender sees. Mikro's equivalent query is
`status IN ('pending', 'failed') AND retry_count < MAX_RETRIES` — ours needs
the same fix, otherwise this whole feature makes data loss more likely, not
less (more push attempts = more chances to fail once while offline and get
stuck forever, unseen).

## Goals / Non-Goals

**Goals:**

- A queued mutation reaches the sheet as soon as there's connectivity to send
  it on, without the lender doing anything.
- A mutation queued while offline reaches the sheet as soon as connectivity
  returns, without the lender doing anything.
- No successfully-queued mutation is ever silently invisible — retryable
  failures keep retrying; exhausted ones are surfaced as "necesita atención"
  the count.
- Exactly one push in flight at a time, regardless of what triggered it.
- Auto-triggered attempts never interrupt the lender with an alert; the
  existing manual button keeps surfacing errors as it does today.

**Non-Goals:**

- Pull/two-way sync (`7-pull-two-way-sync`).
- De-duplicating rows in the Sheet itself against a lost-response retry (Sheets
  `values:append` has no idempotency key; see Risks).
- Polling-based connectivity detection (NetInfo is event-driven; no interval).
- Any change to `google-connect`'s existing requirements — first-connect
  provisioning is untouched, this only adds _when else_ a push happens.

## Decisions

**1. New `sync-engine` capability, not a `google-connect` modification.**
Push-trigger timing and retry policy are a distinct, independently-testable
behavior domain from "connecting to Google" / "provisioning the sheet" (both
already specified under `google-connect`). Keeping them separate means a
future change to retry policy doesn't need to touch the connect-screen spec.

**2. Fix the retry query before adding new triggers.**
`push.ts`'s `WHERE` clause becomes
`status IN ('pending', 'failed') AND retryCount < MAX_RETRIES`, matching
Mikro. `syncRepo.getStatus()`'s `pendingCount` uses the same predicate (so the
UI counts everything that will still be retried). A new `stuckCount` counts
`status = 'failed' AND retryCount >= MAX_RETRIES` — rows that need a lender's
(or a future debugging flow's) attention. `SyncStatus` (`lib/repo/types.ts`)
gains `stuckCount: number`; `SyncSettingsScreen` renders it as a distinct line
when non-zero. This is a pure widening of an existing query + one new field —
no migration.

**3. Notify via a tiny typed event bus, not polling.**
`lib/sync/syncEvents.ts` exports `notifyMutationQueued()` and
`onMutationQueued(cb): () => void` — an in-process pub/sub, no dependency (RN's
`DeviceEventEmitter` is meant for native↔JS bridging, not plain cross-module
JS signaling; a ~15-line module-level emitter is more idiomatic and typed).
Each real repo's create method calls `notifyMutationQueued()` immediately
after its underlying domain function resolves (i.e., after the
`pending_mutations` row is confirmed written):

```ts
// lib/repo/real/customerRepo.ts
create: async (input) => {
  const customer = await createCustomer(input);
  notifyMutationQueued();
  return customer;
};
```

Four call sites total (customers/loans/payments `collect`/visits) — a single
choke point per entity in the repo layer, per the proposal's explicit
deviation from Mikro (which calls `refreshState()` from screens instead).
Screens can't forget to wire this up because they never see it.

**4. Auto-push decision is a pure function, not inline effect logic.**
`lib/sync/autoPushPolicy.ts` exports
`shouldAutoPush({ isOnline, isPushing, pendingCount }): boolean` — trivially
`isOnline && !isPushing && pendingCount > 0`, but naming and testing it
separately means the _policy_ (when do we push?) is unit-tested without a
React testing harness (this repo has none — Jest covers `lib/` only). The
`SyncProvider` component becomes a thin wrapper: subscribe to NetInfo +
`onMutationQueued`, refresh `getStatus()`, call `shouldAutoPush`, and if true,
run the guarded push.

**5. One `SyncProvider`, one in-flight guard, both triggers and the manual button behind it.**
`lib/sync/SyncProvider.tsx` (mounted in `app/_layout.tsx`, inside
`RepoProvider` so it can call `useSyncRepo()`) holds:

- `isOnline` from `NetInfo.addEventListener` (no polling).
- `status` from `syncRepo.getStatus()` (re-fetched on mount, on
  `onMutationQueued`, on reconnect, and after every push attempt).
- `isPushing` + a `pushingRef` guard so overlapping triggers collapse into one
  in-flight push (mirrors Mikro's `pushingRef`).
- `push(silent: boolean)`: acquire the guard, call `syncRepo.pushNow()`,
  release the guard, refresh status; `!silent` failures alert (existing manual
  behavior), `silent` failures only log.
- Reconnect detection via a `wasOnlineRef` transition check (offline → online),
  mirroring Mikro's pattern, triggering a silent push.
- The mutation-queued and reconnect effects both just call
  `shouldAutoPush(...)` after refreshing status, and push silently if true.

`SyncSettingsScreen` and `CuadreScreen` switch from calling
`syncRepo.pushNow()` directly to the provider's `push(false)`, so a manual tap
is subject to the same in-flight guard as the automatic triggers (no more
double-push race between a background auto-trigger and a manual tap landing at
the same moment).

**6. The status pill is a pure function over sync state, prioritized like the retry surfacing.**
Confirmed on-device: today's Hoy header pill (`HomeScreen.tsx`, per
`home-dashboard`'s existing spec requirement) reads `status.connected`, which
is only `isSignedInToGoogle()` — a cached-session check with no network
involved, so it stays "Conectado" green with connectivity provably cut. With
`isOnline` and `pendingCount`/`stuckCount` now available from `SyncProvider`,
`lib/sync/syncStatusLabel.ts` exports a pure
`computeSyncStatusLabel({ isSignedIn, isOnline, pendingCount, stuckCount })`
returning one of four semantic states, highest-priority first:

1. `not_connected` — never signed in.
2. `needs_attention` — `stuckCount > 0` (a mutation exhausted its retries).
3. `pending` — offline, or `pendingCount > 0`.
4. `synced` — signed in, online, nothing queued or stuck.

The function returns a semantic code, not Spanish copy — `HomeScreen.tsx` (the
compact pill: Sincronizado / Pendiente de sincronizar / Necesita atención / No
conectado) and `SyncSettingsScreen.tsx` (which already shows the numeric
pending/stuck counts) each own their own copy, keeping `lib/sync/` UI-agnostic
per the rest of the codebase's convention. Same testability shape as
`autoPushPolicy.ts` — pure, table-tested, no React harness needed.

## Risks / Trade-offs

- **Append-only duplicate risk on a lost-response retry** (a push's HTTP
  response is lost after Google already recorded the append; the retry appends
  a second row): pre-existing risk in `push.ts`, not introduced or worsened
  here, but "push immediately" plus "push on reconnect" both increase how often
  a push runs in marginal-connectivity conditions, so it's worth naming
  explicitly. Mitigation is out of scope (Sheets has no idempotency key to
  dedupe against); a future pull-sync change could reconcile by row `ID`.
- **More frequent network calls** (a push attempt per mutation instead of
  batched) → acceptable; volumes are low (a human collecting payments, not a
  bulk importer), and the in-flight guard prevents pile-up.
- **NetInfo's `isInternetReachable` is itself a periodic reachability probe
  under the hood** (Google-managed, inside the library) → still strictly less
  custom code and more standard than hand-rolling Mikro's ping loop against an
  arbitrary URL.
- **Silent failures could mask a systemic problem** (e.g., the Sheets API key
  becomes invalid) if the lender never opens Ajustes → mitigated by the new
  `stuckCount` surfacing once retries are exhausted, and by `lastError` already
  being stored per row (existing field) for later inspection.

## Migration Plan

No data migration. `expo install @react-native-community/netinfo` to make the
already-transitive dependency direct, then a native rebuild (new native module
linking). Purely additive: reverting removes the auto-triggers and the
`stuckCount` line; manual "Sincronizar ahora" keeps working exactly as before
either way.

## Open Questions

- Should `stuckCount > 0` eventually surface a Home-screen banner (not just
  buried in Ajustes)? Deferred — out of scope for this change, worth a future
  proposal once we have a sense of how often lenders actually hit the retry cap.
