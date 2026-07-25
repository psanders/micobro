# Ship checkpoint — payment-history-actions

Started: 2026-07-24
Current stage: 6 — Archive, done

**Scope:** Bundle GitHub #72 and #40 on one PR (branch
`feat/payment-history-actions`). Replace Nuevo Préstamo's "Primer pago"
preset-cycling control with a real calendar picker (ported from
`../mikro`'s `CalendarPicker.tsx`), and make Histórico de Pagos rows
tappable into a receipt view reusing PaymentConfirmedScreen's existing
Imprimir/WhatsApp actions — which also satisfies #40's resend/print ask.

**Detected surfaces:** OpenSpec: yes · Pencil: yes (`pencil.pen`) ·
Storybook: yes (`.storybook/`) · E2E: yes (`.maestro/`)

| # | Stage | Status | Notes |
| :- | :--- | :--- | :--- |
| 0 | Frame | done | Change `payment-history-actions` created (proposal/design/specs/tasks), validated. Branch `feat/payment-history-actions` cut fresh off updated `origin/main` (old `feat/open-credit-loans` was stale — its commits already squash-merged; stray uncommitted `pencil.pen` diff there was stashed, not discarded). |
| 1 | Design (Pencil) | done | `m/calendar-picker` component (BHTXK), Primer pago field on Nuevo Préstamo (Mac4Z), demo overlay "06c" (A6IyjR), payment-row chevron (GTB5W), "12 Recibo de Pago" screen (htxyb). User signed off. |
| 2 | Spec reconcile | done | Design matched delta specs exactly, no edits needed. |
| 3 | Build | done | CalendarPicker ported + wired; getPaymentReceipt query + canonical receipt numbers; PaymentReceiptScreen + ReceiptSummary/ReceiptActions extraction; tappable history rows; new route. |
| 4 | Test | done | 229/229 suites, 1352/1352 tests green; scoped lint clean; typecheck clean; Maestro flow written (not executed, no device). |
| 5 | Sync | done | Delta specs promoted into `openspec/specs/loan-configuration` and `openspec/specs/payment-history`. |
| 6 | Archive | done | Moved to `openspec/changes/archive/2026-07-25-payment-history-actions/`. |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-07-25 — PR #73 opened, closes #72 and #40. CI's format:check caught
  a prettier convergence gap in tasks.md (fixed, pushed, CI green). Synced
  delta specs into `openspec/specs/loan-configuration` and
  `openspec/specs/payment-history`, archived the change to
  `openspec/changes/archive/2026-07-25-payment-history-actions/`. Ship
  loop complete.
- 2026-07-25 — `/code-review` pass (eye on scope creep) surfaced 7
  findings; verified each against the code before acting:
  1. **Fixed** — `NewLoanFormScreen`'s frequency-reset effect and the
     initial `firstPaymentDate` state each called `healthyFirstPaymentFloor`
     independently (own `new Date()`), so `isFirstPaymentDefault` almost
     never matched and the "Mañana"/"En 1 semana" label rarely rendered.
     Reordered hooks so both reuse the single memoized `firstPaymentFloor`.
  2. **Fixed** — `profile.schema.ts`'s `optionalPhoneSchema` only treated
     `undefined` as empty (not `""`), contradicting its own doc comment;
     also fixed `setProfile.ts`'s `?? null` → `|| null` so the empty
     string actually clears the stored phone. Added a test case.
  3. **Fixed** — `buildPaymentReceipt`'s sibling sort used an invalid
     single-argument `Array.sort` comparator; replaced with a real
     two-argument one.
  4. **Fixed** — `PaymentReceiptScreen` duplicated the cash/transfer label
     inline instead of reusing `methodLabels`; hoisted to one computed
     value reused by both `ReceiptSummary` and `ReceiptActions`.
  5. **No fix needed** — `canonicalReceiptNumbers` grouping by
     `paidAt.getTime()` equality is a known, already-documented tradeoff
     (design.md's Non-Goals); comment doesn't overclaim safety.
  6. **Fixed** — `getPaymentReceipt.ts` had no dedicated test file, unlike
     every sibling factory in `lib/payments/`. Added
     `__tests__/getPaymentReceipt.test.ts` (5 cases: happy path, each
     null-fallback branch, validation failure).
  7. **Fixed** — the `node_modules` untracking (needed locally to unblock
     testing) was staged and would have leaked into this branch's diff;
     unstaged it — this branch's commits won't touch that path. Still
     flagged separately for a tiny fix on `main`.
  Re-ran full suite after fixes: 230/230 suites, 1361/1361 tests, clean
  lint/typecheck.
- 2026-07-24 — User confirmed the receipt (Cuota N/Total) and profile
  phone-formatting fixes both look correct live in the emulator. Full
  suite green (229/229, 1355/1355), typecheck clean. Ready for the sync
  gate again.
- 2026-07-24 — Manual Android emulator QA (mock repos, port 8082 — an
  orphaned Metro server from `.claude/worktrees/issue-65` was squatting on
  8081, serving code from before the phone-formatting and
  "Cuota X/Total"-on-receipts PRs; killed pid 63488 with user
  confirmation). Confirmed working end-to-end: calendar picker (min-date +
  default selection), Histórico de Pagos row tap → Recibo de pago →
  Imprimir/WhatsApp → back navigation. User's live QA caught a real bug:
  the historical receipt showed "Cuota N" instead of "Cuota N/Total" — my
  `buildPaymentReceipt` was reusing the list's label instead of matching
  `CollectPaymentScreen`'s live-receipt `cuotaLabel` convention. Fixed via
  a shared `cuotaNumbersByPaymentId` helper; tests updated, still green.
- 2026-07-24 — Build + Test stages complete. Key implementation calls:
  `getPaymentReceipt` lives in `lib/payments/` (not `lib/loans/` as
  design.md tentatively suggested) since it returns the same
  `PaymentReceipt` shape as `collect()` and is `paymentId`-scoped, not
  `loanId`-scoped; extracted `healthyFirstPaymentFloor` into
  `loanViews.ts` (testable) rather than leaving it screen-local, since
  this repo has no component-testing infra; extracted `ReceiptSummary` +
  `ReceiptActions` as shared components (not a `variant` prop) per
  design.md's deferred choice. Also fixed unrelated pre-existing repo
  damage found along the way: `node_modules` was a self-referential
  symlink tracked in git (commit 1b099a6) — removed locally and
  reinstalled to unblock testing; flagged, not touched upstream. Noted but
  did not touch: stale `.claude/worktrees/{issue-63,64,65,agent-*}` full
  checkouts polluting jest's haste map. All specs, tests, lint, typecheck
  green. Entering Sync gate.
- 2026-07-24 — First Pencil design pass complete: `m/calendar-picker`
  reusable component (bottom-sheet month calendar with min-date + Sunday
  disabling shown for Julio 2026, min=25, selected=27); "Primer pago"
  field added to Nuevo Préstamo (wasn't in the .pen file at all before —
  code-only from 44-loan-first-payment-date); demo overlay screen "06c"
  showing the sheet open on top of the form; a chevron affordance added
  to `m/payment-row` (only used in Histórico de Pagos, safe to change);
  new "12 Recibo de Pago" screen copied from "08 Pago Confirmado" with
  title/subtitle swapped, "Listo" CTA removed, a back header added, and
  Imprimir/WhatsApp actions kept intact. Presenting to user for sign-off
  before spec reconcile.
- 2026-07-24 — Researched mikro's `CalendarPicker.tsx` (bottom-sheet month
  calendar, pure RN, minDate-only) — plan to port + extend with an
  `isDateDisabled` prop for Sunday-skip, since micobro needs more than
  mikro's minDate-only gating.
- 2026-07-24 — Found `PaymentConfirmedScreen.tsx` already has working
  Imprimir/WhatsApp actions; reusing it (as a derivative/shared component)
  for the historical receipt view satisfies #40 without new action UI.
- 2026-07-24 — Found a real inconsistency: `collectPayment.ts` can write
  two `payments` rows (mora + installment) sharing one `paidAt`, but
  `buildPaymentHistoryView` assigns each its own receipt number
  independently — design fixes this by grouping siblings by
  `(loanId, paidAt)` and using one canonical (lower) number for both.
- 2026-07-24 — Change `payment-history-actions` framed: proposal, design,
  spec deltas (loan-configuration, payment-history), tasks all written and
  `openspec validate` passes.
- 2026-07-24 — Checkpoint created; entering Design (Pencil) stage next.
