# Proposal: 2-profile-domain

## Why

`lib/repo/real/profileRepo.ts` has always returned `null` — there's no
`profile` table and nothing writes to one, so every real install looks
anonymous even after onboarding, while the mock fakes it with a hardcoded
`{ name: "Carlos", avatarKey: "male4" }`. Perfil (Yo) can show the
lender's own identity, but nothing ever sets it. This is GitHub issue #2,
found during a repo-wide gap sweep.

## What Changes

- **Profile fields**: `name` (required), `avatarKey` (optional, one of
  the app's curated avatars), `businessName`/"nombre del negocio"
  (optional), `phone` (optional). One profile per install.
- **New `profile` table** (`lib/db/schema.ts`): a single row keyed by a
  fixed singleton id (`"self"`), mirroring the timestamp style of the
  other tables. `npm run db:generate` produces the migration.
- **Capture/edit flow**: a new "Editar perfil" screen, modeled on
  `EditCustomerFormScreen`'s fields/layout, reachable from Perfil (Yo)
  via an edit affordance on the identity card. Writes through a new
  `lib/profile/setProfile.ts` validated function.
- **Avatar picker**: a minimal inline selector over the same curated
  avatar keys the app already ships (`components/avatars.ts`'s private
  `AVATARS` record), added to the profile domain rather than to
  `components/avatars.ts` itself — that file is owned by a parallel
  avatar-infrastructure change (GitHub issue #5) this change must not
  conflict with.
- **First-run empty state**: Perfil (Yo) now distinguishes "no profile
  captured yet" from "profile captured" — the former shows a friendly
  Spanish prompt inviting the lender to set it up, instead of the
  previous fake/anonymous "Cobrador" layout.
- **Real repo**: `createRealProfileRepo` reads/writes the `profile` table
  instead of always resolving `null`.

## Capabilities

### Modified Capabilities

- `profile-home`: adds profile capture/editing and the first-run empty
  state to the Perfil (Yo) screen (currently only specified as a
  read-only identity/stats/settings view in the still-open
  `profile-tools-screens` change).

## Impact

- `lib/db/schema.ts` — new `profile` table; `npm run db:generate`
  migration (`0003_perfect_iron_fist.sql` in this worktree — a parallel
  branch, GitHub issue #5, also lands a `0003`; the two are expected to
  collide and need renumbering at merge, not before).
- `lib/profile/` — new domain: `profile.schema.ts` (Zod schema + curated
  `AVATAR_KEYS`), `getProfile.ts`, `setProfile.ts`, barrel `index.ts`.
- `lib/repo/types.ts` — `Profile` now sourced from `lib/profile/
profile.schema.ts` (adds `businessName`/`phone`); `ProfileRepo` gains
  `set(input): Promise<Profile>`.
- `lib/repo/real/profileRepo.ts`, `lib/repo/real/index.ts` — real repo
  reads/writes the table.
- `lib/repo/mock/index.ts` — mock profile becomes stateful (in-memory,
  seeded with the existing Carlos fixture) so `set()` is observable in
  the mock client too.
- `components/screens/EditProfileScreen.tsx` — new capture/edit screen.
- `components/screens/ProfileScreen.tsx` — edit affordance + first-run
  empty state.
- `app/perfil/editar.tsx` — new route.
- Tests: `lib/profile/setProfile.ts` and `getProfile.ts` validated
  functions, and the real repo's row-vs-null behavior.
