/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { z } from "zod/v4";

/**
 * The fixed row id for the single profile row this install ever has —
 * there is one lender per install, so `profile` is a singleton table
 * keyed by this constant rather than a generated uuid.
 */
export const PROFILE_ID = "self";

/**
 * The curated avatar keys the app ships, mirrored from
 * `components/avatars.ts`'s `AVATARS` record (kept private to that file —
 * this list must stay in sync with its keys by hand until the avatar
 * picker infrastructure is unified across profile/customer forms).
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

export const setProfileSchema = z.object({
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .transform((v) => v.trim()),
  avatarKey: z.enum(AVATAR_KEYS).optional(),
  businessName: z.string().optional(),
  phone: z.string().optional()
});

export type SetProfileInput = z.infer<typeof setProfileSchema>;

/**
 * The lender's own display identity, used for greeting personalization
 * (e.g. "Hola, Carlos." on the unlock screen) and the Perfil (Yo) screen.
 * `avatarKey` is a semantic key mapped to a bundled asset at the
 * component layer — the repo/domain layers stay UI-free.
 */
export interface Profile {
  name: string;
  avatarKey: string | null;
  businessName: string | null;
  phone: string | null;
}
