# Tasks: profile-tools-screens

## 1. Data seam

- [x] 1.1 Add `visits` table to `lib/db/schema.ts`; `npm run db:generate`
- [x] 1.2 `lib/visits/visit.schema.ts` + `createVisit.ts` (validated function) + barrel + test
- [x] 1.3 `VisitRepo` on `lib/repo/types.ts`; real composes `createVisit`; mock appends to fixtures
- [x] 1.4 `CustomerDetailView.recentActivity` merges payments + visits by timestamp (mock and real `getDetail`)
- [x] 1.5 `PaymentHistoryView` + `LoanRepo.getPaymentHistory(id)` — mock composes from existing José Núñez fixture payments (RD$7,200 total, cuotas 3/12), real composes from existing payments
- [x] 1.6 `FeedbackRepo` (`submit(input): Promise<{ ok: true }>`) on the repo seam; both mock and real resolve without a network call. Also added `PaymentRepo.listToday()` (needed by Cuadre's desglose, not anticipated in the original data-seam list)

## 2. Components (Storybook-first)

- [x] 2.1 `StatCard` + extended existing `ListTile` with an `iconColor` prop (reused instead of a new `SettingsTile`, since it already matched) + stories
- [x] 2.2 `PaymentHistoryRow` (date badge, label, sub-line, amount) + stories
- [x] 2.3 `AmountInputCard` with match/mismatch badge (Cuadre's efectivo contado) + stories
- [x] 2.4 `OutcomeChip` (compact 2x2-grid toggle for Anotar Visita's outcome picker, matching Pencil's `s9o1`–`s9o4` chip shape rather than the full-width `OptionRow`) + stories

## 3. Screens & wiring

- [x] 3.1 New `VisitOutcomeScreen` (09): outcome picker, conditional promise fields (date/time as cycling presets — no native date-picker dependency), Guardar visita → `VisitRepo.record`; route `app/loans/[id]/visita.tsx` (loan-first, matching the existing `/loans/[id]/cobrar` sibling route); Préstamo Detalle's Anotar visita opens it instead of the dialog stub
- [x] 3.2 New `ProfileScreen` (10): identity + today's stats, settings list (Seguridad y PIN → `/ajustes`, Notificaciones → dialog stub, Ayuda y soporte → dialog with a tappable GitHub-issue link prefilling the app version, Enviar feedback → feedback flow), Cerrar sesión → lock; route `app/perfil.tsx`; Home's avatar button now pushes `/perfil`. Subtitle/pill copy replaced mid-build per user direction: "Prestamista independiente" + live `SyncRepo` backup-status pill (see design.md decisions)
- [x] 3.3 New `PaymentHistoryScreen` (11): summary card, payment rows, Imprimir dialog stub; route `app/loans/[id]/historial.tsx`; Préstamo Detalle's Ver historial opens it instead of the dialog stub
- [x] 3.4 New `CuadreScreen` (12): efectivo esperado card (from `RouteRepo` + today's cash payments), efectivo contado input + match badge, desglose, Cerrar día y sincronizar → `syncRepo.pushNow()`; replaces `CuadrePlaceholderScreen` at the Cuadre tab; deleted `CuadrePlaceholderScreen`
- [x] 3.5 Added `react-native-nitro-screen-recorder` + `react-native-nitro-modules`; `app.config.ts` plugin entry + Android permissions; rebuilt the dev client (`expo prebuild` + `expo run:android`) — required an `ios.bundleIdentifier` appeasement key for the plugin's config resolution even though this app is Android-only
- [x] 3.6 `lib/feedback/FeedbackContext.tsx` (stage union + start/stop/discard/retry), `lib/feedback/finishFeedbackRecording.ts` (pure, testable); mounted `FeedbackProvider` in `app/_layout.tsx`
- [x] 3.7 `components/screens/FeedbackConsentScreen.tsx` (routed at `/feedback/consentimiento`, matching this app's route-per-screen convention rather than an ad-hoc modal component), `components/feedback/RecordingPill.tsx` (plain `View`, not `Modal`), `components/feedback/FeedbackStatusModal.tsx` (sending/sent/error, real `Modal`); wired Perfil's Enviar feedback tile to the consent route

## 4. Tests & gates

- [x] 4.1 Jest: `createVisit` (incl. validation-failure case), mock `getDetail`/`getPaymentHistory` merged-activity ordering, `buildPaymentHistoryView` pure-function cases, `finishFeedbackRecording` (mirrors mikro's test, no native calls) — 71/71 tests, 23 suites
- [x] 4.2 lint/typecheck/test all green; rebuilt the dev client and walked on-device (mock mode): loan detail → Anotar visita (promise) → saved and shown on Cliente Detalle; avatar → Perfil → Seguridad y PIN → Ajustes; loan detail → Ver historial (real data); Cuadre tab renders real screen with the match/mismatch badge (caught and fixed a real bug — an empty efectivo-contado field was defaulting to "matches"); Perfil → Enviar feedback → consent → real mic permission dialog → real Android screen-record system dialog → recording pill over Perfil → stop → error path (Spanish message, retry/cerrar) all confirmed live
- [x] 4.3 `openspec validate profile-tools-screens` green. Maestro smoke not re-run this pass (no flow changes to the auth/nav shell it covers); existing flows are unaffected by this change's additions
