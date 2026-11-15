/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { eq } from "drizzle-orm";
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { profile as profileTable } from "../db/schema";
import { PROFILE_ID, setProfileSchema, type SetProfileInput, type Profile } from "./profile.schema";
import type { Database } from "../db/client";

export interface SetProfileDeps {
  db: Database;
}

/**
 * Creates or replaces the single profile row (an upsert keyed by the
 * fixed `PROFILE_ID` singleton id) — there is one lender per install, so
 * "Editar perfil" always writes the same row rather than creating a new
 * one each time. An omitted `photo` keeps the stored one; null removes it.
 * Not enqueued to `pending_mutations`: the profile is local device
 * identity, not a business record synced to the lender's Google Sheet.
 */
export function createSetProfile({ db }: SetProfileDeps) {
  const fn = async (params: SetProfileInput): Promise<Profile> => {
    const now = new Date();
    const photo =
      params.photo !== undefined
        ? params.photo
        : ((
            await db
              .select({ photo: profileTable.photo })
              .from(profileTable)
              .where(eq(profileTable.id, PROFILE_ID))
          )[0]?.photo ?? null);
    const row = {
      id: PROFILE_ID,
      name: params.name,
      avatarKey: params.avatarKey ?? null,
      businessName: params.businessName ?? null,
      phone: params.phone || null,
      photo,
      createdAt: now,
      updatedAt: now
    };

    await db
      .insert(profileTable)
      .values(row)
      .onConflictDoUpdate({
        target: profileTable.id,
        set: {
          name: row.name,
          avatarKey: row.avatarKey,
          businessName: row.businessName,
          phone: row.phone,
          // Only a given photo is written, so an omitted one is never cleared.
          ...(params.photo !== undefined ? { photo: row.photo } : {}),
          updatedAt: row.updatedAt
        }
      });

    return {
      name: row.name,
      avatarKey: row.avatarKey,
      businessName: row.businessName,
      phone: row.phone,
      photo: row.photo
    };
  };

  return withErrorHandlingAndValidation(fn, setProfileSchema);
}
