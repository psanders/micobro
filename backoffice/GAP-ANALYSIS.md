# Micobro ↔ Fineract — Phase 1 gap analysis

Status: proof of concept, 2026-11-03. Revised the same day: mora now follows
Fineract's model (see [Mora](#mora-fineracts-model)). Fineract build:
`apache/fineract` develop, git `1e84eeb` (pinned by digest in
`fineract/compose.yaml`).

## What Phase 1 set out to answer

Micobro today: offline-first app, local SQLite is the truth, synced to a
Google Sheet. Later: a lender connects to the back office with a token, the
app stops syncing to the Sheet and the server becomes the truth. Fineract
would be the loan and accounting core behind a TypeScript BFF.

The question for this phase: **what does Micobro do that Fineract can't
represent, or represents differently?** No UI, no real connection.

## How the answers were checked

| Piece | File | What it is |
| --- | --- | --- |
| Contract v1 | `contract/v1.ts` | Zod schemas for what the app sends (a batch of mutations, replaying the outbox the way `pending_mutations` is replayed to the Sheet today) and what the server returns. |
| Fake Micobro app | `client/fakeMicobroClient.ts` | Keeps rows shaped like the app's and runs the app's **real** engines (`loanMath`, `mora`, `loanViews`, `paymentSplit`). Every cobro carries the numbers the app showed (`clientView`). |
| Fake back office | `server/backoffice.ts`, `server/mapping.ts` | The future BFF. Applies mutations to Fineract, runs the nightly close, and reports **drift**: any difference between the app's numbers and the server's. |
| Fineract port | `fineract/port.ts` | The slice of Fineract's REST API in use. |
| Fineract model | `fineract/model.ts` | Fineract's schedule, allocation and mora-job rules as pure functions. FakeFineract is built on them, and the BFF uses them to repair mora (G-OFFLINE-MORA). |
| FakeFineract | `fineract/fakeFineract.ts` | In-memory Fineract on top of the model. |
| HttpFineract | `fineract/httpFineract.ts` | The same port over a real server. |
| Calibration | `fineract/calibration.ts`, `fineract/observed.json` | 16 probes run on both FakeFineract and a real server. They must return identical results. `observed.json` records what the real server returned. |
| Scenarios | `__tests__/backoffice/scenarios.test.ts` | 25 end-to-end scenarios: app → contract → BFF → Fineract. |

`npm test` runs the probes and scenarios on the fake. `npm run backoffice:live`
runs them on a real Fineract (`npm run backoffice:up` first;
`backoffice:reset` wipes it). **All 41 pass on both**, so every "verified"
claim below was checked against a real server.

## Where Micobro and Fineract agree (verified live)

- **Customers → clients.** `name` → `fullname`, `phone` → `mobileNo`, the
  app's UUID → `externalId` (unique, used as the idempotency key).
- **Term loans → flat interest, whole-term rate** (`interestType` FLAT,
  `interestRateFrequencyType` WHOLE_TERM). Mikro's SAN loan (5,000 / 30% /
  10 weekly) comes out as exactly 650 × 10.
