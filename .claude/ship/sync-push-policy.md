# Ship checkpoint — sync-push-policy

Started: 2026-07-17
Current stage: 4 — Test (build + unit tests done, on-device verify pending)

**Scope:** Push queued mutations immediately after each create/collect, and
automatically on regaining connectivity (NetInfo), through one shared in-flight
guard also covering the manual "Sincronizar ahora" button. Fixes a real bug
found while building this: push.ts/getStatus() only counted status="pending",
so a single failed attempt (routine once auto-push runs while offline) made a
mutation permanently invisible — fixed to include retryable "failed" rows, with
a new stuckCount for retry-cap-exhausted ones. Also replaces the Home header's
"Conectado" pill (confirmed on-device it only reflected a cached Google
session, not real connectivity) with a 4-state pill: Sincronizado / Pendiente
de sincronizar / Necesita atención / No conectado — Pencil (`pencil.pen`)
updated to match: renamed the live Home pill and added a documented
"m/sync-status-pill" reference card (4 variants) to the Mobile Component
Library.

**Detected surfaces:** OpenSpec: yes · Pencil: yes · Storybook: yes · E2E: Maestro

| # | Stage | Status | Notes |
| :- | :--- | :--- | :--- |
| 0 | Frame | done | Continuing on feat/sheet-provisioning branch (uncommitted); artifacts authored earlier |
| 1 | Design (Pencil) | done | Renamed live pill (HxJ5m: Conectado→Sincronizado, kept brandPrimary/#D6F3E5 look); added m/sync-status-pill reference card (4 states) to Mobile Component Library (zoSWf/JMPkz). Verified via snapshot_layout (no clipping/collapse) + direct screenshot of the live pill |
| 2 | Spec reconcile | done | Delta specs (sync-engine new capability + home-dashboard MODIFIED) already matched the Pencil work — no drift |
| 3 | Build | done | Bug fix (push.ts/syncRepo.ts retry query + stuckCount); syncEvents.ts; autoPushPolicy.ts; syncStatusLabel.ts; SyncProvider.tsx; wired into 4 real repos + app/_layout.tsx; HomeScreen/SyncSettingsScreen/CuadreScreen updated; netinfo promoted to direct dep |
| 4 | Test | in-progress | 5 new test files (autoPushPolicy, syncStatusLabel, syncEvents, realSyncRepo, push.ts retry case) — 264 total pass, typecheck clean, lint clean. On-device verify (task 9.2/9.3) not yet done |
| 5 | Sync | pending | |
| 6 | Archive | pending | |

## Notes / open items

- Code-fixed a color mismatch I introduced: STATUS_STYLE.synced now uses
  colors.brandPrimary + literal "#D6F3E5" (matching the pill's original exact
  look) instead of the generic colors.green/greenBg, to avoid an unintended
  color shift on the common case — caught by cross-checking against the Pencil
  source of truth.
- User flagged a separate, deferred item: the avatar picker (profile/customer)
  exists in code but isn't yet reflected in Pencil — tracked for later, not
  part of this change.
- Cloud prerequisites unaffected by this change (already satisfied per
  sheet-provisioning's ship).
- Still uncommitted: this + the earlier sheet-provisioning + google-signin
  pivot, all on feat/sheet-provisioning branch.

## Decision log

Newest first.

- 2026-07-17 — Full gate green (264 tests, typecheck, lint) after fixing 3 prettier nits. At Test stage, on-device check remains.
- 2026-07-17 — Wrote 5 test files covering the bug fix, both pure functions, and the event bus.
- 2026-07-17 — Wired SyncSettingsScreen + CuadreScreen through the shared push() guard; SyncSettingsScreen now shows "Necesita atención" line.
- 2026-07-17 — Pencil: renamed live Home pill to "Sincronizado"; added 4-state m/sync-status-pill reference card to Mobile Component Library. Verified via snapshot_layout + screenshot.
- 2026-07-17 — Fixed a code color bug: synced state must match the pill's original brandPrimary/#D6F3E5 look, not generic ds.green.
- 2026-07-17 — Built bug fix, syncEvents, autoPushPolicy, syncStatusLabel, SyncProvider, wired all 4 repos + _layout.tsx + HomeScreen. netinfo installed as direct dep.
- 2026-07-17 — User confirmed the Conectado diagnosis on-device (cut network at OS level, badge stayed green) and asked for: push immediately, resync on reconnect, careful data-loss handling, checked Mikro's reference implementation, and a real 4-state status pill (folded into this same change, including Pencil).
