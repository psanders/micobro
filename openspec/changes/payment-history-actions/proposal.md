## Why

Closes #72 and #40, shipped together because they land on the same screens
and the fix for one unlocks the other. #72: the "Primer pago" field on
Nuevo Préstamo only cycles through three fixed presets on tap (added in
44-loan-first-payment-date, which deliberately avoided a native
date-picker dependency) — lenders who want a first-payment date outside
those presets have to tap through every option to reach it. #72 also asks
that tapping a past payment on Histórico de Pagos take the lender to
something with the same familiar feel as the just-collected "¡Pago
registrado!" confirmation screen, instead of nothing (rows aren't
tappable today). #40 separately asks for resend-via-WhatsApp and print
actions on a receipt from payment history — and PaymentConfirmedScreen.tsx
already has both actions built (`handlePrint` via `lib/printer.ts`,
`handleShare` via `captureRef` + `expo-sharing`). Reusing that screen as
the destination for #72's tap-through satisfies #40 for free: no new
action UI to design, just a receipt-view screen fed by a past payment
instead of the one just collected.

## What Changes

- Replace the "Primer pago" cycling-preset control on Nuevo Préstamo with
  a real calendar/date-picker, ported from `../mikro`'s
  `CalendarPicker.tsx` (bottom-sheet month calendar, pure React Native, no
  native date-picker dependency — same constraint micobro already
  follows). Swap its `lucide-react-native` icons for micobro's existing
  `@expo/vector-icons` Feather set and its theme tokens for
  `lib/ui/theme.ts`. The picker enforces the same rules the presets did:
  the frequency-aware minimum (`defaultFirstPaymentDate`) and, for daily
  loans with "Saltar domingos" on, Sundays disabled/unselectable.
- Make Histórico de Pagos entries tappable: tapping a past payment
  navigates to a receipt-view screen sharing PaymentConfirmedScreen's
  layout and actions (Imprimir, WhatsApp), adapted for a historical
  payment instead of one just collected — "¡Pago registrado!" (just now)
  becomes "Recibo de pago" (past), and the "Listo" primary CTA becomes a
  plain back action since there's no in-progress flow to close out.
- Add a query to reconstruct a full receipt (customer name, itemized
  lines, method, receipt number, paid-at) for an arbitrary past payment —
  `PaymentHistoryEntry` only carries what the list row renders, not enough
  to rebuild a receipt.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `loan-configuration`: "Primer pago" becomes a calendar/date-picker
  instead of a cycling-preset control; the frequency-minimum and
  skip-Sundays constraints move from "which of 3 presets is offered" to
  "which calendar dates are selectable."
- `payment-history`: past payment entries become tappable, opening a
  receipt view with print/WhatsApp-resend actions.

## Impact

- `components/screens/NewLoanFormScreen.tsx` — swap the preset Pressable
  for the new calendar picker.
- New `components/CalendarPicker.tsx` (ported from mikro).
- `components/screens/PaymentHistoryScreen.tsx`,
  `components/PaymentHistoryRow.tsx` — rows become tappable, route to the
  receipt view.
- `components/screens/PaymentConfirmedScreen.tsx` — generalize or add a
  sibling screen for the historical (non-"just now") case.
- `lib/loans/loanViews.ts` / `lib/repo/types.ts` — new query/view to
  rebuild a full receipt for a past payment (e.g.
  `getPaymentReceipt(paymentId)`), since `PaymentHistoryEntry` doesn't
  carry enough (customer name, itemized lines, typed method).
- No DB schema change — all data needed already exists in `payments` and
  `loans`/`customers`.
