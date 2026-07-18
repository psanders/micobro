# Ship checkpoint — 2-profile-domain

Started: 2026-07-18
Current stage: 6 — Archive (done)

**Scope:** Replace the always-null real profile repo with a real `profile`
table + validated `getProfile`/`setProfile` functions, an Editar Perfil
capture screen (name, avatar, business name, phone), and ProfileScreen
wiring (edit affordance when a profile exists, a setup prompt when it
doesn't). Closes the "every real install looks anonymous" gap.

**Detected surfaces:** OpenSpec: yes · Pencil: yes (screens already built —
"10b Editar Perfil" `u0GCTY` — from earlier profile-tools-screens work,
no new design needed) · Storybook: yes · E2E: Maestro.

| # | Stage | Status | Notes |
| :- | :--- | :--- | :--- |
| 0 | Frame | done | 11/12 tasks already done per tasks.md; only 3.3 (on-device verification) remains |
| 1 | Design (Pencil) | done | Screens already exist from earlier work — no new design needed |
| 2 | Spec reconcile | done | `openspec validate 2-profile-domain` green; delta spec at `specs/profile-home/` |
| 3 | Build | done | profile table/schema, getProfile/setProfile, EditProfileScreen, /perfil/editar route, ProfileScreen wiring — all present in code |
| 4 | Test | done | Jest/lint/typecheck green (68 suites, 278 tests). Task 3.3 (on-device verification) done live: Mi cuenta shows the real captured profile (name, avatar, live sync pill) instead of the anonymous fallback; Editar Perfil pre-fills correctly and saving (upsert) round-trips without error |
| 5 | Sync | done | Added "Profile capture and editing" + "First-run empty state" requirements to `openspec/specs/profile-home/spec.md`. `openspec validate --specs` green (16/16). Noted (not fixed here — out of scope): the existing "Settings list" requirement in this same spec is now stale re: Seguridad y PIN / missing the Sincronización row, from unrelated later work this session |
| 6 | Archive | done | Moved to `openspec/changes/archive/2026-07-18-2-profile-domain/` |

## Decision log

Newest first.

- 2026-07-18 — Checkpoint created. Picked up via `/ps:ship` (no argument) after
  resolving two other stale in-progress checkpoints (sync-push-policy,
  7-pull-two-way-sync — both done this session). Only task 3.3 remains here;
  proceeding straight to the on-device walk since build/tests are already green.
- 2026-07-18 — Verified 3.3 live on the emulator, synced the profile-home
  delta, archived. Flagged (not fixed, out of scope) that profile-home's
  "Settings list" requirement no longer matches current ProfileScreen
  behavior — drift from unrelated navigation/IA work done later this session.