- **Due dates for every frequency.** Daily, weekly and monthly map directly.
  Quincenal maps to "every 15 days", which is Micobro's rule, not Fineract's
  2-week period. Monthly keeps the anchor day like the app does (Jan 31 →
  Feb 28 → Mar 31). Mikro moved quincenal to the 15th and the month's last
  day on Oct 27 (#387); that needs its own mapping if Micobro adopts it.
- **Offline cobros.** Cobros that sync days later keep their own dates.
  Fineract accepts backdated repayments and re-allocates the later ones
  (with mora repaired, see G-OFFLINE-MORA). This is also what a cutover
  import needs: replay the whole local history.
- **Voiding a payment row** (a Sheet deletion today) → Fineract "undo"
  transaction.
- **Idempotency.** A re-sent batch returns `duplicate`, and nothing is
  posted twice.
- **Overpayment.** Fineract marks the loan `overpaid`. The app clamps the
  balance at zero. Both show nothing owed.
- **Tradicional Plus penalty** (PR #189, not merged yet; the test builds its
  mutations by hand). A penalty charge plus an approved loan reschedule
  moves every unpaid cuota one quincena later and leaves the balance alone.

## Mora: Fineract's model

**Decision (2026-11-03):** mora is Fineract's. Every late cuota accrues mora
from its own due date, daily, until it is paid or waived. The rate is the
loan's (10% per 30 days by default). Accrual stops when the oldest unpaid
cuota reaches 90 days late. This replaces Micobro's and Mikro's engine
(oldest cuota only, capped at one cuota, forgiven once that cuota is paid),
which charged well below Mikro's own contract (clause CUARTO).

How it runs, all verified live:

- **Accrual.** Each Fineract product carries an overdue-installment charge:
  `rate / 30` percent per day of what is still owed on the cuota. The
  nightly "Apply penalty to overdue loans" job adds one charge per late cuota
  per day. The currency has centavos, so 650 × 0.333333% = 2.17 a day. With
  whole pesos, every day would round to 1 or 2 and drift from 10%. Cuotas
  stay whole pesos (`installmentAmountInMultiplesOf: 1`).
- **Nightly close** (`Backoffice.closeDay`): move the business date, run the
  job, then charge off any loan whose oldest unpaid cuota is 90 days late.
  If nights were skipped, the close stops on the crossing day first, so
  the stop is exact.
- **Waivers.** A collector can forgive mora (`mora.waive`). Fineract waives
  whole daily charges, never part of one, and never one that is already
  paid. The server waives oldest first without going over the amount asked,
  reports any shortfall as drift, and records who waived what and why.

Gaps this surfaced:

**G-OFFLINE-MORA: on-time cobros that sync late got charged mora.**
Fineract's nightly job doesn't know about cobros still sitting on a device.
When those cobros arrive later, the mora they should have prevented stays
on the loan, and it eats part of the cobro (verified live: two on-time
cuotas synced five days late left RD$17.36 of mora and one cuota unpaid).
Fineract has no setting for this; `backdate-penalties-enabled` only
controls backfilling.
*Resolved in the BFF, verified live:* before posting a cobro dated before
the last close, the BFF replays the loan with Fineract's own rules
(`simulateMora`) as if every cobro had arrived the day it was made. It
waives the charges that shouldn't exist and adds a "Mora (ajuste)" penalty
for any that are missing. If a later cobro already paid a wrong charge, it
undoes the loan's repayments first and re-posts them after. A loan whose
cobros synced late ends up identical to one whose cobros synced on time,
including with two collectors. Voids and loan corrections run the same
repair.

**G-MORA-ALLOCATION: a cobro pays the oldest cuota first, its mora included.**
Fineract pays installment by installment: that cuota's mora, then interest,
then principal. Mora accrued after a cuota's due date sits in the *next*
cuota's period, so "one cuota plus its mora" doesn't clear it. There is no
"solo mora" and no "solo cuota". The app's cobro split (mora first across
the whole loan) no longer describes what happens. After cutover, the app
must show Fineract's split. Mora-first across every cuota would need
`advanced-payment-allocation-strategy`, which requires the progressive
schedule engine; not explored.

**G-GRACE: grace is one value per tenant, and grace days are never charged.**
Fineract's `penalty-wait-period` applies to every loan. Micobro has a
per-loan grace that only delays mora (pay after grace and you owe from the
due date). In Fineract the grace days are simply free. Mikro uses 0 days,
where the two agree. A loan created with its own grace is reported as
`graceDays` drift.

**G-MORA-RATE: the mora rate lives on the product.** Fineract refuses
overdue charges on a single loan. The BFF keeps one product per (loan type
× frequency × mora rate), named so the rate is visible (`TW2s` = term,
weekly, 10%).

**G-MORA-STOP: the 90-day stop is a charge-off.** Fineract's non-performing
flag doesn't stop the charges; only charge-off does. Cobros are still
accepted afterwards, booked as recoveries. Charge-off can only be undone
while it is the loan's last transaction.
*Decision (2026-11-03):* keep charge-off at 90 days. With accounting on, the
loan is booked as a loss at that point, and later cobros as recoveries,
the standard treatment for non-performing loans.

**G-MORA-VOLUME: one charge row per late cuota per day.** A 10-cuota loan
90 days late carries about 600 charge rows. The overdue job is tenant-wide,
and its run time grows with the portfolio (the live suite needs a fresh
tenant). Waivers are one API call per row. Fine at Micobro's scale, but
measure it before an MFI-sized tenant.

**G-APP-MORA: the app still runs the old engine.** Offline, the app must
show the mora the server will charge. `lib/loans/mora.ts` (and Mikro's
`lateFee.ts`) need to move to Fineract's rule. That's an app behavior
change and needs its own OpenSpec change. Until then, every mora cobro
reports `moraBeforeCents` drift.
*Decision (2026-11-03):* switch at cutover (Phase 2). The shipped app keeps
today's mora for lenders on Google Sheets; the new rule ships with the
back office connection.

