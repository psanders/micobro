# Design: profile-tools-screens

## Context

Groups 1–3 shipped the shell, auth, and the collection loop. This group
builds the remaining "Profile & Settings" and "Alternative Actions &
Tools" rows from `pencil.pen`: `jzV2S` (09 Anotar Visita), `ut5pS`
(10 Perfil), `Mp5w8` (11 Histórico de Pagos), `h48VL` (12 Cuadre General),
and the Enviar-feedback sub-flow (`v8bmyV`/`OWGz8`/`rv2oJ`/`fsDNM`/`oTSL4`,
11a–e), plus `m/list-tile` (`WoWn9`), `m/kv-row` (`F6nZP`),
`m/payment-row` (`XbIU7`), `m/header` (`AFMnH`), `m/tabbar` (`A2ggWj`)
library components.

The sibling app `mikro` (`mods/mobile`) has an equivalent feedback feature:
`react-native-nitro-screen-recorder` for capture, a `FeedbackContext`
provider mounted at root with an `idle → recording → processing →
result/error` state machine, a globally-mounted recording pill (a plain
absolutely-positioned `View`, not a `Modal` — avoids an iOS
touch-blocking bug), and a server-side pipeline (Deepgram transcription →
LLM structuring → Octokit) that files a GitHub issue with the video
committed alongside it. Reused here: the recording library, the state
machine shape, and the globally-mounted pill pattern. Not reused: the
server pipeline — mikro's PAT lives in server-side config
(`mikro.json`, git-ignored) and is never in a client bundle; micobro has
no server, and one shared PAT embedded in an app that ships to many
lenders' phones would be extractable from the APK and abusable against
`github.com/psanders/micobro`. Transcription/LLM structuring are also
server-side in mikro and are dropped entirely here, not replicated
client-side.

## Goals / Non-Goals

**Goals:**

- Pixel-close 09/10/11/12 and the feedback sub-flow on the mock client;
  every link that currently dead-ends into a "muy pronto" dialog
  (Anotar visita, Ver historial, the avatar → Ajustes shortcut, the Cuadre
  placeholder) now opens a real screen.
- Anotar visita actually persists through the repo seam in both modes
  (mock appends to fixtures; real inserts into a new `visits` table) and
  the result is visible on Cliente Detalle immediately.
- The feedback flow's recording, consent, and state-machine UI work end
  to end on-device (real native recording, real permission prompts); only
  the network submission is a stub.

**Non-Goals:**

- No real GitHub submission yet — `FeedbackRepo.submit()` is a mock
  no-op. Wiring per-lender GitHub OAuth (or whatever auth approach is
  chosen) is a follow-up change once that decision is made; this change
  does not invent a shared secret to unblock it.
- No transcription or LLM structuring of the feedback video — those were
  mikro's server-side enrichment steps and have no client-safe equivalent
  here; the stubbed submission is a placeholder for "send the raw video
  and a title", nothing more.
- No "day close" ledger/audit domain — "Cerrar día y sincronizar" calls
  the existing `SyncRepo.pushNow()`; it does not lock further edits for
  the day (that would be its own capability, out of scope here).
- No interest/mora accrual changes — Cuadre's "efectivo esperado" reuses
  `RouteRepo.getToday()`'s existing (mock-seeded / zeroed-in-real) totals.
- No printing — Histórico's "Imprime el historial" stays a dialog, same
  precedent as 08's Imprimir.

## Decisions

- **New `visits` table** (`lib/db/schema.ts`): `id`, `customerId` (FK),
  `loanId` (FK, nullable — a visit is against a customer, a loan just
  gives context), `outcome` (`"promise" | "no_contact" | "refused" |
"reschedule"`), `promiseDate`/`promiseAmountCents` (nullable, set only
  for `"promise"`), `note` (nullable), `createdAt`. `npm run db:generate`
  after editing. A `recordVisit` validated function + `VisitRepo.record
(input): Promise<void>` on the repo seam; enqueues a `pending_mutations`
  row (`entity: "visit"`) like every other write, sitting harmlessly
  until `ENTITY_RANGES` gains a mapping (same deferred-push precedent as
  loans/payments today).
- **Visits feed into `CustomerDetailView.recentActivity`** — the mock and
  real `getDetail` implementations merge payments and visits by
  timestamp, newest first, instead of reading only payments. This is the
  `customer-detail` delta; no new UI section, the existing "Visitas
  recientes" list already renders arbitrary description strings.
