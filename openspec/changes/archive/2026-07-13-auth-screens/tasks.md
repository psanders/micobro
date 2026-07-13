# Tasks: auth-screens

## 1. Foundations

- [x] 1.1 Add `@expo-google-fonts/plus-jakarta-sans` + `expo-font`; load fonts in `app/_layout.tsx` gated before first render
- [x] 1.2 Create `lib/ui/theme.ts` design tokens mirrored from `pencil.pen` variables (colors, radii, font families)
- [x] 1.3 Add `ProfileRepo` to `lib/repo/types.ts` (`get(): Promise<Profile | null>`); real impl returns null; mock returns Carlos + avatar; wire through `RepoProvider` with `useProfileRepo`

## 2. Components (Storybook-first)

- [x] 2.1 Restyle `PinInput` to design cells (filled/active-cursor/empty/error), same props; update stories
- [x] 2.2 Restyle `PinKeypad` to design grid (4 rows, 56-high keys, `#F4F8FF`, white backspace), same props; update stories
- [x] 2.3 Build shared `PinScreen` layout component (header block variants, dots, keypad, footer slot) with stories for setup/confirm/error/unlock variants

## 3. Screens

- [x] 3.1 Rebuild PIN setup screen (`app/onboarding/pin.tsx` + `components/screens/PinSetupScreen.tsx`): Crea tu PIN → Confirma tu PIN → error-on-mismatch per spec
- [x] 3.2 Rebuild Desbloquear (`app/desbloquear.tsx` + `components/screens/UnlockScreen.tsx`): profile greeting w/ avatar or logo fallback, error state, forgot-PIN dialog
- [x] 3.3 Rebuild Conectar con Google (`components/screens/ConnectGoogleScreen.tsx`): design layout (header w/ X, cloud icon, headline, CTA bar), mock-connect simulation, real-mode PKCE + unconfigured note preserved
- [x] 3.4 Wire navigation end-to-end: pin → sync → tabs; unlock → tabs; Settings → conectar (X/skip = back); remove dead navy styles

## 4. Tests & gates

- [x] 4.1 Unit tests: PIN setup match/mismatch flows, unlock correct/wrong PIN, profile fallback, mock connect flips status (Jest, stubbed repos)
- [x] 4.2 Update `.maestro/launch.yaml` assertion if copy changed; keep E2E smoke green
- [x] 4.3 `lint`, `typecheck`, `test` all green; walk full flow on emulator with `start:demo`