**G-TXN-IDS: Fineract renumbers transactions when it re-processes.**
Undoing a repayment or posting a backdated one re-creates every later
repayment under a new id, keeping its external id (calibration probe
`transactionIdsAfterReprocess`). The BFF always finds repayments by external
id at the moment it needs them, never by a stored transaction id.

## Other gaps

Each gap has an id. Where the BFF refuses a mutation because of a gap, the
refusal carries the same id (`error.gap`).

### Verified differences

**G-ROUNDING: some cuota amounts differ by a peso or two.**
Micobro rounds the whole cuota half-up and puts the remainder on the last
cuota. Fineract rounds each cuota's principal to a whole peso first, adds
the interest (to the centavo), rounds that sum to a peso, and puts both
remainders on the last cuota (HALF_EVEN, tenant `rounding-mode` 6).
Example: 1,000 at 10% over 3 cuotas. The app shows 367 / 367 / 366. Fineract
schedules 366 / 366 / 368. Totals always match; some cuotas don't. Common
round numbers (5,000 / 30% / 10; 7,000 / 20% / 6; 1,000 / 12% / 7) match.
*Options:* (a) after cutover, show the server's schedule (the app stops
deriving it); (b) make the BFF write the app's amounts through Fineract's
variable installments (unverified); (c) change the app's rounding to match
Fineract's before cutover.
*Decision (2026-11-03):* (a). After cutover the app shows the server's
schedule. Loans imported at cutover may move a peso between cuotas.

**G-PHONE-UNIQUE: Fineract refuses two clients with the same `mobileNo`.**
In the DR, relatives often share a phone, and the app allows it today.
*Decision (2026-11-03):* require unique phones, as Fineract does. The app
must refuse a phone another customer already uses (an app change, so it
needs an OpenSpec change). Existing duplicates in a lender's data will be
refused at cutover import and have to be fixed first.

**G-BUSINESS-DATE: Fineract refuses transactions dated after its business
date.**
If a device's clock is ahead, or the nightly close hasn't moved the date
yet, the cobro is refused (`error.msg.loan.transaction.cannot.be.a.future.date`).
*Resolved in the contract:* this comes back as `NOT_YET`, which is
retryable. The mutation stays in the outbox and goes through on a later
sync. Operational consequence: each tenant's nightly close must run every
night, in America/Santo_Domingo time.

**G-LOAN-CORRECTION: Fineract won't change the terms of an active loan.**
Editar préstamo works at any time in the app. Fineract refuses to modify an
active loan (verified).
*Resolved in the BFF, verified live:* replay. Undo the disbursal (Fineract
reverses every repayment along with it and drops the mora), undo the
approval, modify, approve, disburse, re-post the cobro journal under
versioned external ids (`<id>~v2`), then run the mora job and the mora
repair. Replaying leaves reversed transactions in the audit trail, which is
correct but noisy.
The same replay voids a Tradicional Plus penalty (G-TP-VOID).
*Still open:* changing loan type or frequency means a different product,
and Fineract can't move a loan between products. That needs a new Fineract
loan (refused as UNSUPPORTED for now).

**G-SKIP-SUNDAYS: per-loan Sunday skipping.** Fineract's working days are
tenant-wide and *move* a Sunday cuota onto Monday's, and it refuses variable
installments on flat-interest products.
*Resolved in the BFF, verified live:* after disbursal, reschedule from each
cuota that lands on a Sunday to the Monday; Fineract moves every later cuota
with it (4 reschedules for a 24-day loan, matching the app's dates exactly).
Fineract's mora job still counts Sundays as late days; the app doesn't.

### Not mapped yet (refused as UNSUPPORTED)

**G-OPEN-CREDIT: crédito abierto.** Fineract has no revolving product.
Open credit is interest-only cycles on an outstanding balance with no fixed
term, where unpaid interest is capitalized. Candidates, none tested:
(1) a declining-balance loan with interest recalculation and compounding,
principal grace until the last period and a long nominal term; (2) a
BFF-owned ledger using Micobro's own `openCredit.ts` engine, posting only
journal entries to Fineract's GL. Needs its own spike. (2) is the safer bet.
*Deferred (2026-11-03):* skipped for now; the BFF keeps refusing it as
UNSUPPORTED.

**G-TP-VOID: voiding a Tradicional Plus penalty.** The penalty moved every
unpaid cuota one quincena, and Fineract refuses to reschedule a cuota to an
earlier date (`adjustedDueDate.before.rescheduleFromDate`, verified live).
*Resolved in the BFF, verified live:* the loan is rebuilt without the
penalty, using the same replay as Editar préstamo. Every cuota goes back to
where it was; any other penalties re-create their own reschedules.

### Not in Micobro yet

**G-FEES: legal and closing costs (gastos legales, gastos de cierre).**
Fineract supports both, verified live on a 10,000 / 30% / 10-week loan:
- *Collected at disbursement* (charge time "Disbursement", flat or % of
  principal): RD$500 legal + 3% closing = RD$800, recorded as a payment at
  disbursement. Cuotas stay 1,300.
- *Financed into the cuotas* (charge time "Installment fee"): RD$50 per
  cuota, or a % of each cuota's principal, added to every cuota (1,300 →
  1,353 in the probe).
