/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Reads/writes the single `profile` row via the validated-function pair
 * in `lib/profile/`. `get()` returns null only when the lender hasn't
 * completed "Editar perfil" yet.
 */
import { createGetProfile } from "../../profile/getProfile";
import { createSetProfile } from "../../profile/setProfile";
import type { Database } from "../../db/client";
import type { ProfileRepo } from "../types";

export function createRealProfileRepo({ db }: { db: Database }): ProfileRepo {
  const getProfile = createGetProfile({ db });
  const setProfile = createSetProfile({ db });

  return {
    get: () => getProfile({}),
    set: (input) => setProfile(input)
  };
}
