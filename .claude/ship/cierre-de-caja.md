# Ship checkpoint — cierre-de-caja

Started: 2026-07-18
Current stage: 5 — Sync (gate)

**Scope (revised after design iteration — see decision log):** Rolling
"Cierre de caja" (issue #27), reframed entirely around "since the last
close" instead of "today." A system-computed total sums **all** payments
(any method, cash + transfers) since the last close — derived, not a
persisted counter, matching how every other rolling number in this app is
computed fresh from source tables. The lender manually enters a verified
total; **closing is blocked unless it matches** the system total (the
mismatch is the diagnostic — "I have RD$650 more than the system knows
about"). "Cerrar día y sincronizar" is replaced entirely by "Cerrar caja",
which folds in the sync side-effect. A close records the reconciled
**period** (previous close → now) and amount to a new ledger, syncing to a
dedicated "Cierres" Sheet tab.

**Detected surfaces:** OpenSpec: yes (proposal/design/specs/tasks already
authored and merged via PR #30) · Pencil: yes — Cuadre General (`h48VL`)
needs a new "Caja" section + "Cerrar caja" button · Storybook: yes ·
E2E: Maestro.

Working on branch `feat/27-cierre-de-caja` (matching this repo's
branch-per-change convention, confirmed against merged history).

| # | Stage | Status | Notes |
| :- | :--- | :--- | :--- |
| 0 | Frame | done | |
| 1 | Design (Pencil) | done | First pass (small "Caja" card) rejected by user as confusing — redesigned from scratch per user's own explained concept (see decision log). Final: `h48VL` retitled "Cuadre de caja", period subtitle, "COBRADO SEGÚN EL SISTEMA" hero (today-scoped stat row dropped), "TOTAL VERIFICADO" replacing Efectivo Contado, Desglose note removed, footer → "Cerrar caja" with match-gate copy. User: "That's perfect." |
| 2 | Spec reconcile | done | Rewrote proposal.md, design.md, and both delta specs to match the redesigned concept (all payment methods, match-gated close, period-range ledger). `daily-reconciliation` delta now REMOVEs 3 old requirements (Efectivo esperado summary, Efectivo contado input, Cerrar día y sincronizar) and ADDs their replacements, plus MODIFIEs Desglose. `openspec validate` green |
| 3 | Build | done | `cash_closes` table + migration; `lib/cashClose/` (getCashSummary derived-sum, closeCash match-gated); `listPaymentsSinceLastClose` replacing `listToday`; `CashCloseRepo` wired into real+mock+RepoProvider; `ENTITY_RANGES.cashClose`/`Cierres` tab in push.ts+provisionSheet.ts; `CuadreScreen.tsx` fully rewritten around the since-last-close period with the match-gated "Cerrar caja" action. Also fixed unrelated Pencil housekeeping mid-build (user request): `m/avatar-picker` was an orphan root frame showing all 9 cells as the same wrong image — fixed, expanded to 12 avatars, flattened to a horizontal row, relocated into the Mobile Component Library |
| 4 | Test | done | tsc/eslint/jest all green (71 suites, 288 tests). Found and fixed real fixture flakiness (`payment-18`'s `todayAt(9,14)` can be wall-clock-future). On-device walk (7.3) done against the real connected Datos sheet: full flow verified (system total, mismatch/match indicator, close, reset, sync). Along the way found a real **pre-existing** gap — `provisionSheet.ts` never backfills new tabs for already-connected lenders — worked around it for this test account by manually adding the "Cierres" tab via browser, then confirmed the push succeeded and the row is correct. Filed issue #31 to track the underlying gap (not fixed here — `addSheetTabs()` is destructive on a populated sheet, needs a careful additive-only fix as its own change) |
| 5 | Sync | in-progress | Awaiting user confirmation to promote deltas into `openspec/specs/` |
| 6 | Archive | pending | |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-07-18 — Test stage done. On-device walk against the real connected
  Datos sheet caught a genuine bug: closing the caja queued correctly but
  the push to Sheets failed silently (`{"pushed":0,"failed":1}`) because
  this lender's sheet predates the "Cierres" tab and `provisionSheet.ts`
  only ever creates tabs once, at first-ever connect — never backfills for
  already-connected lenders. Same gap already silently affected every past
  entity-tab addition (loan/payment/visit). Declined to fix it live —
  `addSheetTabs()` deletes all existing tabs when called, which would wipe
  real synced data on a populated sheet; a correct fix needs a new
  additive-only "ensure tab exists" function, out of scope here. Per user's
  choice, manually added the "Cierres" tab (correct headers) to the test
  sheet via browser to complete verification, and filed issue #31 to track
  the real gap as its own follow-up.

- 2026-07-18 — Build complete. Chose plain `Error` (not `ValidationError`)
  for closeCash's business-rule rejections (zero total, mismatch), matching
  `updateCustomer.ts`'s existing precedent — `ValidationError` is reserved
  for schema-shape failures. `getCashSummary`/`listPaymentsSinceLastClose`
  both derive fresh from source tables per read (no persisted counter),
  consistent with `composeRouteDay.ts`'s style. Mid-build, handled an
  unrelated user request: fixed a real bug in `m/avatar-picker` (all 9
  cells showed the same wrong image), expanded to 12 avatars via
  AI-generated variants, flattened its 3-row grid to a horizontal row
  matching the code's layout, and relocated it from an orphan root frame
  into the Mobile Component Library's AVATARS section.

- 2026-07-18 — Design pivoted entirely after user feedback. First pass (a
  small "Caja" card wedged between Efectivo Contado and Desglose, cash-only,
  always-closeable) was rejected as confusing. User explained the real
  model: (1) a prominent system-computed number of what was collected, (2)
  a manually-entered "what I actually have" number, (3) closing BLOCKED
  unless those match — the mismatch itself helps find a missed payment, (4)
  closing zeroes the number and writes a ledger entry covering a date
  range, not just a timestamp, (5) "today" is irrelevant — everything is
  "since the last close," including Desglose, (6) transfers count too, not
  just cash — dropped the "transfers don't count" note entirely. Redesigned
  Cuadre General in Pencil from scratch against this model; user confirmed
  "That's perfect." Rewrote proposal/design/both delta specs to match
  before touching any code.
- 2026-07-18 — Checkpoint created; framing the change. Proposal/design/specs/
  tasks already written and merged (PR #30). Branch `feat/27-cierre-de-caja`
  created off main for the implementation.
