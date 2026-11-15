/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { z } from "zod/v4";
import { eq } from "drizzle-orm";
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { customerPhotos } from "../db/schema";
import type { Database } from "../db/client";

export interface GetCustomerPhotoDeps {
  db: Database;
}

const getCustomerPhotoSchema = z.object({
  customerId: z.string().min(1, "El id es obligatorio")
});

export type GetCustomerPhotoInput = z.infer<typeof getCustomerPhotoSchema>;

/** The customer's photo (base64 JPEG), or null when it has none. */
export function createGetCustomerPhoto({ db }: GetCustomerPhotoDeps) {
  const fn = async ({ customerId }: GetCustomerPhotoInput): Promise<string | null> => {
    const rows = await db
      .select({ photo: customerPhotos.photo })
      .from(customerPhotos)
      .where(eq(customerPhotos.id, customerId));
    return rows[0]?.photo ?? null;
  };

  return withErrorHandlingAndValidation(fn, getCustomerPhotoSchema);
}
