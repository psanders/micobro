# Proposal: per-loan-mora

## Why

Closes #56. `lib/loans/mora.ts` applies `DEFAULT_MORA_POLICY.rate` (10% /
30 días) to every loan uniformly. Only `graceDays` is per-loan today
(`Loan.graceDays`, added by `43-loan-grace-period`); the mora _rate_ and
whether mora applies at all are fixed. Real lenders don't work that way: a
lender extends different terms to different clients — some pay no late fee,
others a rate that isn't 10% — and there's no way to express that at loan
creation. This change makes mora per-loan configurable, reusing the exact
nullable-default pattern `graceDays` already established.

## What Changes

- **Mora is now opt-out and its rate is per-loan.** `loans` gets two
  nullable columns — `mora_enabled` (integer/boolean) and `mora_rate_bps`
  (integer) — mirroring `grace_days`: `null` means "use the default"
  (mora enabled, `DEFAULT_MORA_RATE_BPS = 1000` bps = 10%), resolved at
  read time rather than backfilling existing rows. A drizzle migration is
  generated via `npm run db:generate` (never hand-edited).
- **`loanMoraPolicy(loan)` resolves rate and enablement from the loan.**
  New helpers `isMoraEnabled(loan)` (`loan.moraEnabled ?? true`) and
  `effectiveMoraRateBps(loan)` (`loan.moraRateBps ?? DEFAULT_MORA_RATE_BPS`)
  join the existing `effectiveGraceDays`. `loanMoraPolicy` now sets
  `rate` to `effectiveMoraRateBps(loan) / 10000`, and short-circuits to
  `rate: 0` when `isMoraEnabled(loan)` is false — `computeAccruedMora`
  already returns zero mora when `policy.rate <= 0`, so a disabled loan
  accrues nothing at every existing call site with no further wiring.
- **No call-site changes needed.** All four `computeLoanMora` call sites
  (`getCustomerDetail.ts`, `getLoanDetailView.ts`, `getCollectContext.ts`,
  `composeRouteDay.ts`) already pass `loanMoraPolicy(loan)` (from
  `43-loan-grace-period`), so they pick up per-loan rate/enablement for
  free — the same reason grace only had to change `mora.ts` centrally.
- **Nuevo Préstamo form** gains a "Cobrar mora por atraso" toggle switch,
  **defaulting to off** (mora is opt-in — a new loan never auto-charges the
  10% default). Turning it on reveals a "Tasa de mora (%)" field pre-filled
  with `10` (editable), in Spanish, below the "Tasa de interés (%)" field.
  Off sends `moraEnabled: false`; on sends `moraEnabled: true` plus the
  entered `moraRate`.
- **Sync (Google Sheets)** round-trips both fields: `Préstamos` grows from
  12 columns (`A:L`) to 14 (`A:N`) with "Mora activa" and "Mora (bps)"
  headers, so a lender's mora configuration survives a device
  reinstall/pull.

### Design decision: percentage input, basis-points storage

The `Loan` model stores `moraRateBps` (basis points, `1000` = 10%),
matching how `interestRateBps` is stored, while the form and
`createLoanSchema` take a human `moraRate` **percentage** (`10`) that
`createLoan` converts with `Math.round(moraRate * 100)` — exactly the
`interestRate → interestRateBps` treatment already in `createLoan.ts`.
`createLoanSchema` therefore gains `moraEnabled?: boolean` and
`moraRate?: number` (optional; omitted means "use the default"), not a raw
bps field, so the UI and validation stay consistent with interest.

### Design decision: nullable columns, resolved at read time

Both columns are nullable and `null` means "default," identical to
`graceDays`. This avoids a data migration over existing loans and keeps a
single source of truth for the defaults (`DEFAULT_MORA_RATE_BPS` and the
implicit `enabled = true`) in `lib/loans/mora.ts`. `moraEnabled === false`
is the only value that disables mora; `null` and `true` both enable it.

### Design decision: opt-in at creation, backward-compatible at rest

Mora is **opt-in in the creation flow** — the Nuevo Préstamo toggle
defaults off, so a lender never accidentally charges the 10% default; they
must deliberately enable mora and set its rate. But the _data-layer_
default (`null`) stays "enabled at 10%" so existing loans and the mock
exemplars keep their current mora behavior with no data migration and no
retroactive change to loans already on a lender's device. In other words:
new loans are silent-off unless chosen; pre-existing loans are unchanged.
This satisfies the issue's "omitting both fields preserves current
behavior" while making the deliberate-choice UX the user asked for.

## Capabilities

### Modified Capabilities

- `loan-detail`: the "Total a pagar hoy" mora line is now gated by the
  loan's own mora configuration — it never appears when the loan has mora
  disabled, and its amount reflects the loan's configured rate rather than
  a fixed 10%.

## Impact

- `lib/db/schema.ts` — `loans.moraEnabled` (nullable boolean),
  `loans.moraRateBps` (nullable integer); new generated migration under
  `lib/db/migrations/`.
- `lib/loans/loan.schema.ts` — `createLoanSchema` gains optional
  `moraEnabled` / `moraRate`; `Loan` gains `moraEnabled: boolean | null`
  and `moraRateBps: number | null`.
- `lib/loans/mora.ts` — `DEFAULT_MORA_RATE_BPS = 1000`; new
  `isMoraEnabled(loan)` / `effectiveMoraRateBps(loan)` helpers;
  `loanMoraPolicy` resolves `rate` from the loan and zeroes it when mora
  is disabled. `DEFAULT_MORA_POLICY` stays the formula-level default.
- `lib/loans/index.ts` — export the new symbols.
- `lib/loans/createLoan.ts`, `lib/repo/mock/index.ts` — persist
  `moraEnabled` (`?? null`) and `moraRateBps` (`Math.round(moraRate * 100)`
  or `null`) on create.
- `components/screens/NewLoanFormScreen.tsx` — "Cobrar mora por atraso"
  switch + conditional "Mora (%)" field.
- `lib/sync/push.ts` (`ENTITY_RANGES.loan` → `Préstamos!A:N`,
  `loanRowValues`), `lib/sync/pull.ts` (`rowToLoan`),
  `lib/sync/provisionSheet.ts` (`TAB_HEADERS.loan`) — 14-column loan row.
- `lib/repo/mock/fixtures.ts` — every loan fixture gets explicit
  `moraEnabled: null` and `moraRateBps: null` (default behavior unchanged;
  the exemplar loans keep their RD$750 / RD$600 mora).
- Tests: `__tests__/mora.test.ts` (new `isMoraEnabled`,
  `effectiveMoraRateBps`, disabled/custom-rate/default `loanMoraPolicy`,
  end-to-end disabled-never-accrues and custom-rate `computeLoanMora`),
  `__tests__/push.test.ts` / `__tests__/pull.test.ts` (14-column loan row
  round-trip). `__tests__/provisionSheet.test.ts` auto-guards the header
  width against the push range.
