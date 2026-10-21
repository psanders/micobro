# Ship checkpoint — owner-position-report

Started: 2026-10-20
Current stage: done (archived 2026-10-21)

**Scope:** "Mi cartera" report: capital lent, to collect, collected, late amount and share, to collect by loan type, and this month's outlook; opened from Mi cuenta. Derived on read, no schema/sync changes.

**Detected surfaces:** OpenSpec: yes · Pencil: yes · Storybook: yes (not used: screen only reuses existing components) · E2E: Maestro smoke only

| # | Stage | Status | Notes |
| :- | :--- | :--- | :--- |
| 0 | Frame | done | |
| 1 | Design (Pencil) | done | Approved by Pedro; copy tweak pending (task 4.1) |
| 2 | Spec reconcile | done | Percent is of por cobrar, not prestado |
| 3 | Build | done | lib/reports, reports repo (real+mock), MyPositionScreen, Hoy entry |
| 4 | Test | done | 9 new unit tests; full jest 1097 green; tsc + eslint (touched files) + prettier clean; Maestro flow .maestro/mi-posicion.yaml written, NOT run |
| 5 | Sync | done | Applied by `openspec archive` |
| 6 | Archive | done | openspec/changes/archive/2026-10-21-owner-position-report |

## Decision log

- 2026-10-21 — Merged in #164; spec synced and change archived via `openspec archive` (it applies the delta itself).
- 2026-10-20 — Entry point is a ListTile row under the quick actions (a 4th quick-action card would not fit 390px). Not in the approved Pencil design.
- 2026-10-20 — Pencil copy tweak ("de lo por cobrar", "POR COBRAR POR TIPO") applied in-memory; needs Cmd+S.
- 2026-10-20 — Percent of por cobrar (balance includes interest) so numerator and denominator match; design copy changes accordingly.
- 2026-10-20 — round-to-whole-pesos is a separate change; not implemented here.
- 2026-10-20 — Design approved; branch feat/owner-position-report.
