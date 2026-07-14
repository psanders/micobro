# Proposal: profile-tools-screens

## Why

The collector shell and collection loop are live, but three screens the
Pencil designs promise still dead-end behind "muy pronto" dialogs: Anotar
visita (from Préstamo Detalle), Ver historial (from Préstamo Detalle), and
the avatar button (which jumps straight to the bare pre-Pencil sync
screen instead of the designed "Mi cuenta" home). Cuadre — a whole tab —
still shows a placeholder. This group builds all four: 09 Anotar Visita,
10 Perfil (Yo), 11 Histórico de Pagos, 12 Cuadre General, plus the
Enviar-feedback recording sub-flow (11a–e) reachable from Perfil, modeled
on mikro's screen-recording feedback feature but posting to
`github.com/psanders/micobro` instead of mikro's target.

## What Changes

- **09 Anotar Visita** (`jzV2S`): a modal opened from Préstamo Detalle's
  "Anotar visita" action — outcome picker (Promesa de pago / Sin contacto
  / No quiere pagar / Reagendar), and when "Promesa de pago" is chosen,
  date/time/amount/comment fields, then "Guardar visita". Replaces the
  current informational-dialog stub. Requires a new `visits` domain (no
  such table exists yet) — `visits` schema, `recordVisit` validated
  function, `VisitRepo.record(input)`, wired mock + real. Recorded visits
  also surface in Cliente Detalle's "Visitas recientes" alongside payments
  (**Modified Capability**: `customer-detail`).
- **10 Perfil (Yo)** (`ut5pS`): the lender's own profile — avatar, name,
  role/zone line, an ID pill, today's stats (Cobros / Recaudado /
  Pendientes), and an AJUSTES list (Notificaciones, Seguridad y PIN, Ayuda
  y soporte, Enviar feedback), Cerrar sesión, version footer. Becomes the
  Home avatar button's destination (**BREAKING**: avatar now opens
  `/perfil` instead of `/ajustes` directly; `/ajustes` — the existing sync
  screen — is reached from Perfil's "Seguridad y PIN" row, unchanged
  itself). "Notificaciones" and "Ayuda y soporte" are transitional dialogs
  until those groups exist; "Enviar feedback" opens the new feedback
  sub-flow.
- **11 Histórico de Pagos** (`Mp5w8`): per-loan payment history — total
  cobrado summary (cuotas pagadas, mora pagada, último pago), a
  chronological list of payment rows (date, label, method/receipt/mora
  sub-line, amount), and an "imprime el historial" CTA (dialog stub, same
  precedent as 08's Imprimir). Replaces Préstamo Detalle's "Ver historial"
  dialog stub with a real navigation. New `LoanRepo.getPaymentHistory(id)`.
- **12 Cuadre General** (`h48VL`): the Cuadre tab's real screen — efectivo
  esperado (today's expected cash, clientes/pendientes breakdown from the
  route day), an efectivo contado input with a live match/mismatch badge,
  a desglose (recibos count, transferencias total, note that transfers
  don't count toward cash-in-hand), and "Cerrar día y sincronizar" which
  calls the existing `SyncRepo.pushNow()`. Replaces `CuadrePlaceholderScreen`.
- **Enviar feedback (11a–e)** (`v8bmyV`, `OWGz8`, `rv2oJ`, `fsDNM`, `oTSL4`):
  consent → screen-recording overlay → sending → sent/error, mirroring
  mikro's feedback-recording feature (same recording approach and state
  machine). mikro's real submission runs server-side (a PAT files a
  GitHub issue with the video attached) — micobro has no server and ships
  to many lenders' phones, so a PAT embedded in the APK would be
  extractable and abusable. This change builds the full recording UI and
  state machine end to end; `FeedbackRepo.submit()` is a mock no-op for
  now (same precedent as `SyncRepo.connect()` before real Google OAuth
  landed). Wiring the real submission to `github.com/psanders/micobro`
  (e.g. per-lender GitHub OAuth, so no shared secret ships) is a follow-up
  once that auth approach is chosen.

## Capabilities

### New Capabilities

- `visit-log`: recording a visit outcome (promise/no-contact/refusal/
  reschedule) against a customer, with the promise-to-pay fields.
- `profile-home`: the Perfil (Yo) screen — identity, today's stats,
  settings list, sign-out.
- `payment-history`: the per-loan Histórico de Pagos screen.
- `daily-reconciliation`: the Cuadre General screen — expected vs. counted
  cash, breakdown, close-and-sync.
- `feedback-report`: the screen-recording feedback flow and its GitHub
  submission.

### Modified Capabilities

- `customer-detail`: "Visitas recientes" now includes recorded visit
  outcomes, not just payments.
- `loan-detail`: "Anotar visita" and "Ver historial" now navigate for real
  instead of showing informational dialogs.
- `app-navigation`: the Cuadre tab shows the real screen instead of the
  placeholder; the Home avatar button opens Perfil instead of Ajustes
  directly.

## Impact

- `lib/db/schema.ts` — new `visits` table; `npm run db:generate` migration.
- `lib/repo/types.ts` — `VisitRepo`, `LoanRepo.getPaymentHistory`,
  extends `CustomerDetailView`'s activity feed.
- `lib/visits/`, new validated-function factories + tests.
- `components/screens/`: new `VisitOutcomeScreen`, `ProfileScreen`,
  `PaymentHistoryScreen`, `CuadreScreen`, and the feedback-flow screens;
  `CuadrePlaceholderScreen` removed.
- `app/`: new routes for perfil, visit-log, payment history, feedback; the
  Cuadre tab and Home avatar link repointed.
- `lib/feedback/` — recording + GitHub submission, config for the
  destination repo/token.
