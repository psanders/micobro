# Design

## Context

Tradicional (`loanType = null`/`"term"`) derives everything from the loan
record and its payments: `installmentDueDate(loan, n)` gives cuota `n`'s date,
`principalPaidCents` (every payment except `notes = "mora"`) says how far the
schedule is paid, and `lib/loans/mora.ts` adds a late fee after `graceDays`.
Nothing about schedule progress is stored. Crédito Abierto follows the same
rule with its own engine (`lib/loans/openCredit.ts`). Payments carry their kind
in `notes` (`MORA_NOTE`), and the Sheet mirrors `loans`/`payments` column by
column (`lib/sync/push.ts`, `sheetRows.ts`).

See proposal.md for the why, and the four spec deltas for behavior.

## Goals / Non-Goals

**Goals:**

- Derive a Tradicional Plus loan's whole state (moved due dates, owed
  penalties, atraso, paid off) from the loan and its payments, so sync, edits
  and Sheet round-trips need no extra stored state.
- Reuse Tradicional's cuota math, schedule and screens wherever behavior
  matches, and branch only where it differs.

**Non-Goals:**

- Frequencies other than quincenal (the engine is frequency-agnostic, the form
  just locks it; opening others later is a form change).
- Converting an existing loan to or from Tradicional Plus once it has payments.
- Paying several cuotas, or paying off the loan, in one cobro.
- Showing penalty income as its own line in Mi cartera (it stays out of "to
  collect" and margin, like collected mora).

## Decisions

### 1. Store the type and the penalty on the loan; derive everything else

`loanTypes` becomes `["term", "open_credit", "term_plus"]`, and `loans` gains a
nullable `penalty_cents` integer (null for every other type, required by the
schema when `loanType = "term_plus"`). The grace period reuses the existing
`graceDays` (null → `DEFAULT_GRACE_DAYS`). `moraEnabled` is stored `false`, so
every existing mora path already returns zero.

Alternative: storing a "shift count" on the loan. Rejected: it would be a
second source of truth that payments, edits, deletes and Sheet pulls can all
put out of step. Counting penalty payment rows can't drift.

### 2. A payment's kind is its own `tipo` column; penalties are one row each

`payments.tipo` ("cuota" | "mora" | "penalidad", default "cuota", no CHECK
constraint) holds every payment's kind, for every loan type. `notes` is free
text and is never read for the kind: it lived in the Sheet's editable Notas
cell, where an edit silently turned a mora or a penalty into principal
(tasks.md 8.1). `lib/payments/paymentNotes.ts` keeps the readers
(`isPrincipalPayment`, `isPenaltyPayment`, `isMoraPayment`) and the one place
the old flags survive, `legacyPaymentKind(notes)` (exact, case-sensitive),
which the custom migration, restore, push of old queued payloads and the Pagos
layout migration all apply the same way.

Collecting N penalties writes N rows of exactly `penaltyCents`, all with one
`paidAt`, so "number of penalties paid" is a row count and stays right even if
the lender later edits the penalty amount. "Penalidades + cuota" adds the cuota
row after them in the same cobro; within one `paidAt`, penalties sort before
the cuota, so the result never depends on storage order.

The Pagos tab carries the kind in a new column H "Tipo", appended so A–G don't
move (`lib/sync/pagosLayout.ts`, modeled on `clientesLayout.ts`): decided from
the Sheet's H1, data filled before H1 is written, H protected warning-only, and
payment push/pull gated until confirmed. Pull never changes an existing
payment's kind (except one adoption on a phone that first meets a Sheet another
phone migrated), so the protection is a courtesy and the pull rules are what
protect balances.

Alternatives: one row of N × penalty (breaks the count when the penalty amount
changes); protecting Notas instead of moving the kind (a protected cell is still
editable after a warning, and Notas is where lenders write notes).

### 3. A cycle engine in `lib/loans/tradicionalPlus.ts`

A pure `tradicionalPlusState(loan, payments, today)`, mirroring
`openCreditState`:

- `P` = penalty rows, `K` = cuotas paid (from principal paid against the cuota
  schedule, as `oldestOverdueInstallment` walks it today).
