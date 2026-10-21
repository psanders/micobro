## 1. Domain

- [x] 1.1 `lib/account/eraseDeviceData.ts` validated function (PIN-gated, children-first deletes, sign-out tolerant)
- [x] 1.2 `AccountRepo` (real + mock) and `AuthGateProvider.reset()`

## 2. UI

- [x] 2.1 Pencil: app.pen "10c/10d/10e" (row, confirmation, PIN step)
- [x] 2.2 "Eliminar mis datos" row + confirmation in `ProfileScreen`
- [x] 2.3 `EraseDataScreen` + `app/eliminar-datos.tsx`

## 3. Tests

- [x] 3.1 Unit: erase, wrong PIN, sign-out failure, malformed PIN
- [x] 3.2 Maestro: `eliminar-datos.yaml` (wrong PIN, then right PIN → Crea tu PIN)
