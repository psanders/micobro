## 1. Data

- [x] 1.1 Add `formatFullDate` (dd/mm/yyyy) to `lib/utils/dates.ts`, leaving
      `formatShortDate` untouched — built manually, since Hermes ignores
      Intl's `2-digit` and won't zero-pad.
- [x] 1.2 Add `loanEndDate(loan)` to `lib/loans/loanViews.ts` — the last
      cuota's due date, `null` for crédito abierto.
- [x] 1.3 Extend `PaymentReceipt` (`lib/repo/types.ts`) with `loanStartDate`,
      `loanEndDate`, `isOpenCredit`.
- [x] 1.4 Populate them in `buildPaymentReceipt` and in both `collect()`
      implementations (`lib/payments/collectPayment.ts`, `lib/repo/mock/index.ts`).

## 2. Rendering

- [x] 2.1 Digital receipt (`components/ReceiptView.tsx`): add the start and
      vencimiento rows, relabel the payment date "Fecha de pago".
- [x] 2.2 Printed receipt (`lib/printer.ts`): same two rows with the short
      labels the 32-column width allows, payment row relabelled "Pago".
- [x] 2.3 Each surface derives its own labels from `isOpenCredit`, so printed
      copy never leaks into a screen component.
- [x] 2.4 Omit a row whose date is unknown rather than rendering it blank.

## 3. Wiring

- [x] 3.1 `components/ReceiptActions.tsx` formats once and forwards to both
      surfaces.
- [x] 3.2 Historical path: `PaymentReceiptScreen` → `ReceiptActions`.
- [x] 3.3 Live path: `CollectPaymentScreen` sends the new router params (ISO
      dates, `"true"`/`"false"` flag); `app/pago-confirmado.tsx` parses them
      back; `PaymentConfirmedScreen` passes them through.

## 4. Tests

- [x] 4.1 `__tests__/printer.test.ts` — the new and relabelled rows for both
      loan types, byte-level.
- [x] 4.2 `__tests__/printer.test.ts` — every printed line ≤ 32 characters,
      for both loan types.
- [x] 4.3 `__tests__/printer.test.ts` — a row with an unknown date is omitted,
      and open credit still prints its vencimiento.
- [x] 4.4 `__tests__/loanViews.test.ts` / `__tests__/getPaymentReceipt.test.ts`
      — the new fields populated for a term loan and a crédito abierto loan.
- [x] 4.5 `npx tsc --noEmit`, `npx jest`, and `eslint` on changed files green.
