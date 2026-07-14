# Ship checkpoint: collection-flow-screens

## Stage

- [x] FRAME — proposal/design/specs/tasks written, `openspec validate` green
- [x] DESIGN gate — approved after emulator review; mikro option semantics; dialogs OK
- [x] BUILD — data seam → components (Storybook) → screens → wiring
- [x] TEST — jest (63/63, 19 suites) + lint + tsc + emulator walk (mock + real) + Maestro smoke all green
- [x] SYNC — delta specs promoted into openspec/specs/{customer-detail,loan-detail,collect-payment}
- [x] ARCHIVE — archived as 2026-07-14-collection-flow-screens; commit + push to main next

## Design nodes (pencil.pen)

- 05 Cliente Detalle `p9vQX` · 06 Préstamo Detalle `Ep6LT` · 07 Cobrar `qoaNg` · 07b Otro Monto `QZSle` · 08 Confirmado `tfabi`
- Components: m/cuota-row `NTnM9`, m/option-row `G2w5DB`, m/kv-row `F6nZP`, m/header `AFMnH`, m/btn-cta `CeOUI`

## Decision log

- GATE (user): approved after emulator review; option semantics per mikro's cobrar screen; transitional dialogs OK.
- Collect options follow mikro (`mikro/mods/mobile/app/cobrar/[loanId].tsx`): dynamic list cuota+mora / cuota / solo mora / saldar / otro monto — the Pencil "cuotas múltiples ×N" row is dropped; multi-cuota goes through Otro monto.
- Mora-first split = pure `computePaymentSplit` in `lib/payments/paymentSplit.ts`, mirroring `@mikro/common/utils/paymentSplit` (PARTIAL/COMPLETED).
- 07b = inline state of the collect screen; 08 = separate route entered via `router.replace` to `/pago-confirmado` with receipt params (mikro pattern — back gesture lands on the loan).
- Route move: `/loans/[id]/payments/new` → `/loans/[id]/cobrar`; RecordPaymentScreen retired.
- Fixed pre-existing QuickAction misalignment (missing `alignItems: "center"` on the card) found during gate review.
- Design inconsistencies ("Diario" chip on a weekly schedule, reused #L-00234) resolved by rendering from loan data.
- Transitional dialogs: Ver historial (screen 11), Anotar visita (screen 09), Imprimir. WhatsApp = real wa.me links.
- Real mode: zero mora, schedule derived from principal/termCount; collect() wraps createPayment so real payments persist.
