# Ship checkpoint — 103-solo-capital

Started: 2026-08-06
Current stage: 4 — Test (done); gate before Sync

**Scope:** Adds a **Solo capital** payment option to the Crédito Abierto cobrar
screen, enabled only once the current cycle's interest is covered in full, and
disables **Solo interés** / **Interés + capital** at that point so the screen
stops offering the following cycle's interest as if it were due now. Presentation
only — the cycle engine, the payment schema, and the sync layer are untouched.

**Detected surfaces:** OpenSpec: yes · Pencil: yes (`pencil.pen`) · Storybook: yes (`.storybook/`) · E2E: yes (Maestro, not Playwright — `.maestro/`)

| # | Stage | Status | Notes |
| :- | :--- | :--- | :--- |
| 0 | Frame | done | Change created from issue #103; `openspec validate` passes |
| 1 | Design (Pencil) | done | Both states drawn and approved; `pencil.pen` saved. `gH1rr` (interest pending) and `I5ASY` (interest covered, Solo capital enabled but NOT preselected). |
| 2 | Spec reconcile | done | Added the no-preselection rule + 4 scenarios; `openspec validate` passes |
| 3 | Build | done | Logic extracted to `lib/payments/openCreditPayOptions.ts`; screen wired to it |
| 4 | Test | done (e2e unrun) | 478 tests / 80 suites green. Maestro flow written but NOT executed — needs a demo build on the emulator |
| 5 | Sync | pending | |
| 6 | Archive | pending | |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-08-06 — Receipt drops its Interés line on a capital-only payment instead of printing RD$0.
- 2026-08-06 — Zero-interest cycle counts as covered (design.md's open question resolved): nothing to collect, so capital is all that's left.
- 2026-08-06 — Pedro corrected the design mid-build: Solo capital must NOT be preselected, since paying capital without interest isn't the typical case. Spec, code and Pencil state B all updated.
- 2026-08-06 — No React Native testing-library in the repo, so the option logic was extracted to `lib/payments/openCreditPayOptions.ts` and unit-tested there rather than left untestable inside the screen.
- 2026-08-06 — Stage 1 drawn and exported; waiting on Pedro's approval (human gate) before spec reconcile.
- 2026-08-06 — Stale layout cache is cleared by sending Cmd+= / Cmd+- / Cmd+0 to the "Pen" app via osascript. Mouse movement alone and setting an explicit height both failed; the zoom keystrokes worked. Reuse this whenever new Pencil nodes render blank or siblings overlap.
- 2026-08-06 — Was BLOCKED on a stale Pencil layout cache; screen height raised 844 → 924 for the extra row, but the render can't be trusted until the app re-lays-out. Not sending a screenshot of a broken render.
- 2026-08-06 — Hand-built frames rendered blank; rebuilt the row by `Copy`ing the existing `YleBW` option row per the project's copy-don't-author convention, which fixed the blank render.
- 2026-08-06 — Stage 1 opened on `gH1rr`; two states to draw (interest pending, interest covered).
- 2026-08-06 — E2E is Maestro, not Playwright; stage 4's e2e task targets `.maestro/prestamo-cobrar.yaml`.
- 2026-08-06 — No OpenSpec change existed for #103; created `103-solo-capital` from the issue's content rather than blocking.
- 2026-08-06 — Verified against the engine that no payment-type field is needed: once a cycle's interest is covered, further payments in that cycle already route entirely to capital.
- 2026-08-06 — Decided Solo capital stays disabled under *partial* interest coverage, since the engine would still route part of it to interest and the label would lie.
- 2026-08-06 — Checkpoint created; framing the change.
