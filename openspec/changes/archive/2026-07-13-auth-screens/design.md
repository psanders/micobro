# Design: auth-screens

## Context

The authentication flow already works behaviorally (PIN setup → optional Google
→ tabs; PIN unlock on return) but the screens are placeholder navy/system-font
versions. `pencil.pen` has the finished designs: `EYzn2` (Configura tu PIN),
`Jy3HY` (01b Desbloquear), `S2oEG8` (01 Conectar con Google), built on the
Mobile Component Library (`m/statusbar`, `m/header`, `m/btn-cta`, `m/avatar`)
and the brand variables (teal `#0B4F4A`/`#0E7C6B`, mist `#E8F7F2`, bg
`#F4F8FF`, Plus Jakarta Sans).

## Goals / Non-Goals

**Goals:**

- Pixel-close implementation of the three designed auth screens.
- All navigation wired as production: fresh install → Crea tu PIN →
  Confirma tu PIN → Conectar con Google (skippable) → tabs; returning user →
  Desbloquear → tabs; Settings → Conectar re-entry (header X closes).
- Whole flow walkable on the mock client with a simulated Google connect.

**Non-Goals:**

- No changes to real OAuth/PKCE, push sync, or the DB schema.
- No forgot-PIN recovery _flow_ (no designed screen exists yet) — only the
  link and a defined interim behavior (see Open Questions).
- Later screen groups (Hoy, Ruta, Buscar, Cuadre, collection flow, profile).

## Decisions

- **Design tokens module** — add `lib/ui/theme.ts` exporting the Pencil
  variables (colors, radii, font family names) so screens reference tokens,
  not hex literals. Values copied from `pencil.pen` `get_variables` — the
  design file stays the source of truth; this module is the on-device mirror.
- **Plus Jakarta Sans via `@expo-google-fonts/plus-jakarta-sans`** + `expo-font`
  loaded in the root layout. Alternative (system font) rejected: typography is
  most of the visual identity in these screens.
- **PIN components restyled, same API** — `PinInput` becomes the design's
  boxed-cell row (58×68 cells, filled/active-with-cursor/empty/error states);
  `PinKeypad` becomes the 4×3 grid of 56-high `#F4F8FF` keys. Their
  props/callbacks stay as-is so screen logic doesn't churn.
- **One shared `PinScreen` layout** — setup (create/confirm/error) and unlock
  are the same skeleton per the design note ("confirmar y error usan el mismo
  componente"); variants differ in header block (logo+title vs logo+avatar+
  greeting) and footer (nothing vs ¿Olvidaste tu PIN?).
- **Greeting personalization via `ProfileRepo`** — `Jy3HY` shows an avatar and
  "Hola, Carlos.". Add a minimal `profile` repo to `Repos`:
  `get(): Promise<{ name: string; avatar?: string } | null>`. Mock returns
  Carlos + a bundled avatar; real returns `null` for now (no profile capture
  exists), and the screen falls back to logo + "Ingresa tu PIN" without the
  avatar/greeting block. Alternative (hardcode in screen) rejected: repos are
  the data seam, and the profile group will fill in the real implementation.
- **Mock Google connect** — when `useMockRepos` is on, "Continuar con Google"
  skips the real `promptAsync` and calls `syncRepo.connect` with stub params;
  the mock repo flips to connected and the screen advances. Real mode keeps
  the existing PKCE flow and the disabled-with-note state when
  `EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID` is missing.
- **Conectar header** — the design's `m/header` with X maps to a screen-local
  header row (not the native stack header) so it matches the design exactly;
  X performs the same action as "Ahora no" (skip in onboarding, back from
  Settings).

## Risks / Trade-offs

- [Pencil file unsaved state] The `.pen` on disk may lag the editor; exports
  used for build reference were taken from the live editor → re-verify against
  `get_screenshot` during build, not the committed file.
- [Font loading flash] Fonts load async → gate the first frame on
  `useFonts` ready (splash holds) rather than rendering fallback-font UI.
- [Token drift] `lib/ui/theme.ts` duplicates Pencil variables → keep the
  mapping table in the module header comment; later groups reuse it.

## Open Questions

- **Forgot-PIN behavior**: no designed recovery screen. Interim proposal:
  tapping "¿Olvidaste tu PIN?" opens a native dialog explaining the PIN is
  stored only on this phone and, for now, resetting it requires reinstalling
  the app (data loss warning). A real recovery flow (e.g. re-auth via Google
  when connected) would be its own designed change. — resolve at design gate.
