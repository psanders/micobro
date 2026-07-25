## Context

**Primer pago (loan-configuration).** `NewLoanFormScreen.tsx` picks the
first-payment date with a `Pressable` that cycles `firstPaymentPresetIndex`
through `FIRST_PAYMENT_PRESET_COUNT` presets, defaulting to
`defaultFirstPaymentDate(frequency)` (44-loan-first-payment-date). `../mikro`
already has `mods/mobile/components/ui/CalendarPicker.tsx`, a bottom-sheet
month calendar with a single `minDate` gate — pure React Native, no native
date-picker dependency, matching micobro's own constraint. It imports
`lucide-react-native` icons and a `../../lib/theme` module micobro doesn't
have; micobro uses `@expo/vector-icons` (Feather) and `lib/ui/theme.ts`
instead. Its only prior usage (mikro's `convertir.tsx` /
`generar-contrato.tsx`) gates on `minDate` alone — neither disables
individual dates within the allowed range, which micobro's skip-Sundays
constraint needs.

**Payment history receipt (payment-history).** `PaymentConfirmedScreen.tsx`
already renders a full receipt (customer, method, itemized `lines`, total,
receipt number, paid-at) with working Imprimir (`lib/printer.ts`) and
WhatsApp (`captureRef` + `expo-sharing`) actions — but only for a payment
just collected, via `router.replace` with params built by
`CollectPaymentScreen.handleConfirm`. `PaymentHistoryEntry`
(`lib/repo/types.ts`) only carries what the list row renders (`label`,
`subLabel`, `amountCents`) — not enough to rebuild a receipt.

A single "cobro" (`collectPayment.ts`) can write **up to two** `payments`
rows sharing one `loanId` and one `paidAt` timestamp: a mora row
(`notes: MORA_NOTE`) and an installment row. `buildPaymentHistoryView`
(`loanViews.ts`) already splits these into two separate list entries, each
with its **own** receipt number computed by `receiptNumberOf` (row index in
creation order across the whole `payments` table). But the receipt shown
live right after collecting uses **one** receipt number for the whole
event (computed once in `collectPayment.ts`, before either row insert).
So today, a settle-with-mora cobro's live receipt shows one number, while
its two rows in Histórico de Pagos each show a different one — an existing
inconsistency this change surfaces (tapping either row needs to open the
_same_ combined receipt) and should fix rather than compound.

## Goals / Non-Goals

**Goals:**

- Replace the Primer pago preset control with a real calendar picker,
  preserving today's two constraints (frequency-aware minimum, Sunday-skip
  for daily loans) as calendar-cell disabling instead of preset filtering.
- Make a Histórico de Pagos row tappable, opening a receipt view with the
  same layout/actions as PaymentConfirmedScreen, fed by that row's
  underlying payment event (grouping its sibling mora/installment row when
  present) rather than just that one row's amount.
- One canonical receipt number per cobro event, consistent between the
  list's sub-labels and the receipt view — fixes the inconsistency above.

**Non-Goals:**

- No change to `collectPayment.ts`'s live receipt-number computation or to
  the just-collected flow's route (`/pago-confirmado`) — this only touches
  how a _past_ event is reconstructed and displayed.
- No new `payments` schema column (e.g. an explicit collection/group id).
  Grouping by `(loanId, paidAt)` equality is a heuristic, acceptable given
  a single-lender, single-threaded UI where two independent cobros can't
  land on the same loan in the same millisecond — not a guarantee we're
  willing to pay a migration for here.
- No change to the Histórico de Pagos list itself splitting mora/cuota
  into two rows (Requirement: Payment entries list stays as-is) — only
  what tapping a row does, and what number it shows.
- Print/WhatsApp on the historical receipt view reuse
  `handlePrint`/`handleShare` as they exist today; no new share channels.

## Decisions

