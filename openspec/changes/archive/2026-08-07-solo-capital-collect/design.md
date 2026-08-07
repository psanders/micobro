## Context

Crédito Abierto has no fixed cuota. The client owes a capital balance, each
cycle accrues interest on it, and the cobrar screen is where the lender decides
how a payment is split. Today it offers two options; this change adds a third
and makes the existing two aware of whether the cycle's interest is already
settled.

## Key finding — no schema change is needed

The cycle engine sums every payment falling inside the cycle window and applies
`capital = total paid − cycle interest` (openCredit.ts lines 154-158). So once
the cycle's interest is covered, any further payment in that same cycle already
flows entirely to capital, with no marker on the payment row. Verified:

    Pays RD$1,000 (interest) Jul 1, then RD$5,000 Jul 10 — same cycle
      paidThisCycle .. RD$6,000
      capitalPaid .... RD$5,000
      balance ........ RD$10,000 -> RD$5,000
      status ......... interest_plus_capital

"Solo capital" is therefore a **presentation** concern: it is an ordinary
payment recorded at a moment when the engine will route all of it to capital.
`Payment` keeps its current shape (amount, date, method, notes) — no
`appliesTo` field, no migration, no new column in the lender's sheet.

## Goals / Non-Goals

**Goals**

- Let a lender pay down capital once the cycle's interest is settled.
- Stop offering interest that has already been collected for this cycle.
- Keep every disabled option visible and explained.

**Non-Goals**

- Changing `openCredit.ts`. The split rules stay exactly as they are.
- Daily/prorated interest. Tracked separately; interest here remains a
  per-cycle amount.
- Term loans. They have fixed cuotas and are untouched.
- A "pay off the whole balance" shortcut for Solo capital. The lender types the
  amount, matching the existing Interés + capital pattern.

## Decisions

### Solo capital stays disabled under partial coverage

If the client paid RD$400 of a RD$1,000 interest, a "Solo capital" payment
would not be capital-only: the engine sends RD$600 to the outstanding interest
first and only the remainder to capital. Verified — a RD$5,000 payment in that
state lands the balance at RD$5,600, not RD$5,000.

Enabling the option there would make its label lie. **Solo capital unlocks only
when the cycle's interest is covered in full.** Under partial coverage the
screen behaves exactly as it does today: Solo interés (for the remainder) and
Interés + capital both stay live.

### Interés + capital is disabled once interest is covered

With the interest already covered its interest portion would be RD$0, making it
functionally identical to Solo capital but with a misleading name. Disabling it
removes no capability. Stated positively: **Interés + capital is available
whenever there is pending interest**, which is the only time it means anything.

### Disabled, not hidden

Options that disappear read as a bug to the lender. They stay in place, greyed,
with a note — so the screen explains itself.

## Worked example — verified against the engine

`RD$10,000 @ 10% mensual`, cycle 1 = Jun 1 → Jul 1, cycle 2 = Jul 1 → Aug 1.

| Moment                  | Cycle interest | Paid in cycle | To capital | Balance   | Solo capital |
| ----------------------- | -------------- | ------------- | ---------- | --------- | ------------ |
| Cycle 1, nothing paid   | RD$1,000       | RD$0          | —          | RD$10,000 | disabled     |
| Pays RD$1,000           | RD$1,000       | RD$1,000      | RD$0       | RD$10,000 | **enabled**  |
| Returns, pays RD$2,000  | RD$1,000       | RD$3,000      | RD$2,000   | RD$8,000  | **enabled**  |
| Returns again, RD$3,000 | RD$1,000       | RD$6,000      | RD$5,000   | RD$5,000  | **enabled**  |
| Cycle 2 opens           | **RD$500**     | RD$0          | —          | RD$5,000  | disabled     |

Cycle 2's interest is RD$500, not RD$1,000, because capital came down — paying
capital is rewarded the following cycle.

## Open question

A 0% loan makes `interestDueCents` zero, which reads as "covered" on the first
render with nothing paid. Decide during build whether zero-interest counts as
covered (enabling Solo capital immediately, which is arguably correct) or is
special-cased.

## Risks

- **Lender confusion when a cycle closes underpaid.** Paying capital does not
  protect the cycle: if its interest is not covered by the due date, the
  shortfall still capitalizes. Existing behavior, unchanged here, but the
  disabled-state note should not imply the cycle is settled for good.
