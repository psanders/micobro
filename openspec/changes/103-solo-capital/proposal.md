## Why

Closes #103. Two problems on the Crédito Abierto cobrar screen, shipped
together because they are answered by the same piece of state — "is this
cycle's interest already covered?".

First, there is no way to pay capital only. A client who already paid this
cycle's interest and wants to knock the balance down has no option that says
so: the screen offers **Solo interés** and **Interés + capital**, and both are
anchored to an interest amount that has already been settled.

Second, and worse, the screen will re-charge interest that was already paid.
`CollectPaymentScreen` reads its interest figure from
`openCreditState().interestDueCents`, which deliberately rolls forward to the
NEXT cycle's interest once the current cycle is covered (openCredit.ts lines
213-227) so that a capital paydown lowers the shown interest immediately. The
side effect is that right after a client pays exactly the cycle interest, the
screen still offers "Solo interés — RD$1,000". Verified against the engine:

    Loan RD$10,000 @ 10% mensual, client pays RD$1,000 on Jul 1
      cycle status ..... interest_only   (correctly settled)
      cycle paidCents .. RD$1,000
      interestDueCents . RD$1,000        <- next month's, offered as if due now

So a lender can collect next month's interest a month early without noticing.
That is the "it still shows a value there" behavior reported in the field.

## What Changes

- Add a third payment option, **Solo capital**, to the Crédito Abierto cobrar
  screen. It is enabled only when the current cycle's interest is covered in
  full.
- When the cycle's interest is covered, disable **Solo interés** (showing RD$0
  rather than the next cycle's interest) and disable **Interés + capital**.
  Both stay visible, greyed, with a note explaining the interest for this
  cycle is already paid — so the lender understands why rather than wondering
  where the options went.
- No change to the cycle engine, no new payment type, no DB migration, no new
  Sheets column.

## Impact

- Affected specs: `collect-payment`
- Affected code: `components/screens/CollectPaymentScreen.tsx` only.
  `lib/loans/openCredit.ts`, `lib/payments/payment.schema.ts` and the sync
  layer are deliberately untouched.
