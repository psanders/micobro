# Tasks: collection-flow-screens

## 1. Data seam

- [x] 1.1 Add `CustomerDetailView` + `CustomerRepo.getDetail(id)` to `lib/repo/types.ts`; mock serves the design dataset; real composes customers/loans/payments (cedula null, standing al_dia)
- [x] 1.2 Add `LoanDetailView` + `LoanRepo.getDetailView(id)`; mock exemplar = José Núñez weekly RD$2,400×12, cuotas 1–3 paid, cuota 4 overdue + RD$750 mora; real derives schedule from principal/termCount/payments with zero mora
- [x] 1.3 Add `CollectContext`/`PaymentReceipt`, `PaymentRepo.getCollectContext(loanId)` and `PaymentRepo.collect(input)`; real wraps `createPayment` and derives the receipt number; mock appends so balances update
- [x] 1.4 `lib/payments/paymentSplit.ts` — pure `computePaymentSplit` (mora-first, PARTIAL/COMPLETED status) mirroring mikro's `@mikro/common/utils/paymentSplit`, shared by the breakdown preview and `collect()`

## 2. Components (Storybook-first)

- [x] 2.1 `CuotaRow` (paid/overdue/upcoming states) + stories
- [x] 2.2 `OptionRow` (radio, label, trailing value, selected treatment) + stories
- [x] 2.3 `KvRow`, `MetaChip`, `InfoRow` (icon + text) + stories

## 3. Screens & wiring

- [x] 3.1 Rebuild `CustomerDetailScreen` (05): profile card, contact actions via Linking, active loan cards → `/loans/[id]`, visitas recientes, not-found + empty states
- [x] 3.2 Rebuild `LoanDetailScreen` (06): header + chips, balance summary, total-a-pagar-hoy breakdown, plan de pagos, Ver historial dialog, action bar (Anotar visita dialog, Cobrar → `/loans/[id]/cobrar`)
- [x] 3.3 New `CollectPaymentScreen` (07/07b): context row, amount readout, dynamic options (cuota + mora / cuota / solo mora / saldar / otro monto w/ inline input), breakdown via computePaymentSplit, method toggle, Confirmar y cobrar
- [x] 3.4 Confirmation route (08): `router.replace` to `app/pago-confirmado.tsx` with receipt params; Imprimir dialog, WhatsApp share, Listo → loan; route `app/loans/[id]/cobrar.tsx` (modal), delete `payments/new.tsx` + `RecordPaymentScreen`

## 4. Tests & gates

- [x] 4.1 Jest: computePaymentSplit (mora priority, partial, solo-mora, no-mora custom), mock getDetail/getDetailView/collect shapes + balance update, real getDetailView schedule derivation, real collect → createPayment
- [x] 4.2 lint/typecheck/test green; walk client → loan → cobrar (each option) → confirmación → back on emulator in mock mode; verify real mode (no mora, collect persists)
- [x] 4.3 Keep Maestro smoke green; `openspec validate collection-flow-screens`