- The next uncovered cycle is `c = P + K + 1`, due
  `addFrequencyInterval(startDate, frequency, c)`. Cuota `k` (k > K) is due on
  cycle `k + P`, so the end date is cycle `termCount + P`. A paid cuota keeps
  the cycle it had when it was paid (its number plus the penalties paid before
  it), found by one chronological walk — display only, so the Plan de pagos
  never shows a paid cuota at a date after it was paid.
- Owed penalties = the cycles `≥ c` whose `dueDate + graceDays` is before today.
- Returns: `nextCuotaNumber`, `nextDueDate`, `owedPenalties`, `owedCents`,
  `timesMoved = P`, `schedule` (cuota → moved date), `endDate`, `daysLate`,
  `isOverdue` (`nextDueDate < startOfToday`, as for Tradicional's ATRASO),
  `canCollectCuota`, and `canCollectPenalty` (owed > 0, or the next cycle is
  due today or within grace).

For everything that decides money and status, this is history-free counting:
it doesn't matter which cycle each penalty was paid for, only how many. That
matches the rule "each penalty moves the schedule one cycle", and it means a
Sheet-pulled or reordered payment can't change what is owed.

`buildLoanDetailView` branches on `effectiveLoanType(loan) === "term_plus"`:
it takes the cuota dates from the engine, zeroes mora, and puts owed penalties
as the only "Total a pagar hoy" line. The route, upcoming customers and Mi
cartera already build on that view, so they need no branch of their own.
`computeLoanMora` returns zero for this type, and `loanEndDate` takes the
loan's payments to return the moved end date.

### 4. Validation lives in `collectPayment`

`collectPayment` re-runs the engine on the stored payments, not the screen's
numbers, and rejects (a plain `Error` with a Spanish message, as `updateLoan`
does for its business rules) any Tradicional Plus cobro that
isn't exactly the next cuota (with no penalties owed) or exactly
`owed × penalty` (or one penalty when the next cycle is due and nothing is
owed). That keeps the "no partial payments" and "penalties first" rules true
even if the screen is wrong. The screen says which kind it is collecting with
`CollectInput.penaltyCount`. `getCollectContext` returns the engine state, and
a new `resolveTradicionalPlusPayOptions(state)` (beside
`openCreditPayOptions.ts`) builds the two options, their enabled state and
notes.

### 5. Sheet: append "Penalidad (centavos)" as the last Préstamos column

The Préstamos header gets "Penalidad (centavos)" after "Actualizado" (column
Q). Appending, unlike the Cédula insert, moves no existing cells, so the only
upgrade step is writing the `Q1` header when it's missing, checked once and
cached in `sync_meta` the way `clientesLayout` does. `loanRowValues` and
`loanFromRow` gain the column, and an empty cell reads as null.

Alternative: inserting the column next to "Tipo". Rejected: it needs the
whole insert-column migration for a field lenders rarely read in the Sheet.

### 6. UI reuses Tradicional's screens with type branches

`NewLoanFormScreen` adds the third Tipo option, the Penalidad field, locks
Frecuencia to Quincenal and hides the mora fields. `CollectPaymentScreen` swaps
in the two-option list for this type, the way it already swaps in open credit's.
Loan detail and receipts add the chips and lines from the loan-detail and
collect-payment specs. All copy is Spanish. Pencil frames come first (design
gate).

## Risks / Trade-offs

- [Older app builds reject `term_plus` on pull ("el tipo" isn't one of the
  allowed values)] → Release note: update every device that shares the Sheet.
  It's the same exposure open credit had when it shipped.
- [Collecting penalties for several cycles writes several rows, so the Sheet
  shows N lines for one cobro] → They share `paidAt` and a receipt number, and
  history groups them into one cobro, as it does for mora + cuota.
- [The lender edits the penalty amount after penalties were paid] → Counting
  is by rows, so the schedule doesn't change; only future penalties use the new
  amount. Old rows keep their recorded amount.
- [A payment row deleted in the Sheet un-moves the schedule] → That's intended
  under the app's two-way sync: the Sheet edit is the lender's correction.
- [Owed penalties grow with no cap for an abandoned loan] → It matches the
  agreed rule (no limit). The lender can archive the loan.

## Migration Plan

1. `npm run db:generate` for the `penalty_cents` column (nullable, no backfill).
2. On first push after updating, write the `Q1` header if missing. New Sheets
   get it from `provisionSheet`.
3. Rollback: an older build ignores column Q and fails only on `term_plus`
   rows, so remove those loans (or don't create any) before rolling back.
