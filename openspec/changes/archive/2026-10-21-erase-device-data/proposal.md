## Why

Google Play requires apps that link an account to offer data deletion in the app, and lenders need a clean way to wipe a phone they are handing over or retiring. Micobro has no server, so "deleting my data" means erasing what lives on the phone and disconnecting Google; the backup sheet in the lender's own Drive is theirs.

## What Changes

- New "Eliminar mis datos" action in Mi cuenta.
- A confirmation dialog states what is erased and that the Drive sheet stays.
- The current PIN is required before anything is erased; a wrong PIN erases nothing.
- Erasing removes every local table, the app's stored settings and the PIN, signs out of Google, and returns the app to first-run onboarding.
- A public page (micobro.app/eliminar-datos) explains in-app deletion and how to delete the Drive sheet.

## Capabilities

### New Capabilities

- `device-data-erasure`: erasing all of the lender's data from the phone, gated by the PIN.

### Modified Capabilities

## Impact

- `lib/account/eraseDeviceData.ts` (validated function), an `account` repo (real + mock), `AuthGateProvider.reset()`, `EraseDataScreen` + `app/eliminar-datos.tsx`, a row in `ProfileScreen`.
- No schema, sync or dependency changes.
