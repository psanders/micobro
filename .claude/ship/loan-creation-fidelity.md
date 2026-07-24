# Ship checkpoint — loan-creation-fidelity

Started: 2026-07-24
Current stage: 1 — Design (Pencil)

**Scope:** Change 1 of the Loans-screen epic. Two coupled items on the Nuevo
Préstamo flow:
- **Item 1 (fidelity):** bring `NewLoanFormScreen.tsx` up to the design
  (`Mac4Z`): Frecuencia chips → select, restyle the mora toggle to the design's
  styled switch, client chips → client card, and add the design-only
  **Tipo de préstamo** select (single option "Tradicional" for now; Crédito
  Abierto — Change 3 — adds the second option + branch). **Primer pago** is kept
  (per user) and ADDED to the design so design/app agree. Grace field likewise
  reflected in the design under mora.
- **Item 5 (equal cuotas):** replace round-up-to-50 (`CUOTA_ROUNDING_CENTS`) with
  equal whole-peso installments, the final cuota absorbing the few-peso
  remainder. Touches `lib/loans/loanMath.ts` + the form cost preview + tests.

Out of scope: Crédito Abierto loan type (Change 3), Sunday-skip flag (Change 2).
The "10 Permiso de Impresión" misplaced screen is moved into the Collectors
cluster on the way (item 3, partial).

**Detected surfaces:** OpenSpec: yes · Pencil: yes (pencil.pen) · Storybook: no · E2E: no (Maestro `.maestro/`, machine-level)

| # | Stage | Status | Notes |
| :- | :--- | :--- | :--- |
| 0 | Frame | done | Branch `feat/loan-creation-fidelity` off `main` (post-#62). Baseline app tested on `mikro-test` emulator — confirmed current. |
| 1 | Design (Pencil) | in-progress | 3 misplaced screens moved into `l7i5GB` ✓. App now matches design (verified live on emulator): custom pill Toggle, client card (m/client-row), header subtitle "Para {nombre}", label copy, selects, 31/07 date. Remaining parity: add "Primer pago" + grace to the `Mac4Z` design so it shows what the app keeps (pending — user to select the nested screen). |
| 2 | Spec reconcile | done | Delta ADDS "Equal-size installments" to loan-configuration (worked examples: 15000/10%/12→1375 all equal; /7→2357+2358 last). `openspec validate --strict` PASSES. Promotion deferred to Sync; archive 44+6 FIRST so loan-configuration exists in main specs before this change lands. |
| 3 | Build | done | Sonnet subagent: `components/SelectField.tsx` (new); `NewLoanFormScreen.tsx` (Frecuencia→select, Tipo de préstamo select, green switch, client card, reorder, Primer pago kept); `loanMath.ts` equal whole-peso cuota (PESO_CENTS=100, final absorbs remainder). Uncommitted. |
| 4 | Test | done | Verified by Opus independently: `tsc --noEmit` clean; jest 47 suites / 254 tests pass (8 test files updated for new cuota math). Lint clean modulo stray `.claude/worktrees/`. Manual emulator confirm still pending (app on PIN lock — needs user). |
| 5 | Sync | pending | Gate. Order: `openspec archive` 6,44,3,5 (user runs — classifier-blocked for me), THEN this change. |
| 6 | Archive | pending | Gate. |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-07-24 — User decisions: (1) keep "Primer pago", add it to the design;
  (2) equal cuotas = whole pesos, last absorbs remainder; (3) Crédito Abierto
  ships as ONE change (Change 3); (4) start with this change (fidelity + cuotas).
- 2026-07-24 — Epic sliced into 3 `/ps:ship` changes: (1) loan-creation-fidelity
  [items 1+5], (2) daily-sunday-skip [#54], (3) open-credit-loans [#55, items
  2+3]. Ordered so item-1 baseline lands before Crédito Abierto extends the form.
- 2026-07-24 — 4 completed-but-unarchived OpenSpec changes (3,5,6,44) found;
  archiving them is a prerequisite for a clean Spec stage. `openspec archive`
  blocked by the auto-mode permission classifier; deferred to Spec stage.
- 2026-07-24 — Frame: branched off main (PR #62 merged as 0300e94, local branch
  deleted).