**Calendar picker: port + extend, don't reinvent.** Copy
`CalendarPicker.tsx` into `components/CalendarPicker.tsx`, swapping
`lucide-react-native` (`X`, `ChevronLeft`, `ChevronRight`) for
`@expo/vector-icons` Feather (`x`, `chevron-left`, `chevron-right`) and
mikro's theme import for `lib/ui/theme.ts`'s `colors`/`fonts`. Add an
optional `isDateDisabled?: (date: Date) => boolean` prop alongside the
existing `minDate`, checked together (`date < min || isDateDisabled?.(date)`)
so `NewLoanFormScreen` can pass a Sunday check when `skipSundays` is on
without forking the component. Alternative considered: a micobro-specific
component from scratch — rejected, the mikro component is a faithful fit
and porting keeps the two apps' date-picker UX consistent.

**Primer pago wiring.** `firstPaymentDate`/`firstPaymentPresetIndex` state
is replaced by a plain `firstPaymentDate` state seeded from
`defaultFirstPaymentDate(frequency)`, reset on frequency change (same
reset behavior the presets had). `minDate` is that same default (the
existing frequency-aware floor); `isDateDisabled` is `(d) => skipSundays
&& frequency === "daily" && d.getDay() === 0`. The submit-time inverse
conversion (`addFrequencyInterval(date, frequency, -1)` to derive
`startDate`) is unchanged.

**Receipt reconstruction: group by `(loanId, paidAt.getTime())`.** New
`getPaymentReceipt(paymentId)` (alongside `getPaymentHistory` in
`lib/loans/`) loads the target payment, its loan and customer, then finds
sibling rows with the same `loanId` and identical `paidAt` timestamp. It
rebuilds `lines: ReceiptLine[]` the way `CollectPaymentScreen.breakdown`
did live — a mora line (if a `MORA_NOTE` row is present) plus an
installment/abono line — sums `totalCents` across the group, and takes
`method` from either row (both share it, set once per cobro). Receipt
number: `receiptNumberOf` logic moves from a private closure in
`loanViews.ts` to an exported helper taking the full sorted-by-createdAt
`payments` list; the event's canonical number is the **lower** of its
member rows' numbers (the earliest-written row, closest to what
`collectPayment.ts` computed before either insert). `buildPaymentHistoryView`
switches to the same helper so both list rows of one event show that same
number in their `subLabel`.

**Screen reuse via a shared presentational component.** Extract
`PaymentConfirmedScreen`'s card + Imprimir/WhatsApp actions into a
`ReceiptCard` component (or a `variant` prop directly on
`PaymentConfirmedScreen` — final call left to implementation, see Open
Questions) taking `{ title, subtitle, ctaLabel, onCta }` plus the existing
receipt data, so the "just collected" screen keeps "¡Pago registrado!" /
"Listo" → `router.back()`, and the new historical screen uses "Recibo de
pago" / no primary CTA (just the header back arrow, consistent with
Histórico de Pagos' own header). Alternative considered: two fully
separate screens duplicating the card/actions markup — rejected, the
existing screen's layout is exactly right and duplicating ~150 lines of
JSX/styles for one title swap isn't worth the drift risk.

**Route.** New route `app/pago-historico/[paymentId].tsx` (or nested
under the loan, TBD — see Open Questions), pushed from
`PaymentHistoryRow`'s `onPress`, loading via `getPaymentReceipt` and
rendering the shared receipt view.

## Risks / Trade-offs

- [Millisecond-equality grouping misses a real split] → Mitigation: the
  only writer of two same-loan rows in the same instant is
  `collectPayment.ts` itself (`paidAt = new Date()` reused for both
  inserts); no other code path creates payments this way today.
- [Retroactively changing which receipt number a payment-history row
  shows] → Mitigation: this is a display-only correction (the number was
  already meant to represent one cobro); no stored data changes, and it
  makes the list consistent with the new receipt view instead of adding a
  second inconsistency.
- [`getPaymentReceipt` re-scans the whole `payments` table like
  `getPaymentHistory` already does] → Mitigation: same cost profile as
  the existing screen it's paired with; on-device SQLite over a single
  lender's data, not a scaling concern here.

## Open Questions

- Exact route path/segment for the historical receipt screen — resolve
  during Pencil design (stage 1) alongside the actual screen layout.
- Whether to extract a shared `ReceiptCard` or add a `variant` prop
  directly to `PaymentConfirmedScreen` — an implementation-shape choice,
  not a behavior question; decide during BUILD once the Pencil screens
  make the shared vs. distinct markup obvious.
