# Design: 2-profile-domain

## Context

`ProfileRepo.get()` already exists on the repo seam (`lib/repo/types.ts`)
and is consumed by `ProfileScreen`; the mock has always faked it. The real
implementation (`lib/repo/real/profileRepo.ts`) is a one-line stub that
always resolves `null`, documented as deferred until "the profile/settings
screen group" existed. That screen group (Perfil (Yo)) shipped in the
`profile-tools-screens` change, but that change's `profile-home` spec only
covers reading an already-set profile — nothing writes one. This change
closes that gap: GitHub issue #2.

A second, parallel branch (GitHub issue #5, avatar/cédula work) also
touches avatar selection and is expected to add a `0003` migration and
avatar-picker infrastructure. This change deliberately avoids both: it
does not modify `components/avatars.ts`, and its migration number
collision is called out for the captain to reconcile at merge rather than
guessed at here.

## Goals / Non-Goals

**Goals:**

- A lender can set their name, avatar, business name, and phone once and
  see it reflected on Perfil (Yo) immediately.
- Real installs never show a fake identity — `ProfileRepo.get()` returns
  `null` only when genuinely unset, and the UI treats that as a distinct,
  friendly "set up your profile" state rather than falling back to a
  placeholder name.
- The avatar choice is constrained to the app's existing curated set, so
  there's no risk of picking a key with no bundled asset.

**Non-Goals:**

- No onboarding-step wiring (e.g. forcing profile capture during the PIN
  setup flow) — this change only adds the capability and an entry point
  from Perfil (Yo); deciding whether onboarding should require it is a
  separate product decision.
- No unification with the customer-facing avatar picker (parallel #5
  branch) — this change builds the smallest inline selector needed here
  and notes the future unification opportunity.
- No sync of the profile row to the lender's Google Sheet — `profile` is
  local device identity, not a business record the Sheet mirrors; no
  `pending_mutations` row is enqueued for it, unlike customers/loans/
  payments/visits.
- No multi-profile / multi-lender-per-device support — one row, one fixed
  singleton id, matching "no backend server, one lender per install."

## Decisions

- **New `profile` table** (`lib/db/schema.ts`): `id` (fixed singleton
  `"self"`, not a generated uuid — there is exactly one row this table
  will ever hold), `name` (not null), `avatarKey`, `businessName`,
  `phone` (all nullable), `createdAt`/`updatedAt`, mirroring the other
  tables' timestamp style. `npm run db:generate` after editing, per
  project convention — the resulting migration is never hand-edited.
- **Singleton upsert, not create-then-update**: `lib/profile/
setProfile.ts` does a single `insert(...).onConflictDoUpdate(...)`
  keyed on the fixed id, the same pattern `lib/sync/push.ts` already uses
  for `sync_meta`. This avoids a read-then-branch race and keeps
  "Editar perfil" idempotent whether it's the first save or the tenth.
- **`Profile` type moves into `lib/profile/profile.schema.ts`**, and
  `lib/repo/types.ts` imports it instead of declaring its own copy —
  matching how `CustomerRepo` already imports `Customer` from
  `lib/customers/customer.schema.ts`. `ProfileRepo` gains
  `set(input: SetProfileInput): Promise<Profile>` alongside the existing
  `get()`.
- **Avatar key list lives in `lib/profile/profile.schema.ts`
  (`AVATAR_KEYS`), not in `components/avatars.ts`** — that file's
  `AVATARS` record is private (unexported) and owned by the parallel
  avatar-infrastructure branch (#5). `AVATAR_KEYS` is a hand-mirrored
  copy of its current keys, used both for Zod validation
  (`z.enum(AVATAR_KEYS)`) and to render the inline picker in
  `EditProfileScreen` (via the already-exported `avatarSource()`
  helper). This is a known, called-out duplication — once #5's picker
  infrastructure lands, `EditProfileScreen`'s inline picker should be
  swapped for the shared component and this list retired in favor of
  whatever `components/avatars.ts` exports then.
- **`EditProfileScreen` mirrors `EditCustomerFormScreen`**: same
  `ScreenHeader` (close icon, since it's a modal-style push), theme
  tokens, and field layout (label + bordered `TextInput`), plus one new
  row — a horizontal avatar strip above the fields. No corresponding
  `pencil.pen` frame exists for this screen, same precedent as
  `EditCustomerFormScreen`.
- **Perfil (Yo)'s identity card branches three ways**: profile loaded →
  the existing card plus a small edit button that pushes
  `/perfil/editar`; profile loaded and `null` → a "Configura tu perfil"
  prompt card (same shape/tone, tappable, pushes the same route) instead
  of the old `"Cobrador"` fallback name; still loading → an empty
  placeholder card (avoids a flash of the "not set" prompt before the
  first fetch resolves).
- **Mock repo becomes stateful for profile**: `lib/repo/mock/index.ts`
  keeps its `{ name: "Carlos", avatarKey: "male4" }` seed (unchanged
  demo behavior) but now holds it in a `let` bound to the factory's
  closure and exposes a real `set()` that mutates it, validated through
  the same `setProfileSchema` the real repo uses — consistent with how
  every other mock entity (customers, loans, payments, visits) is a
  mutable in-memory array behind the same Zod schema as its real
  counterpart, not a hand-rolled duplicate.

## Risks / Trade-offs

- [`AVATAR_KEYS` duplicates knowledge that lives in `components/
avatars.ts`'s private `AVATARS` record] → accepted and called out
  explicitly rather than exporting `AVATARS` or adding new avatar
  infrastructure, both of which would conflict with the parallel #5
  branch; flagged in both this file and the `EditProfileScreen` header
  comment as a follow-up once #5 lands.
- [Two branches (#2, #5) both generate a `0003_*` migration against the
  same `lib/db/migrations/` sequence] → expected and explicitly deferred
  to the captain at merge time, per the task's own instructions; neither
  branch should try to guess the other's final numbering.
- [No profile capture step during onboarding means a lender can use the
  whole app "anonymous" indefinitely] → acceptable for this change; the
  first-run prompt on Perfil (Yo) is the nudge, not a hard gate. Making
  it mandatory is a separate, larger product decision (would need to
  hook into the PIN-setup onboarding flow) left out of scope here.
