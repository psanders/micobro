# Design: collection-flow-screens

## Context

Groups 1–2 shipped the theme tokens, auth, and the Hoy/Ruta/Buscar/Cuadre
shell. This group builds the collection loop from `pencil.pen`: `p9vQX`
(05 Cliente Detalle), `Ep6LT` (06 Préstamo Detalle), `qoaNg` (07 Cobrar
Pago), `QZSle` (07b Otro Monto), `tfabi` (08 Pago Confirmado), plus the
`m/cuota-row` (`NTnM9`), `m/option-row` (`G2w5DB`), `m/kv-row` (`F6nZP`),
`m/header` (`AFMnH`), `m/btn-cta` (`CeOUI`) library components.

## Goals / Non-Goals

**Goals:**

- Pixel-close 05/06/07/07b/08 on the mock client; the full loop client →
  loan → cobrar → confirmación → back, with balances visibly updating.
- Collecting actually records a payment through the repo seam in BOTH
  modes (mock appends to fixtures; real goes through `createPayment`).
- Contact actions are real: `tel:`, `wa.me`, `geo:` via `Linking`.

**Non-Goals:**

- No mora/interest DB domain — real mode reports RD$0 mora and derives the
  schedule from principal/termCount; accrual math is its own future change.
- No visit-taking (09), no payment history screen (11), no printing — all
  transitional dialogs until their groups.
- No edit/delete of customers or loans.

## Decisions

- **Repo seam, four new surfaces** (mock = design dataset, real = honest
  derivation):
  - `CustomerRepo.getDetail(id): CustomerDetailView | null` —
    `{ id, name, avatarKey, phone, address, cedula, sinceYear, standing:
"al_dia" | "mora", activeLoans: { loanId, code, principalCents,
frequency, installmentsPaid, installmentsTotal, nextDueLabel,
nextAmountCents }[], recentActivity: { id, description, at }[] }`.
    Real: customers + loans + payments tables; `cedula` null, `sinceYear`
    from `createdAt`, standing `al_dia` (no mora domain), activity from
    payments.
  - `LoanRepo.getDetailView(id): LoanDetailView | null` —
    `{ id, code, customerId, customerName, business, frequency, termCount,
startDate, dueDate, balanceCents, paidCents, installmentsPaid,
installmentsTotal, nextDueDate, dueToday: { totalCents, lines: { kind:
"installment" | "mora", label, amountCents }[] }, schedule: { number,
label, dueDate, amountCents, status: "paid" | "overdue" | "upcoming" }[] }`.
    Real: installment = principal / termCount; a cuota is `paid` when the
    cumulative payment sum covers it; `overdue` when its date passed
    unpaid; mora line only when `moraCents > 0` (never, in real, for now).
  - `PaymentRepo.getCollectContext(loanId): CollectContext` —
    `{ loanId, customerId, customerName, customerAvatarKey, business,
loanCode, installmentAmountCents, currentInstallmentLabel,
arrearsCents, moraCents, moraDays, payoffCents }`.
  - `PaymentRepo.collect(input): PaymentReceipt` — input
    `{ loanId, amountCents, method: "cash" | "transfer", applied: { label,
amountCents }[] }`; receipt `{ id, receiptNumber, paidAt, totalCents,
method, customerName, applied }`. Real wraps the existing
    `createPayment` validated function and derives `receiptNumber` from the
    payment count (`#R-00042`); mock appends so 05/06 re-render with new
    balances.
- **Option semantics follow mikro's cobrar screen** (gate decision: "see
  how it was done with the mikro mobile app"). The Pencil "Cobrar cuotas
  multiples × N" row is dropped — mikro has no multi-cuota option; larger
  amounts go through "Otro monto". The option list is built dynamically:
  "Cobrar cuota + mora" (when mora > 0, preselected), "Cobrar cuota" (when
  mora = 0, preselected), "Solo mora" (when mora > 0), "Saldar préstamo"
  (when > 1 cuota remains; payoff = remaining balance + mora), "Otro monto"
  (always, inline input per 07b). Pencil stays the spec for the visual
  language (option rows, amount card, method toggle).
- **Mora-first split is a pure function** — `computePaymentSplit` in
  `lib/payments/paymentSplit.ts`, mirroring mikro's
  `@mikro/common/utils/paymentSplit`: mora is covered first, the remainder
  applies to the cuota (PARTIAL when it doesn't cover it). Single source of
  truth for the "CÓMO SE APLICA" preview and the recorded payment lines;
  unit-tested directly.
- **07b is state, not a route** — the custom-amount input renders inline
  under the "Otro monto" option when selected (exactly what 07b shows);
  one `CollectPaymentScreen` covers 07 + 07b.
- **08 is its own route, entered with `router.replace`** (mikro's
  pattern): after `collect()` resolves, replace to
  `/pago-confirmado?…receipt params…` so Android back from the
  confirmation lands on the loan detail (which refetches), never back on
  the spent form. WhatsApp shares the receipt summary through `wa.me`;
  Imprimir is a "pronto" dialog.
- **Design inconsistencies resolved from data** — 06's chip says "Diario"
  while its schedule is weekly, and both 05 and 06 reuse `#L-00234` for
  different customers; the app renders frequency/code from the loan record
  (chip shows Semanal for a weekly loan, codes derive per loan). Mock
  fixtures keep the design's José Núñez exemplar: weekly RD$2,400 × 12,
  cuotas 1–3 paid, cuota 4 overdue with RD$750 mora (3 días), balance
  RD$18,000, payoff RD$18,750.
- **Route move** — `/loans/[id]/payments/new` → `/loans/[id]/cobrar`
  (modal presentation, x close). No shipped surface links to the old route.

## Risks / Trade-offs

- [Receipt in component state] Process death between collect and Listo
  loses the confirmation view but not the payment (already persisted) →
  accepted; receipts get durable storage when the histórico group lands.
- [Real mode has no mora] The dramatic orange states never appear on real
  data → accepted and specced; mock demonstrates them.
- [`wa.me` without a registered WhatsApp] `Linking.openURL` may fail →
  wrapped, falls back to an informational dialog.

## Open Questions

- None. Gate outcomes: option semantics follow mikro (no ×N row);
  transitional dialogs approved; mikro's 5-minute duplicate-collection
  guard noted as a candidate for a later change, not built here.