- **`LoanRepo.getPaymentHistory(loanId): PaymentHistoryView`** — `{
totalCollectedCents, installmentsPaid, installmentsTotal,
moraPaidCents, lastPaymentAt, entries: { id, date, label, subLabel,
amountCents }[] }`. A thin read composed from the same payments already
  loaded for `getDetailView`; no new table. Real mode's `moraPaidCents` is
  always 0 (no mora domain), matching `LoanDetailView`'s existing honesty
  policy.
- **Perfil (Yo) stats reuse `RouteRepo.getToday()`** — Cobros/Recaudado/
  Pendientes are `visits.filter(done).length` / `collectedCents` /
  `pendingCount` from the same route day Home already renders, not a new
  aggregate. Avatar/name/role come from `ProfileRepo.get()` (already
  exists); "role/zone" and the ID pill are static copy for now (no
  zone/employee-id domain exists) — same "design copy, no backing data
  yet" treatment as 06's Diario/Semanal chip mismatch resolved last group.
- **Cuadre General reuses `RouteRepo.getToday()` for efectivo
  esperado/clientes/pendientes**, and derives the recibos/transferencias
  desglose from today's payments (`method === "cash"` vs `"transfer"`,
  filtered by date). Efectivo contado is local component state — no
  repo write; comparing it to esperado is a pure client-side subtraction
  no different from any other on-screen computation. "Cerrar día y
  sincronizar" calls `syncRepo.pushNow()`, matching its literal Spanish
  ("close and sync") without inventing a day-lock we don't need yet.
- **Avatar routing changes**: Home's avatar button now pushes `/perfil`
  instead of `/ajustes`; Perfil's "Seguridad y PIN" row pushes `/ajustes`
  (unchanged screen, new entry point). This is the `app-navigation` delta
  — `/ajustes` itself is not redesigned in this change (still the plain
  pre-Pencil `SyncSettingsScreen`); only what points at it changes.
- **Feedback flow ports mikro's client shape, not its server**:
  `react-native-nitro-screen-recorder` for capture (same API surface:
  `startInAppRecording`/`startGlobalRecording` per platform,
  `addScreenRecordingListener` to avoid truncated Android files), a
  `FeedbackProvider` mounted once in `app/_layout.tsx` alongside the
  existing providers so recording survives navigation, and the same
  `idle/recording/processing/result/error` stage union backing
  `FeedbackConsentModal` → a floating recording pill (plain `View`, not
  `Modal`, same iOS-touch-blocking rationale) → `FeedbackStatusModal`.
  `finishFeedbackRecording` (recorded file → base64) is ported as a pure
  function, unit-testable exactly like mikro's. `FeedbackRepo.submit
(input): Promise<{ ok: true }>` is the only new repo surface; both mock
  and real implementations resolve immediately without a network call.
  Requires the config-plugin entry (`app.config.ts` `plugins`) and Android
  permissions (`RECORD_AUDIO`, `FOREGROUND_SERVICE`,
  `FOREGROUND_SERVICE_MEDIA_PROJECTION`, `POST_NOTIFICATIONS`) mirroring
  mikro's `app.config.ts`, and a dev-client rebuild (this app already
  ships `expo-dev-client`; adding a native module means the next
  on-device verification needs a fresh dev-client build, not just a
  Metro reload).
- **Permission/start errors surface a generic Spanish message**, same as
  mikro (`"No se pudo iniciar la grabación. Revisa los permisos de
pantalla y micrófono."`) rather than a raw native error string — matches
  11e's design copy exactly.

## Risks / Trade-offs

- [Native module addition needs a real device/emulator rebuild, not just
  a JS reload] → flagged explicitly in tasks; verification on-device
  happens after the dev-client rebuild, same discipline as any other
  native-config change.
- [Android's screen recording is device-wide (`MediaProjection` has no
  in-app-only mode), unlike iOS's in-app capture] → ported as-is from
  mikro since it's a platform constraint, not a design choice; the
  Pencil consent copy doesn't call out this Android-specific scope
  difference — using the design's copy verbatim for pixel fidelity, and
  flagging the missing Android caveat as a follow-up copy tweak rather
  than inventing new consent text mid-build.
- [Stubbed submission means feedback recordings aren't actually sent
  anywhere yet] → accepted per the scope decision; the sent/error screens
  and retry path are fully real so swapping the stub for a real
  `submit()` later is a one-function change, not a UI change.
