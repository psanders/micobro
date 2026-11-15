/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import * as Crypto from "expo-crypto";
import { eq } from "drizzle-orm";
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { pendingMutations, profile as profileTable } from "../db/schema";
import { PROFILE_ENTITY, changedProfileFields } from "../sync/extraFields";
import { logger } from "../logger";
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
 *
 * Queues a `profile` mutation naming the Campos that changed against the
 * stored row (`{"campos": ["Nombre", "Foto"]}`), so push writes only those
 * rows of the Sheet's `Extra` tab (see lib/sync/extraTab.ts). A save that
 * changes nothing queues nothing.
 */
export function createSetProfile({ db }: SetProfileDeps) {
  const fn = async (params: SetProfileInput): Promise<Profile> => {
    const now = new Date();
    const stored =
      (await db.select().from(profileTable).where(eq(profileTable.id, PROFILE_ID)))[0] ?? null;
    const photo = params.photo !== undefined ? params.photo : (stored?.photo ?? null);
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
    const saved: Profile = {
      name: row.name,
      avatarKey: row.avatarKey,
      businessName: row.businessName,
      phone: row.phone,
      photo: row.photo
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

    const campos = changedProfileFields(
      stored
        ? {
            name: stored.name,
            avatarKey: stored.avatarKey,
            businessName: stored.businessName,
            phone: stored.phone,
            photo: stored.photo ?? null
          }
        : null,
      saved
    );
    if (campos.length > 0) {
      await db.insert(pendingMutations).values({
        id: Crypto.randomUUID(),
        entity: PROFILE_ENTITY,
        entityId: PROFILE_ID,
        operation: "update",
        payload: JSON.stringify({ campos }),
        status: "pending",
        retryCount: 0,
        createdAt: now
      });
      logger.verbose("queued profile update", { campos });
    }

    return saved;
  };

  return withErrorHandlingAndValidation(fn, setProfileSchema);
}
