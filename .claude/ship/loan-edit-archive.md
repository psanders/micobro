# Ship checkpoint — loan-edit-archive

Started: 2026-10-20
Current stage: 4 — Test (PR opened; remaining: stories, sync tests, Maestro flows)

**Scope:** Let lenders fix mistaken loans from the app (branch
`feat/loan-edit-archive`). Payment-free loans get "Editar préstamo" (new-loan
form prefilled, customer locked); any loan can be "Archivado" (status
`cancelled`), with "Crear préstamo corregido" when it has payments and
"Restaurar" to undo. Archived loans leave every active view but keep their
payments in history and Cuadre. One path for synced and unsynced lenders:
SQLite write + `update` pending mutation.

**Detected surfaces:** OpenSpec: yes · Pencil: yes (`pencil.pen`) ·
Storybook: yes (`.storybook/`) · E2E: yes (`.maestro/`)

| # | Stage | Status | Notes |
| :- | :--- | :--- | :--- |
| 0 | Frame | done | Change created + validated (proposal/design/specs/tasks). |
| 1 | Design (Pencil) | done | Section "sec-Corregir préstamo" (Qedm7): 06d–06h + 05d. Pedro approved ("write the code"); saved to pencil.pen. |
| 2 | Spec reconcile | done | Disabled-with-reason Editar, hidden Total a pagar hoy on archived, archived card shows date + collected; design.md write-sequence corrected. Validates. |
| 3 | Build | in-progress | Data layer, repos, UI and routes done; Storybook stories (3.6) still to do. |
| 4 | Test | in-progress | 466/466 tests, tsc/eslint/prettier green. Emulator walkthrough passed (edit, locked edit, archive+corrected, Archivados, Restaurar, queued mutations). Remaining: sync tests 4.1–4.3, Maestro 5.1–5.2. |
| 5 | Sync | pending | |
| 6 | Archive | pending | |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-10-20 — Pedro: close for today — committed and opened the PR with
  stories (3.6), sync tests (4.1–4.3), Cuadre test (2.4) and Maestro (5.1–5.2)
  still open; tracked in tasks.md.
- 2026-10-20 — Pedro: a fully paid loan's archive confirmation offers only
  Archivar/Cancelar — no "crear préstamo corregido" (nothing to correct).
  Spec scenario added; `offerCorrected` = has payments && not paid off.
  Verified both cases on emulator.
- 2026-10-20 — Emulator demo on emulator-5554 (no Google connected):
  L-69721 edited 12→10 cuotas in place; L-68626 (1 payment) showed locked
  Editar, archived via "crear corregido" (form prefilled, backed out → stayed
  archived, nothing created), appeared in ARCHIVADOS, restored. Queue held
  create→update rows with full payloads in order. Fixed "Su pago … se
  quedan" agreement in ArchiveLoanSheet during the demo. Expo's floating
  dev-tools button overlaps the ⋮ button in dev builds (dragged it away).
- 2026-10-20 — Design drafted in `pencil.pen`, new section "sec-Corregir
  préstamo" (Qedm7) under Collectors User Flow: 06d menu sin pagos (ixpVF),
  06e menu con pagos (qV9lE), 06f confirmación con pagos (EmH4L), 06g Editar
  préstamo (Y3puBc), 06h Préstamo archivado (Vy2Zk), 05d Cliente —
  Archivados (egpH8). Not yet saved to disk (needs Cmd+S in Pencil).
  Awaiting Pedro's approval.
- 2026-10-20 — Dropped "pull before edit": pull only covers customers/loans;
  payments are never pulled, so local payments are the only lock source.
- 2026-10-20 — Pedro chose: archive + prefilled corrected loan when payments
  exist; archive is reversible (Restaurar); wording "Archivar".
- 2026-10-20 — Checkpoint created; framing done.
