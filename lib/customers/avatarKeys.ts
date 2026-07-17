/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * The curated avatar set customers can be assigned — semantic keys, not
 * photos (no camera/storage permissions). Matches the mock's
 * `customerMetaFixtures` keys and the bundled images in
 * `components/avatars.ts` one-to-one; that file's `AVATARS` record is
 * type-checked against this list so the two can never drift.
 */
export const AVATAR_KEYS = [
  "female1",
  "female2",
  "male1",
  "male2",
  "male3",
  "male4",
  "male5",
  "male6",
  "male7"
] as const;

export type AvatarKey = (typeof AVATAR_KEYS)[number];
