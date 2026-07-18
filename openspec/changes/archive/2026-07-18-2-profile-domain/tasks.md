# Tasks: 2-profile-domain

## 1. Data seam

- [x] 1.1 Add `profile` table to `lib/db/schema.ts` (singleton row, fixed
      `id: "self"`); `npm run db:generate` → `0003_perfect_iron_fist.sql`
      (collides in number with the parallel #5 branch's own `0003` — left
      for the captain to reconcile at merge, per instructions)
- [x] 1.2 `lib/profile/profile.schema.ts` — `setProfileSchema` (name
      required, avatarKey/businessName/phone optional, avatarKey
      constrained to `AVATAR_KEYS`), `Profile` type, `PROFILE_ID` singleton
      constant, `AVATAR_KEYS` (hand-mirrored from `components/avatars.ts`'s
      private `AVATARS` record — that file is not touched)
- [x] 1.3 `lib/profile/getProfile.ts` + `lib/profile/setProfile.ts`
      (validated functions) + barrel `index.ts`
- [x] 1.4 `Profile`/`SetProfileInput` on `lib/repo/types.ts` now imported
      from `lib/profile/profile.schema.ts`; `ProfileRepo` gains `set(input)`
- [x] 1.5 `createRealProfileRepo` composes `getProfile`/`setProfile`
      against `db` instead of always returning `null`
- [x] 1.6 Mock `profile` repo becomes stateful (in-memory, seeded with the
      existing Carlos fixture) with a real `set()` validated the same way

## 2. Capture flow

- [x] 2.1 `components/screens/EditProfileScreen.tsx` — name, avatar
      (inline picker over `AVATAR_KEYS`), nombre del negocio, teléfono;
      modeled on `EditCustomerFormScreen`'s `ScreenHeader`/theme/field
      styling; writes via `profileRepo.set()`
- [x] 2.2 Route `app/perfil/editar.tsx`
- [x] 2.3 `ProfileScreen` wiring: edit affordance on the identity card when
      a profile exists; a friendly "Configura tu perfil" prompt card
      (distinct from the old anonymous "Cobrador" fallback) when it
      doesn't; both push `/perfil/editar`

## 3. Tests & gates

- [x] 3.1 Jest: `createSetProfile` (valid input, missing-name rejection,
      out-of-set avatarKey rejection), `createGetProfile` (row vs. null),
      real profile repo (`get()` row vs. null, `set()` issues an upsert)
- [x] 3.2 `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test`,
      `npm run format:check` — see proposal/PR for the `format:check`
      caveat (pre-existing failures on generated migration
      metadata/unrelated `.claude/` docs, not introduced by this change;
      every file this change adds or edits is individually
      Prettier-clean)
- [x] 3.3 On-device verification (dev-client rebuild not performed in this
      pass — no native module changed, so a Metro reload should suffice,
      but this wasn't walked live; flagged for the captain/next pass).
      Done 2026-07-18: Mi cuenta shows the real profile ("Pedro Sanders",
      correct avatar, live "Respaldo activo · hace 6 min" pill) instead of
      the anonymous fallback — confirms `getProfile()` works in real mode.
      Opened Editar Perfil, confirmed it's pre-filled with the existing
      name/avatar, edited "Nombre del negocio" and saved — returned to Mi
      cuenta with no error, confirming `setProfile()`'s upsert path works.
