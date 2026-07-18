## Why

Right now a lender's data only reaches their Google Sheet at two moments: the
one-time backfill during first connect, or whenever they happen to open
Ajustes/Cuadre and tap "Sincronizar ahora." Nothing pushes a new customer,
loan, payment, or visit as it happens, and nothing reacts when the phone comes
back online after being offline — the exact condition collecting agents hit
constantly in the field. Worse, a bug found while building this — both the
push query and `getStatus()`'s pending count filter on `status = "pending"`
only — means a mutation that fails to push even once (e.g. a mid-collection
network drop) becomes `status: "failed"` and is then **permanently invisible**
to every future push attempt and to the "pendientes" count the lender sees.
For an app whose entire value proposition is "your loan book, safely backed
up," a silently-stuck mutation is real data loss for the lender's business
records.

## What Changes

- **Bug fix (prerequisite):** the push query and `getStatus()`'s pending count
  both start including `status = "failed"` rows (below the retry cap), so a
  transient failure keeps retrying instead of vanishing. Rows that exhaust the
  retry cap are surfaced as a distinct "necesita atención" count rather than
  disappearing from both.
- **Push immediately after each mutation.** `createCustomer`, `createLoan`,
  `createPayment`/`collect`, and `createVisit` each already queue a
  `pending_mutations` row; after that queueing succeeds, the corresponding real
  repo method (customers/loans/payments/visits, in `lib/repo/real/*.ts`) now
  signals a shared sync module, which attempts a push right away when online.
- **Auto re-sync on reconnect.** A new connectivity watcher
  (`@react-native-community/netinfo`, event-driven) detects the offline → online
  transition and triggers a push attempt, so mutations queued while offline
  go out as soon as the connection returns — no user action required.
- **One push at a time.** A shared in-flight guard ensures the automatic
  triggers (on-mutation, on-reconnect) and the existing manual "Sincronizar
  ahora" button never run concurrently.
- **Automatic pushes are silent; manual pushes are not.** Auto-triggered
  attempts log and retry later on failure without interrupting the lender;
  the manual "Sincronizar ahora" flow keeps surfacing errors as it does today.
- **The Hoy header's status pill reflects real sync state, not just sign-in.**
  Today "Conectado" only means "has a cached Google session" — confirmed
  on-device that it stays green even with connectivity provably cut. With
  `isOnline` and `pendingCount`/`stuckCount` now tracked, the pill becomes one
  of four states: **Sincronizado** (signed in, online, nothing queued),
  **Pendiente de sincronizar** (signed in but offline or mutations queued),
  **Necesita atención** (a mutation exhausted its retries), or **No conectado**
  (never signed in). This is a design + spec change to `home-dashboard`'s
  existing connection-pill requirement, including a `pencil.pen` update.

## Capabilities

### New Capabilities

- `sync-engine`: when and how queued local mutations get pushed to the
  lender's Google Sheet — trigger timing (on-mutation, on-reconnect, manual),
  retry/backoff policy, and the invariant that no successfully-queued mutation
  is ever silently dropped from view.

### Modified Capabilities

- `home-dashboard`: the Hoy header's connection pill now derives from real
  sync state (sign-in + connectivity + pending/stuck mutations) instead of
  sign-in alone, per the existing "Hoy header with greeting and connection
  status" requirement.

## Impact

- **Code:** `lib/sync/push.ts` and `lib/repo/real/syncRepo.ts` (query fix,
  `stuckCount`); new `lib/sync/syncEvents.ts` (tiny typed pub/sub — a mutation
  was queued); new `lib/sync/autoPushPolicy.ts` (pure, unit-testable decision
  function: given online/pushing/pendingCount, should we push now?); new
  `lib/sync/SyncProvider.tsx` (React context wiring NetInfo + the event bus +
  the policy function + the in-flight guard around `syncRepo.pushNow()`),
  mounted in `app/_layout.tsx` inside `RepoProvider`; `lib/repo/real/customerRepo.ts`,
  `loanRepo.ts`, `paymentRepo.ts`, `visitRepo.ts` each call the event bus after
  their create/collect method resolves; `SyncSettingsScreen`/`CuadreScreen`
  move their push button onto the shared provider so the in-flight guard covers
  manual pushes too, and `SyncSettingsScreen` gains a "necesita atención" line;
  new `lib/sync/syncStatusLabel.ts` (pure function: given
  signed-in/online/pendingCount/stuckCount, which of the four states applies)
  used by both `HomeScreen.tsx` (the pill) and `SyncSettingsScreen.tsx`;
  `pencil.pen` updated for the Home pill's new states/colors.
- **Dependency:** `@react-native-community/netinfo` — already present
  transitively; promoted to a direct dependency via `expo install`.
- **Non-goals:** pull/two-way sync (`openspec/changes/7-pull-two-way-sync`,
  separate, not built yet); de-duplicating Sheets rows against a lost-response
  retry (Sheets `values:append` has no idempotency key to hook into — an
  accepted, documented limitation, not solved here).
- **No schema changes** beyond what the retry-cap/stuck-count read needs (no
  new columns — `pending_mutations` already has `status`/`retryCount`).
