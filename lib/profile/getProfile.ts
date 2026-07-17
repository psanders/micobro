/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { z } from "zod/v4";
import { eq } from "drizzle-orm";
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { profile as profileTable } from "../db/schema";
import { PROFILE_ID, type Profile } from "./profile.schema";
import type { Database } from "../db/client";

export interface GetProfileDeps {
  db: Database;
}

const getProfileSchema = z.object({});

export type GetProfileInput = z.infer<typeof getProfileSchema>;

/**
 * Reads the single profile row. Returns null only when the lender hasn't
 * completed the "Editar perfil" capture flow yet — never a partial/anonymous
 * placeholder.
 */
export function createGetProfile({ db }: GetProfileDeps) {
  const fn = async (): Promise<Profile | null> => {
    const rows = await db.select().from(profileTable).where(eq(profileTable.id, PROFILE_ID));
    const row = rows[0];
    if (!row) return null;

    return {
      name: row.name,
      avatarKey: row.avatarKey,
      businessName: row.businessName,
      phone: row.phone
    };
  };

  return withErrorHandlingAndValidation(fn, getProfileSchema);
}
