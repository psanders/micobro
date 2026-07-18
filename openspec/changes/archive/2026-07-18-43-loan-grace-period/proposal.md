# Proposal: loan-grace-period

## Why

Closes #43. `lib/loans/mora.ts` has always had a `MoraPolicy.graceDays`
concept — "no mora if days late is at or below this" — and
`computeAccruedMora`/`computeLoanMora` already implement it correctly. But
`DEFAULT_MORA_POLICY.graceDays` is `0`, and every call site
(`getCustomerDetail.ts`, `getLoanDetailView.ts`, `getCollectContext.ts`,
`composeRouteDay.ts`) calls `computeLoanMora(loan, payments, today)` with no
`policy` argument at all. So today every loan effectively has a zero-day
grace period, with no way to change it — the machinery exists but is
unreachable.

## What Changes

- **Grace period is per-loan, not a single app-wide constant.** The issue's
  acceptance criteria says "Loans have a grace period field" (per-loan) and
  calls it "configurable" — a lender extending credit to a longtime
  reliable client vs. someone new plausibly wants different leeway. `loans`
  gets a nullable `grace_days` integer column (migration
  `0006_unknown_mastermind.sql`); `null` means "use the default"
  (`DEFAULT_GRACE_DAYS = 7`, resolved at read time via
  `effectiveGraceDays`/`loanMoraPolicy` in `lib/loans/mora.ts`) rather than
  a data migration backfilling every existing row to `7`.
- **Mora (late fee) accrual now actually respects the configured grace
  period.** Every call site that computes `computeLoanMora` now passes
  `loanMoraPolicy(loan)` instead of relying on the old always-zero
  `DEFAULT_MORA_POLICY` default, so the mora fee genuinely does not start
  accruing until `graceDays` (7 by default) days after a cuota's due date.
- **The Plan de pagos "ATRASO" schedule status is deliberately left
  grace-blind.** `lib/loans/loanViews.ts`'s `buildLoanDetailView` still
  flips a cuota to `"overdue"` the instant its due date passes, with no
  grace period involved. This is a considered choice, not an oversight —
  see "Design decision" below.
- **Nuevo Préstamo form** gains a "Período de gracia (días)" numeric field,
  pre-filled with `7` (`DEFAULT_GRACE_DAYS`), so a lender sees and can
  override the default at loan creation.
- **Sync (Google Sheets)** round-trips the new field: `Préstamos` gains a
  12th column (`A:K` → `A:L`, "Período de gracia (días)"), so a lender's
  configured grace period survives a device reinstall/pull.

### Design decision: two different "overdue" concepts, one grace-gated, one not

The codebase already has two distinct notions of "overdue," and the
acceptance criterion "Overdue logic respects the grace period" is
ambiguous about which one it means:

1. **Mora fee accrual** (`lib/loans/mora.ts`) — a financial penalty. This
   is the "overdue logic" that is literally named that in code
   (`oldestOverdueInstallment`) and is the one this change wires up to the
   grace period.
2. **Schedule status** (`lib/loans/loanViews.ts`'s `LoanScheduleItem.status`
   and its knock-on effects: the "ATRASO" highlight in Plan de pagos, the
   `RouteVisit.status`/`overdueDays` shown in Mi Ruta) — an operational
   signal telling the lender/collector "this needs a visit," independent
   of any late-fee leniency.

Evidence this split is intentional, not incidental: the mock exemplar data
(`lib/repo/mock/fixtures.ts`) has `loan-3` (José Núñez) three days overdue
already carrying RD$750 of mora, and `loan-4` (Felipe Taveras) six days
overdue already carrying RD$600 of mora — both well inside a 7-day grace
window. `openspec/specs/loan-detail/spec.md`'s "Overdue cuota plus mora"
scenario is built on exactly this exemplar. Making the schedule's "overdue"
status itself grace-gated would either invalidate that worked example and
the mock fixtures, or require decoupling the mock's (fixture-driven, not
computed) mora display from the real grace-aware computation — a much
larger, riskier change for behavior nothing in the issue asks for.

The interpretation this change settles on: a lender should still see a
payment flagged "ATRASO" — and the collector should still be routed to it
in Mi Ruta — starting the day after its due date, exactly as before. What
changes is that the client isn't charged a late fee (mora) until they're
genuinely, meaningfully late (past the grace period). This mirrors how
grace periods work in real lending practice — a courtesy window on
penalties, not a courtesy window on whether the payment is tracked as
late — and keeps `loanViews.ts` and `mora.ts` internally consistent: one
signals "needs collecting," the other computes "what's owed," and only the
latter is grace-aware.

## Capabilities

### Modified Capabilities

- `loan-detail`: "Total a pagar hoy" mora line is now grace-gated per loan
  (`graceDays`, default 7) instead of accruing from day one; the "ATRASO"
  schedule-status requirement is clarified as intentionally due-date-only,
  not grace-gated.

## Impact

- `lib/db/schema.ts` — `loans.graceDays` (nullable integer); migration
  `lib/db/migrations/0006_unknown_mastermind.sql`.
- `lib/loans/loan.schema.ts` — `DEFAULT_GRACE_DAYS = 7`; `createLoanSchema`
  gains optional `graceDays`; `Loan.graceDays: number | null`.
- `lib/loans/mora.ts` — new `effectiveGraceDays(loan)` and
  `loanMoraPolicy(loan)` helpers; `DEFAULT_MORA_POLICY.graceDays` stays `0`
  (it's the formula-level, no-override default used directly by
  `computeAccruedMora`'s own unit tests — the app itself never calls it
  bare).
- `lib/loans/createLoan.ts`, `lib/repo/mock/index.ts` — persist
  `graceDays` on create.
- `lib/customers/getCustomerDetail.ts`, `lib/loans/getLoanDetailView.ts`,
  `lib/payments/getCollectContext.ts`, `lib/route/composeRouteDay.ts` — all
  four `computeLoanMora` call sites now pass `loanMoraPolicy(loan)`.
- `components/screens/NewLoanFormScreen.tsx` — "Período de gracia (días)"
  field, defaulting to `DEFAULT_GRACE_DAYS`.
- `lib/sync/push.ts` (`ENTITY_RANGES.loan` → `A:L`, `loanRowValues`),
  `lib/sync/pull.ts` (`rowToLoan`), `lib/sync/provisionSheet.ts`
  (`TAB_HEADERS.loan`) — the loans Sheet tab round-trips `graceDays`.
- `lib/repo/mock/fixtures.ts` — every fixture loan now has an explicit
  `graceDays: null` (uses the default); nothing about the mock's mora
  display changes, since it's fixture-driven rather than computed (see
  design decision above).
- Tests: `__tests__/mora.test.ts` (new `effectiveGraceDays`/
  `loanMoraPolicy` coverage, plus end-to-end grace suppression),
  `__tests__/composeRouteDay.test.ts` (new grace-suppressed and
  grace-override scenarios), `__tests__/push.test.ts`,
  `__tests__/pull.test.ts` (12-column loan row round-trip).
