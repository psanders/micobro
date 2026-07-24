# Design: 5-customer-avatar-cedula

## Context

`pencil.pen`'s customer detail and demo dataset (`customerMetaFixtures`)
already show every customer with an avatar and, for most, a cédula row.
The real client has neither: `lib/db/schema.ts`'s `customers` table has no
cédula column, and there's no mechanism at all to assign an avatar to a
real customer, so `getCustomerDetail`/`searchCustomers` hardcode
`avatarKey`/`cedula` to `null` for every real customer (see the comment
that used to sit on `getCustomerDetail.ts`). GitHub issue #5 asks to close
that gap.

## Goals / Non-Goals

**Goals:**

- A nullable `cedula` column, normalized and validated as an 11-digit
  Dominican cédula, entered with or without dashes.
- A nullable `avatarKey` column constrained to a small, curated,
  already-bundled image set — no new permissions.
- Both captured from `NewCustomerFormScreen`/`EditCustomerFormScreen` and
  visible on Cliente Detalle / Buscar in real mode, matching what the mock
  already shows.

**Non-Goals:**

- No photo picker / camera / gallery permission — out of scope per the
  captain's design decision; a curated set is a deliberate, permission-free
  choice, not a placeholder for a future photo picker.
- No cédula checksum/algorithmic validation — just the 11-digit shape.
  Dominican cédulas do have a check-digit algorithm, but lenders in the
  field frequently record cédulas by hand from a photo of the ID, so
  rejecting a mistyped-but-well-formed number on checksum grounds would be
  more friction than it's worth for a v1; format validation catches the
  overwhelmingly common error (wrong digit count).
- No re-keying of the mock's `customerMetaFixtures` — the seven design
  dataset customers keep their curated meta-driven avatar/cédula so the
  demo continues to look intentionally designed; only customers created
  at runtime (mock or real) go through the new columns.

## Decisions

- **Curated avatar set, defined once.** `lib/customers/avatarKeys.ts`
  exports `AVATAR_KEYS = ["female1", "female2", "male1", "male2", "male3",
"male4", "male5", "male6", "male7"] as const` — the exact keys already
  used by `customerMetaFixtures` and the profile mock (`male4` for
  "Carlos"). `components/avatars.ts`'s bundled-image `AVATARS` record is
  now typed `Record<AvatarKey, ImageSourcePropType>` against this list, so
  the two can never drift silently — adding an asset without adding it to
  `AVATAR_KEYS` (or vice versa) is now a type error. The Zod schema's
  `avatarKeySchema` is `z.enum(AVATAR_KEYS).optional()`.
- **Cédula normalization lives in the schema, not the DB or UI.**
  `cedulaSchema` strips non-digits (`.replace(/\D/g, "")`) then refines on
  `length === 11`; the stored value is always 11 raw digits. Display
  formatting (`XXX-XXXXXXX-X`) is a pure UI helper
  (`lib/utils/cedula.ts`), consistent with `lib/utils/money.ts`'s
  cents-stored / formatted-for-display split.
- **Update semantics match the existing `address` field.** Omitting
  `cedula`/`avatarKey` on an update clears it to `null` (same as
  `address` today) rather than leaving the previous value untouched —
  simplest mental model, and matches how the form screens work (they
  always send the current field state, blank or not).
- **Mock keeps its meta-driven demo look.** `customerMetaFixtures` still
  wins over the customer row's own `cedula`/`avatarKey` in the mock's
  `search`/`getDetail` (`metaOf(id)?.avatarKey ?? customer.avatarKey`), so
  the seven curated fixtures are unaffected; only customers created at
  runtime (via the New/Edit forms in mock mode) fall through to their own
  captured columns — otherwise a demo-mode "create customer" flow would
  silently drop whatever avatar/cédula the user just picked.
- **No new screen for avatar picking.** `AvatarPicker` is a small
  in-form grid component (reusing `Avatar` for each cell), not a separate
  route — it fits inline in both `NewCustomerFormScreen` and
  `EditCustomerFormScreen` alongside the existing text fields, matching
  how those two screens are already laid out (no corresponding
  `pencil.pen` frame exists for either, per their existing header
  comments; this follows current design tokens).
