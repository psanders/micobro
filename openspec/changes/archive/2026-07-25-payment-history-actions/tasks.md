## 1. Calendar picker (port from mikro)

- [x] 1.1 Copy `../mikro/mods/mobile/components/ui/CalendarPicker.tsx` into
      `components/CalendarPicker.tsx`; swap `lucide-react-native` icons
      (`X`, `ChevronLeft`, `ChevronRight`) for `@expo/vector-icons` Feather
      (`x`, `chevron-left`, `chevron-right`) and the mikro theme import for
      `lib/ui/theme.ts`'s `colors`/`fonts`.
- [x] 1.2 Add an optional `isDateDisabled?: (date: Date) => boolean` prop,
      combined with the existing `minDate` gate.
- [x] 1.3 ~~Storybook story~~ — skipped: `SelectField.tsx` is the only other
      Modal-based component in the repo and has no story either; RN `Modal`
      portals outside the Storybook preview canvas, so this repo doesn't
      story Modal components. Consistent with existing convention.

## 2. Primer pago → calendar picker

- [x] 2.1 In `NewLoanFormScreen.tsx`, replace `firstPaymentPresetIndex`
      cycling state with a plain `firstPaymentDate` state seeded from
      `defaultFirstPaymentDate(frequency)`, reset on frequency change.
- [x] 2.2 Wire the "Primer pago" field to open `CalendarPicker` with
      `minDate = defaultFirstPaymentDate(frequency)` and
      `isDateDisabled = (d) => skipSundays && frequency === "daily" &&
d.getDay() === 0`. (Extracted the min-date logic as
      `healthyFirstPaymentFloor` in `loanViews.ts` so it's unit-testable,
      matching the repo's lib-function test convention — no component
      testing infra exists in this repo.)
- [x] 2.3 Keep the submit-time inverse conversion
      (`addFrequencyInterval(date, frequency, -1)` → `startDate`) unchanged.
- [x] 2.4 Unit test: frequency change resets to the new default; Sunday is
      unselectable when skip-Sundays is on for diario. (`healthyFirstPaymentFloor`
      describe block in `__tests__/loanViews.test.ts`.)

## 3. Receipt reconstruction for a past payment

- [x] 3.1 Export `buildReceiptNumberIndex` + `canonicalReceiptNumbers` from
      `lib/loans/loanViews.ts`, used by both `buildPaymentHistoryView` and
      the new `buildPaymentReceipt`, so numbering logic isn't duplicated.
- [x] 3.2 Add `buildPaymentReceipt` (pure builder in `loanViews.ts`, unit
      tested directly per the repo's existing `buildPaymentHistoryView`
      convention) plus `createGetPaymentReceipt` (validated-function DB
      wrapper in `lib/payments/getPaymentReceipt.ts` — placed alongside
      `collectPayment.ts` rather than in `lib/loans/`, since it returns the
      same `PaymentReceipt` shape `collect()` does and is `paymentId`-,
      not `loanId`-, scoped; no dedicated test file, mirroring
      `getPaymentHistory.ts` which also has none — the DB wrapper has no
      logic beyond plumbing). Loads the payment, loan, customer; finds
      sibling rows sharing `(loanId, paidAt)`; rebuilds
      `lines: ReceiptLine[]` (mora line if a `MORA_NOTE` row is present,
      plus the installment/abono line, reusing `buildPaymentHistoryView`'s
      entry labels); sums `totalCents`; picks the **lower** of the group's
      receipt numbers as canonical.
- [x] 3.3 Update `buildPaymentHistoryView` to use the same canonical
      per-event number for both sibling entries' `subLabel`.
- [x] 3.4 Add `getReceipt(paymentId)` to the `PaymentRepo` interface
      (`lib/repo/types.ts`), the real repo (`lib/repo/real/paymentRepo.ts`),
      and the mock repo (`lib/repo/mock/index.ts`).
