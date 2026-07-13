# Ship checkpoint — home-nav-screens

Started: 2026-07-13
Current stage: done — archived as 2026-07-13-home-nav-screens

**Scope:** Replace the placeholder tab shell with the designed collector shell
(Hoy / Ruta / Buscar / Cuadre) and build 02 Home "Hoy" (`cuW2F`), 03 Mi Ruta
(`f006Rz`), 04 Buscar (`p2s52`) pixel-close on the mock client. New repo
surfaces: `RouteRepo.getToday()` (mock: design dataset; real: empty day) and
`CustomerRepo.search()`. Transitional: Cuadre tab placeholder; settings moves
behind the Home avatar (google-connect delta). Second per-group change after
auth-screens.

**Detected surfaces:** OpenSpec: yes · Pencil: yes (`pencil.pen`) · Storybook: yes · E2E: yes (Maestro)

| #   | Stage           | Status | Notes                                                                                                                                                                                                                    |
| :-- | :-------------- | :----- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done   | Change created; proposal/design/4+1 delta specs/tasks written; validate green                                                                                                                                            |
| 1   | Design (Pencil) | done   | User approved all three screens + tab shell swap                                                                                                                                                                         |
| 2   | Spec reconcile  | done   | No changes at gate; transitional IA confirmed as specced; validate green                                                                                                                                                 |
| 3   | Build           | done   | RouteRepo + CustomerRepo.search + recentSearches; ClientRow/QuickAction/ProgressBar/FilterChip/SectionLabel/SearchInput/ListTile/Avatar + stories; Hoy/Ruta/Buscar/Cuadre shell; /ajustes; old tabs deleted; tasks 14/14 |
| 4   | Test            | done   | tsc/eslint/jest (42) green; Maestro pass; mock walk (Hoy, filters, search+recents, Cuadre, ajustes) AND real-mode empty-state walk on emulator                                                                           |
| 5   | Sync            | done   | 4 new capabilities promoted; google-connect re-entry requirement updated in main spec                                                                                                                                    |
| 6   | Archive         | done   | archive/2026-07-13-home-nav-screens                                                                                                                                                                                      |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-07-13 — Shipped: sync+archive per standing user approval; pushing to main.
- 2026-07-13 — Bug found on-device: search missed "Ramón" for query "ramon" → normalizeText (case+accent fold) added to real+mock search, spec scenario added, unit test added.
- 2026-07-13 — formatCurrency drops decimals for whole-peso amounts (design shows RD$18,240, not RD$18,240.00).

- 2026-07-13 — Design gate passed; both transitional calls approved (Cuadre placeholder, settings via avatar). Entering build.

- 2026-07-13 — Transitional IA decisions in design.md: Cuadre tab = styled placeholder until its group; settings behind Home avatar (`/ajustes`), google-connect spec delta updates wording; old Clientes/Préstamos tabs deleted (Buscar/Ruta supersede).
- 2026-07-13 — RouteRepo returns structured fields (status enums, overdueDays, paidAt, promiseNote); labels computed in UI. Real impl = empty day until a visits domain change exists.
- 2026-07-13 — Checkpoint created; framing the change.
