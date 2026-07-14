# Ship checkpoint: profile-tools-screens

## Stage

- [x] FRAME — proposal/design/specs/tasks written, `openspec validate` green
- [x] DESIGN gate — screens already fully drawn in Pencil (no iteration needed); the two real design decisions were scope calls, both resolved with the user (see log)
- [ ] BUILD — data seam → components (Storybook) → screens → wiring
- [ ] TEST — jest + lint + tsc + on-device walk (mock + real, incl. dev-client rebuild for the recorder) + Maestro smoke
- [ ] SYNC — promote delta specs into openspec/specs/*
- [ ] ARCHIVE — archive + commit/push

## Design nodes (pencil.pen)

- 09 Anotar Visita `jzV2S` · 10 Perfil (Yo) `ut5pS` · 11 Histórico de Pagos `Mp5w8` · 12 Cuadre General `h48VL`
- Feedback sub-flow: 11a Consentimiento `v8bmyV` · 11b Grabando (overlay) `OWGz8` · 11c Enviando `rv2oJ` · 11d Enviado `fsDNM` · 11e Error `oTSL4`
- Components: m/list-tile `WoWn9`, m/kv-row `F6nZP`, m/payment-row `XbIU7`, m/header `AFMnH`, m/tabbar `A2ggWj`

## Decision log

- GATE (user): feedback flow is in scope, modeled on mikro's screen-recording feature, but posting to `github.com/psanders/micobro` instead of mikro's target.
- GATE (user): GitHub submission auth — build the full recording/consent/state-machine UI now; `FeedbackRepo.submit()` is a mock no-op until a per-lender auth approach (no embedded shared PAT — this app ships to many lenders' phones) is chosen in a follow-up.
- mikro research (agent): recorder lib is `react-native-nitro-screen-recorder`; state machine `idle/recording/processing/result/error`; recording pill is a plain `View` (not `Modal`, iOS touch-blocking bug); mikro's real submission is server-side (Octokit + PAT from git-ignored config) — not portable client-side without a shared secret, hence the stub.
- New `visits` table + `VisitRepo` — no visits domain existed; visits merge into `CustomerDetailView.recentActivity` by timestamp alongside payments.
- `LoanRepo.getPaymentHistory` is a thin read over existing payments — no new table.
- Cuadre and Perfil stats reuse `RouteRepo.getToday()`; no new aggregate domain. "Cerrar día y sincronizar" = existing `syncRepo.pushNow()`, no day-lock domain invented.
- Avatar routing changes: Home avatar → `/perfil` (new); `/ajustes` (existing, undesigned sync screen) now reached via Perfil's "Seguridad y PIN" row.
- Adding the native recorder module requires an `app.config.ts` plugin entry + Android permissions + a dev-client rebuild before on-device verification (not just a Metro reload).
- On-device verification (real dev-client rebuild via `npx expo prebuild`/`npx expo run:android`): mic permission dialog, Android's screen-record system consent dialog, the recording pill overlaying Perfil, and the error path (no file → Spanish error + retry/cerrar) all confirmed working end to end. Also fixed live: `StatCard` value text wrapping mid-number (added `numberOfLines`/`adjustsFontSizeToFit`) and the shared `Avatar`/Home avatar-button initials sitting below vertical center (`includeFontPadding`/`textAlignVertical` fix, same recipe as FilterChip/BrandLogo).
- GATE (user): Ayuda y soporte → a dialog with a tappable "Abrir enlace" link (not an immediate jump) to a GitHub issue form (`.github/ISSUE_TEMPLATE/soporte.yml`) with the app version prefilled via the form's `version` field query param; fixed a real pre-existing bug where the footer hardcoded "v1.0.0" while `app.config.ts`/`package.json` said "0.1.0" — both now read `Constants.expoConfig?.version`.
- GATE (user): Mi Cuenta's "Cobrador · Zona Norte" / "ID #COB-0042" employee-badge copy didn't fit a solo-lender app. Presented 5 alternatives as an artifact mockup; user picked "Respaldo en la nube" — subtitle becomes static "Prestamista independiente", pill becomes live sync status from `SyncRepo.getStatus()` (`Respaldo activo · hace Nh` / `Respaldo no conectado` / `esperando envío`). Updated both `pencil.pen` (`ANzRm`, `OevSU`, and the `v0.1.0` footer typo) and `ProfileScreen.tsx` to match.
