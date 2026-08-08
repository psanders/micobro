## Why

`addFrequencyInterval` in `lib/loans/loanViews.ts` advances monthly loans
with a bare `Date.setMonth`, which JavaScript normalizes forward when the
target month is too short for the day-of-month (Sep 31 → Oct 1) instead of
clamping to the month's last day. This makes monthly cuota/cycle dates
oscillate instead of drift back to the anchor day, and skips February
entirely for a loan anchored on the 29th, 30th, or 31st. It affects both
term loans (`installmentDueDate`, feeding `computeLoanMora`) and open-credit
loans (`openCreditState`'s cycle windows, interest, and payment
attribution) — every caller of `addFrequencyInterval` with `frequency ===
"monthly"`. Closes #110.

The month-end rule has never been written down as observable behavior —
only implied by the code — which is the same gap that caused issue #107.

## What Changes

- `addFrequencyInterval` clamps a monthly shift to the target month's last
  day, but preserves the original anchor day-of-month so a later, long
  enough month returns to it (31 Jul → 31 Aug → 30 Sep → 31 Oct → 30 Nov →
  31 Dec), instead of the invalid-date rollover it does today.
- This is a pure bug fix to existing monthly-loan date math — no new UI, no
  schema change, no new persisted field. The `NewLoanFormScreen` "primer
  pago" round-trip (`startDate = addFrequencyInterval(firstPaymentDate,
frequency, -1)`) is narrowed by this fix but not fully closed for every
  pick: when the chosen day doesn't exist in the _preceding_ month (e.g. 31
  Mar, since February is shorter), the round-trip still lands one cuota off
  the lender's original pick. That residual gap is a pre-existing
  limitation of storing a single `Date` as the anchor and is out of scope
  here.

## Capabilities

### Modified Capabilities

- `loan-configuration`: the "First payment date" requirement's implicit
  contract — that a mensual loan's cuota/cycle dates fall on the same
  day-of-month as `startDate` — is made explicit, with the month-end clamp
  and anchor-restore rule spelled out.

## Impact

- `lib/loans/loanViews.ts` — `addFrequencyInterval` (the fix), whose JSDoc
  is updated to state the clamp rule; `installmentDueDate` and
  `defaultFirstPaymentDate` inherit the fix since both call it.
- `lib/loans/openCredit.ts` — `openCreditState`'s cycle windows (lines
  133–134, 212, 226, 232) all build from `addFrequencyInterval`, so monthly
  open-credit interest windows, `nextDueDate`, and payment→cycle
  attribution are all corrected.
- `components/screens/NewLoanFormScreen.tsx` (line 146) — the "primer pago"
  → `startDate` backward derivation is unchanged in code, but its
  round-trip behavior narrows (see What Changes).
- `computeLoanMora` (consumes `installmentDueDate`'s output) — lateness for
  monthly loans is now measured against corrected due dates.
- Tests: `__tests__/loanViews.test.ts`, `__tests__/openCredit.test.ts`.
