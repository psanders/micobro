# Proposal: auth-screens

## Why

The app shell built so far uses placeholder navy screens that don't match the
product design in `pencil.pen` (Collectors User Flow). We're now shipping the
designed product screen-group by screen-group against the mock data client, and
authentication is the first group: it's the front door of the app, it already
has working-but-unstyled behavior (PIN setup, PIN unlock, Google connect), and
every later group sits behind it.

## What Changes

- Rebuild the three authentication screens to match the Pencil designs
  pixel-close, replacing the current basic navy versions:
  - **Configura tu PIN** (design `EYzn2`) — two-step create/confirm PIN with
    error state, first screen on a fresh install.
  - **Conectar con Google** (design `S2oEG8`) — optional cloud-backup choice
    shown after PIN setup and reachable later from Settings.
  - **Desbloquear** (design `Jy3HY`) — PIN unlock for returning users,
    including the "¿Olvidaste tu PIN?" path.
- Wire all links/navigation on these screens as in production: PIN setup →
  Google choice → main app; unlock → main app; forgot-PIN path; skipping
  Google and re-entering later from Settings stays functional.
- Screens run fully against the mock client (`EXPO_PUBLIC_USE_MOCK_REPOS=true`);
  the mock `SyncRepo.connect` simulates a successful Google connection so the
  full flow is walkable in demo mode without real OAuth.
- Shared PIN components (`PinInput`, `PinKeypad`) restyled to the design system
  tokens from `pencil.pen`, with Storybook stories updated.

## Capabilities

### New Capabilities

- `app-lock`: local PIN protection — mandatory PIN creation on first run,
  PIN unlock on every subsequent open, and the forgot-PIN recovery path.
- `google-connect`: the optional connect-to-Google onboarding step and its
  re-entry from Settings — offered, skippable, and simulated end-to-end when
  running on the mock client.

### Modified Capabilities

<!-- none — openspec/specs/ is empty; these are the first promoted capabilities -->

## Impact

- `app/onboarding/pin.tsx`, `app/onboarding/sync.tsx`, `app/desbloquear.tsx`,
  `app/conectar.tsx` — route wrappers stay, backing screens rebuilt.
- `components/PinInput.tsx`, `components/PinKeypad.tsx`,
  `components/screens/ConnectGoogleScreen.tsx` + new/updated `*.stories.tsx`.
- `lib/repo/mock/syncRepo.mock.ts` — connect simulation already exists; verify
  behavior matches spec.
- No schema, sync, or domain-logic changes. Later groups (home/nav, collection
  flow, profile/settings) are separate changes.
