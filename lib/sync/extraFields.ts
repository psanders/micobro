/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * The Sheet's `Extra` tab: a `Campo | Valor` key/value tab, one row per fact
 * about the lender (their profile, and the app version that last wrote it).
 * The Campo labels below are part of the Sheet contract (AGENTS.md
 * Compatibility): matched exactly, with accents, and a new fact is always a
 * new row, never a new column. Kept apart from extraTab.ts so lib/profile
 * can name the changed fields without loading the Sheets client.
 */
import type { Profile } from "../profile/profile.schema";

export const PROFILE_ENTITY = "profile";
export const EXTRA_TAB = "Extra";
/** What push and pull read of `Extra`: Campo and Valor. */
export const EXTRA_RANGE = `${EXTRA_TAB}!A:B`;

export const EXTRA_FIELDS = [
  "Nombre",
  "Negocio",
  "Teléfono",
  "Avatar",
  "Foto",
  "Versión de la app",
  "Actualizado"
] as const;
export type ExtraField = (typeof EXTRA_FIELDS)[number];

/** The Campos that hold the lender's profile (the rest describe the write). */
export const PROFILE_FIELDS = ["Nombre", "Negocio", "Teléfono", "Avatar", "Foto"] as const;
export type ProfileField = (typeof PROFILE_FIELDS)[number];

/** Each profile Campo's Valor: an absent value is an empty cell. */
export function profileFieldValues(profile: Profile): Record<ProfileField, string> {
  return {
    Nombre: profile.name,
    Negocio: profile.businessName ?? "",
    Teléfono: profile.phone ?? "",
    Avatar: profile.avatarKey ?? "",
    Foto: profile.photo ?? ""
  };
}

/** The profile Campos whose Valor differs between `before` (none: all) and `after`. */
export function changedProfileFields(before: Profile | null, after: Profile): ProfileField[] {
  const next = profileFieldValues(after);
  if (!before) return [...PROFILE_FIELDS];
  const previous = profileFieldValues(before);
  return PROFILE_FIELDS.filter((field) => previous[field] !== next[field]);
}
