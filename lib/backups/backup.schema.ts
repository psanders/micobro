/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { z } from "zod/v4";

/** How many pre-sync backups stay on the device; the oldest goes first. */
export const MAX_BACKUPS = 5;

export interface Backup {
  /** File name next to the app's database (`micobro-backup-<epoch ms>.db`). */
  name: string;
  createdAt: Date;
  customers: number;
  loans: number;
  payments: number;
}

export const restoreBackupSchema = z.object({
  name: z.string().regex(/^micobro-backup-\d+\.db$/, "Copia de seguridad no válida"),
  pin: z.string().regex(/^\d{4}$/, "El PIN debe tener 4 dígitos")
});

export type RestoreBackupInput = z.infer<typeof restoreBackupSchema>;
