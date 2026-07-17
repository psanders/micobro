# Proposal: 5-customer-avatar-cedula

## Why

`CustomerDetailView.cedula` and `.avatarKey` are always `null` in real mode
because nothing captures them — no `cedula` column exists on the
`customers` table, and there's no way to assign an avatar to a real
customer. The mock fakes both via `customerMetaFixtures`, so the
Cliente Detalle screen looks fully designed in mock mode and visibly
degraded (no avatar, no cédula row) for every real customer. Both were
already fully designed in `pencil.pen`; this closes the mock/real gap
(GitHub issue #5).

## What Changes

- Add nullable `cedula` and `avatar_key` columns to the `customers` table.
  `cedula` stores the Dominican cédula normalized to 11 raw digits
  (dashes/spaces stripped on input); display formatting
  ("XXX-XXXXXXX-X") is the UI's job.
- `avatarKey` is constrained to a curated set of nine bundled avatar
  images (`female1`, `female2`, `male1`–`male7`) — the same semantic keys
  the mock's `customerMetaFixtures` already uses — picked from a grid, not
  a photo picker (no camera/storage permissions requested).
- `NewCustomerFormScreen` and `EditCustomerFormScreen` gain a cédula text
  field (accepts dashed or plain digit input, surfaces the 11-digit
  validation error) and an avatar picker over the curated set.
- `createCustomer`/`updateCustomer` persist both fields; the real
  `getCustomerDetail` and `searchCustomers` now select them off the
  customers row instead of hardcoding `null`. The mock repo's
  `customerMetaFixtures` still wins for the seven design-dataset
  customers (so the curated demo look is unaffected), falling back to the
  customer row's own columns for anything created at runtime.

## Capabilities

### New Capabilities

- `customer-form`: capturing cédula and an avatar when creating or editing
  a customer.

### Modified Capabilities

- `customer-detail`: the profile card's avatar and cédula row now render
  from real, lender-captured data in real mode instead of always falling
  back to initials / an omitted row.

## Impact

- `lib/db/schema.ts` — `customers.cedula`, `customers.avatarKey`;
  `npm run db:generate` migration `0003_opposite_wildside.sql`.
- `lib/customers/avatarKeys.ts` (new) — the curated `AVATAR_KEYS` source
  of truth, imported by both the Zod schema and `components/avatars.ts`
  (which now type-checks its bundled-image map against it).
- `lib/customers/customer.schema.ts` — `cedula`/`avatarKey` added to
  `createCustomerSchema`/`updateCustomerSchema` and the `Customer` type.
- `lib/utils/cedula.ts` (new) — `normalizeCedula`/`formatCedula` display
  helpers.
- `lib/customers/createCustomer.ts`, `updateCustomer.ts`,
  `getCustomerDetail.ts`, `searchCustomers.ts` — read/write the new
  columns instead of hardcoding `null`.
- `lib/repo/mock/fixtures.ts`, `lib/repo/mock/index.ts` — `Customer`
  fixtures carry (null) `cedula`/`avatarKey` columns; mock create/update
  persist them; mock search/getDetail prefer `customerMetaFixtures` then
  fall back to the customer row.
- `components/AvatarPicker.tsx` (new) — curated-grid picker component.
- `components/screens/NewCustomerFormScreen.tsx`,
  `EditCustomerFormScreen.tsx` — cédula field + avatar picker wired to the
  repo calls.
