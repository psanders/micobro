## Context

Local SQLite holds every entity; AsyncStorage holds the onboarding flag, sheet id and recent searches; the PIN lives in SecureStore; Google Sign-In keeps its own session. `AuthGateProvider` decides between onboarding, unlock and the app.

## Goals / Non-Goals

**Goals:** one action that leaves the phone like a fresh install, safe against a borrowed unlocked phone.

**Non-Goals:** deleting the Drive sheet (the lender owns it; documented instead), remote or server-side deletion (there is no server).

## Decisions

1. **PIN checked inside the validated function**, not just in the UI, so no caller can erase without it. A wrong PIN resolves `false` and erases nothing; a malformed PIN is a `ValidationError`.
2. **Two steps: dialog, then PIN.** The dialog explains the consequences; the PIN screen reuses the Cambiar PIN verify layout.
3. **Children-first table order** (payments, visits, loans, customers, cash closes, pending mutations, sync meta, profile) so foreign keys never block.
4. **Google sign-out failures don't block the erase** — a lender offline or never connected must still be able to wipe.
5. **`AsyncStorage.clear()`** rather than a key list, so future keys are covered; then the PIN; then `AuthGateProvider.reset()` lands on "Crea tu PIN".

## Risks / Trade-offs

- Irreversible → explicit dialog copy plus the PIN.
- The Drive sheet survives → stated in the dialog and on the public page.
