# Proposal: collection-flow-screens

## Why

Home/nav shipped the collector shell, but tapping into a client still lands
on the old placeholder detail screens, and there is no way to actually walk
the core loop the product exists for: open a client → open their loan →
collect a payment → hand over a receipt. The Pencil designs define that
whole flow (05 Cliente Detalle, 06 Préstamo Detalle, 07/07b Cobrar,
08 Pago Confirmado). This is the third per-group screens change, built
against the mock client with every link wired as prod.

## What Changes

- **05 Cliente Detalle** (`p9vQX`): profile card (avatar, name, standing
  pill, phone/address/cédula rows, Llamar/WhatsApp/Mapa actions), active
  loans cards with progress + next cuota, and recent visits history.
  Replaces the current placeholder `CustomerDetailScreen`.
- **06 Préstamo Detalle** (`Ep6LT`): loan header with meta chips, brand-deep
  balance summary card (balance, progress, pagado/cuota/próxima), "Total a
  pagar hoy" card with cuota + mora breakdown, "Plan de pagos" schedule with
  paid/overdue/upcoming states, and the Anotar visita / Cobrar action bar.
  Replaces the current placeholder `LoanDetailScreen`.
- **07 Cobrar Pago + 07b Otro Monto** (`qoaNg`, `QZSle`): registrar-cobro
  modal — client row, big amount readout, dynamic tipo-de-cobro options
  following mikro's cobrar semantics (cuota + mora / cuota / solo mora /
  saldar préstamo / otro monto with inline input — no ×N option), "Cómo se
  aplica" breakdown from the shared mora-first split,
  Efectivo/Transferencia method toggle, and the Confirmar y cobrar CTA.
  Replaces `RecordPaymentScreen` (**BREAKING**: route moves from
  `/loans/[id]/payments/new` to `/loans/[id]/cobrar`).
- **08 Pago Confirmado** (`tfabi`): full brand-deep confirmation with total
  cobrado, applied lines, método/recibo/hora, Imprimir / WhatsApp actions,
  and Listo back to the loan.
- **New data surfaces on the repo seam**: `CustomerRepo.getDetail(id)`,
  `LoanRepo.getDetailView(id)`, `PaymentRepo.getCollectContext(loanId)` and
  `PaymentRepo.collect(input)` (returns a receipt). Mock serves the design
  dataset (José Núñez's overdue cuota 4 + RD$750 mora); real derives what it
  honestly can from customers/loans/payments (no mora domain → RD$0 mora).
- **Transitional wiring** so nothing dead-ends: Ver historial (screen 11),
  Anotar visita (screen 09), and Imprimir use informational dialogs until
  their groups land; WhatsApp actions use real `wa.me` links.

## Capabilities

### New Capabilities

- `customer-detail`: the Cliente Detalle screen — profile card, contact
  actions, active loans, recent visits.
- `loan-detail`: the Préstamo Detalle screen — meta chips, balance summary,
  total-a-pagar-hoy breakdown, plan de pagos, action bar.
- `collect-payment`: the Cobrar flow — amount options, application
  breakdown, payment method, confirmation receipt.

### Modified Capabilities

- None. (Existing capabilities' entry links — route visits and search rows
  already navigate to `/customers/[id]` — keep working unchanged.)

## Impact

- `components/screens/` — `CustomerDetailScreen` and `LoanDetailScreen`
  rebuilt to the designs; `RecordPaymentScreen` retired; new
  `CollectPaymentScreen` + `PaymentConfirmedScreen`.
- `app/loans/[id]/` — `payments/new.tsx` deleted; `cobrar.tsx` added.
- `lib/repo/types.ts` + mock/real — the four new detail/collect surfaces.
- New presentational components: `CuotaRow`, `OptionRow`, `KvRow`,
  `MetaChip`, `InfoRow` — with Storybook stories.
- No DB schema changes; real mode has no mora/visits domain yet, so those
  fields come back zero/empty (specced as honest degradation).