- [x] 3.5 Unit tests (`buildPaymentReceipt` describe block in
      `__tests__/loanViews.test.ts`): standalone single-row cobro; combined
      mora+cuota cobro (both sibling rows resolve to the same receipt and
      same canonical number); unknown-`paymentId` returns `null`.

## 4. Receipt view screen + navigation

- [x] 4.1 Pencil: designed the historical receipt screen ("12 Recibo de
      Pago", node `htxyb`) as a "08 Pago Confirmado" derivative — title
      "Recibo de pago", no "Listo" CTA, back header instead. User signed
      off in the Design stage.
- [x] 4.2 Implemented the shared receipt card/actions as two components —
      `ReceiptSummary` (icon/headline/card) and `ReceiptActions`
      (Imprimir/WhatsApp + the offscreen `ReceiptView` + profile fetch) —
      used by both `PaymentConfirmedScreen` and the new
      `PaymentReceiptScreen`. (Went with component extraction over a
      `variant` prop, per design.md's deferred choice — the two screens'
      outer chrome, i.e. ScrollView vs. header vs. bottom CTA, differs
      enough that a single parameterized component would need as many
      conditionals as just having two thin screens share the middle.)
- [x] 4.3 Added `app/pago-historico/[paymentId].tsx` (registered
      `headerShown: false` in `app/_layout.tsx`, matching every other
      screen-owns-its-header route), rendering `PaymentReceiptScreen`,
      which loads via `paymentRepo.getReceipt(paymentId)`.
- [x] 4.4 `PaymentHistoryRow` is now a `Pressable` with a trailing chevron
      (matching the Pencil design); `PaymentHistoryScreen` routes to
      `/pago-historico/${entry.id}` on tap.
- [x] 4.5 E2E (Maestro): `.maestro/pago-historico.yaml` — Préstamo Detalle
      → Ver historial → tap "Cuota 3" (María Rosa's loan-1) → receipt view
      shows "Recibo de pago" with Imprimir/WhatsApp visible → back returns
      to Histórico de Pagos. Written following the existing flows'
      conventions exactly (`prestamo-cobrar.yaml`); **not executed** — no
      device/simulator available in this environment to run Maestro.

## 5. Spec sync + archive

- [x] 5.1 `openspec validate payment-history-actions` — valid.
- [x] 5.2 Lint, typecheck, full test suite green (229/229 suites, 1352/1352
      tests, scoped lint clean on every touched file — full-repo `npm run
lint` is polluted by pre-existing stale `.claude/worktrees/*`
      checkouts unrelated to this change, flagged separately).
- [x] 5.2b Manual emulator verification (Android, mock repos): calendar
      picker opens on Nuevo Préstamo with the correct min-date disabled and
      default selected; Histórico de Pagos rows are tappable with a
      chevron; tapping opens "Recibo de pago" with Imprimir/WhatsApp; back
      returns to the list; WhatsApp share generates a real receipt image
      via the native share sheet. Caught and fixed two real bugs in the
      process: 1. `buildPaymentReceipt` was reusing the list's plain "Cuota N" label
      instead of the receipt convention "Cuota N/Total" (`cuotaLabel`)
      that `CollectPaymentScreen`'s live receipt uses — extracted
      `cuotaNumbersByPaymentId` shared helper, fixed, re-tested. 2. Pre-existing, unrelated to #72/#40 but caught during this pass and
      fixed with the user's go-ahead: `EditProfileScreen.tsx` (the
      lender's own "Editar perfil") never got the live-format/validate
      phone treatment from #63/#71 — that PR only touched the customer
      forms. Added `optionalPhoneSchema` to `profile.schema.ts` (same
      shape as customer's `phoneSchema`, but optional) and wired
      `formatPhoneInput`/hint into the screen, matching
      `NewCustomerFormScreen`'s pattern. New tests in
      `__tests__/profileRepo.test.ts`.
- [x] 5.3 Synced delta specs into `openspec/specs/loan-configuration` and
      `openspec/specs/payment-history`.
- [x] 5.4 Archive the change; close #72 and #40.
