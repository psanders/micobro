# Tasks: 5-customer-avatar-cedula

## 1. Data seam

- [x] 1.1 Add `cedula`/`avatarKey` (`avatar_key`) nullable columns to `customers` in `lib/db/schema.ts`; `npm run db:generate` → `0003_opposite_wildside.sql`
- [x] 1.2 `lib/customers/avatarKeys.ts` — curated `AVATAR_KEYS` (`female1`, `female2`, `male1`–`male7`), matching the mock's existing semantic keys; `components/avatars.ts`'s bundled-image map type-checked against it
- [x] 1.3 `lib/customers/customer.schema.ts` — `cedulaSchema` (strip to digits, require 11) and `avatarKeySchema` (`z.enum(AVATAR_KEYS)`) added to `createCustomerSchema`/`updateCustomerSchema` and the `Customer` type
- [x] 1.4 `lib/utils/cedula.ts` — `normalizeCedula`/`formatCedula` display helpers
- [x] 1.5 `createCustomer.ts`/`updateCustomer.ts` persist both columns; `getCustomerDetail.ts`/`searchCustomers.ts` select them instead of hardcoding `null`
- [x] 1.6 Mock repo: `fixtures.ts` customer rows carry (null) `cedula`/`avatarKey`; `mock/index.ts` create/update persist them, search/getDetail prefer `customerMetaFixtures` then fall back to the customer row

## 2. Components

- [x] 2.1 `components/AvatarPicker.tsx` — curated-grid picker (wraps `Avatar`, brand-colored selection ring + check badge)

## 3. Screens & wiring

- [x] 3.1 `NewCustomerFormScreen` — cédula field (format hint, surfaced validation error) + `AvatarPicker`, wired into `customerRepo.create`
- [x] 3.2 `EditCustomerFormScreen` — same fields, prefilled from `customerRepo.getDetail`, wired into `customerRepo.update`

## 4. Tests & gates

- [x] 4.1 Jest: `createCustomer`/`updateCustomer` cédula (valid dashed 11-digit, omitted → null, rejects non-11-digit) and avatarKey (accepted curated key, rejected unknown key) cases; `getCustomerDetail` carries cédula/avatarKey through (present, null, unknown customer); `searchCustomers` carries `avatarKey` through; `lib/utils/cedula.ts` normalize/format cases
- [x] 4.2 lint/typecheck/test/format:check all green
- [x] 4.3 `openspec validate 5-customer-avatar-cedula --strict`