- *One-off on a date* (charge time "Specified due date") for a cost charged
  later, like a notary fee.
Micobro has no fees today, so the app's Nuevo préstamo, the contract
(`loan.create`) and the schedule all need a fees field before the back
office can carry them.

### Decisions the back office owns (Fineract has no equivalent)

**G-TP-OWED: Tradicional Plus penalties owed.** The app derives owed
penalties (cycles past grace with nothing paid) from the payment rows. The
server needs the same engine (`lib/loans/tradicionalPlus.ts`, once #189
merges) to show "En atraso" and to refuse a cuota while penalties are owed.
Tradicional Plus products carry no mora charge.

**G-ARCHIVE: archive / restore.** In the app, archiving only hides a loan
(status `cancelled`). In Fineract it could mean write-off, which has
accounting impact, or nothing.
*Decision (2026-11-03):* hide only. Archive stays a back office flag;
nothing changes in Fineract, and the loan keeps accruing and stays on the
books. A write-off, when needed, is a separate explicit action.

**G-VISITS, G-CASH-CLOSE: visits/promises and cierre de caja.** Fineract has
nothing like visits (client notes aren't structured). Its teller/cashier
module is a lot heavier than a single-collector caja. Both stay in the BFF's
store. The cash close is checked against the payments the server knows
about, and a mismatch is reported as drift.

### Found by reading, not exercised

- **Receipt numbers.** `R-00001` is "count of payment rows on this
  device". With several collectors on one tenant, numbers collide. The
  server should issue them, or prefix them per device.
- **Cédula** → a Fineract client identifier. This needs a "Cédula"
  document-type code value; Fineract enforces uniqueness per type, which is
  probably what we want.
- **Address** → Fineract's address module is off by default
  (`enable-address`). Alternatives: enable it, or use a datatable. **Avatar**
  → datatable or BFF.
- **Loan status `defaulted`** exists in the app's schema but nothing sets
  it. Fineract's closest equivalent, write-off, posts to the GL.
- **Accounting.** The POC products use accounting rule "none". Turning on
  cash or accrual accounting means designing a chart of accounts per
  tenant, including the loss and recovery accounts for charge-off (G-MORA-STOP)
and how mora waivers post.
- **Time zones.** Contract instants carry the device's UTC offset, and
  their date part is the business date. The tenant's timezone is set to
  America/Santo_Domingo (no DST).
- **Reports** (Mi cartera, route day) are composed in the app from local
  rows. After cutover the BFF composes them from Fineract plus its own
  store.

## What this means for Phase 2

1. Fineract handles **term loans** (the bulk of the portfolio) and
   Tradicional Plus well, mora included. The gaps there are solvable in the
   BFF, and the POC already solves most of them.
2. **Crédito abierto** is the real risk. It needs its own spike, and a
   BFF-owned ledger is the likely answer.
3. The contract's shape (outbox replay, app UUIDs as external ids,
   per-mutation results, `clientView` drift) held up across every
   scenario. Phase 2 adds the auth token (tenant + device identity, e.g.
   Fonoster Identity) and the pull side (`LoanStateV1`) for cutover.
4. The BFF owns a **nightly close** per tenant (business date, mora job,
   90-day charge-off). It needs scheduling, monitoring, and a catch-up path.
5. The app's mora engine has to change to Fineract's rule (G-APP-MORA)
   before cutover, so offline numbers match what the server will charge.
