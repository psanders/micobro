/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * First-sync provisioning. On the first successful Google connect this creates
 * the lender's backup in their own Drive — a `Micobro` folder containing a
 * `Datos` spreadsheet with the tabs push.ts writes to — records its id,
 * and backfills queued local data.
 *
 * Idempotent: a stored sheet id short-circuits; otherwise we look the folder
 * and spreadsheet up by name (the `drive.file` scope keeps app-created files
 * visible across reinstalls) and reuse them rather than duplicating.
 */
import { findDriveFiles, createDriveFile, addSheetTabs, writeHeaderRow } from "./sheetsClient";
import { getSheetId, setSheetId } from "./config";
import { ENTITY_RANGES, pushPendingMutations } from "./push";
import { logger } from "../logger";
import type { Database } from "../db/client";

const FOLDER_NAME = "Micobro";
const SPREADSHEET_NAME = "Datos";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const SPREADSHEET_MIME = "application/vnd.google-apps.spreadsheet";

// Spanish header labels, keyed by entity. Column order and count MUST match the
// corresponding ENTITY_RANGES width and the push.ts row mappers — a test guards
// the width. Money is stored as integer cents (see the "(centavos)" columns).
const TAB_HEADERS: Record<string, string[]> = {
  customer: ["ID", "Nombre", "Teléfono", "Dirección", "Creado", "Actualizado"],
  loan: [
    "ID",
    "Cliente ID",
    "Capital (centavos)",
    "Interés (bps)",
    "Cuotas",
    "Frecuencia",
    "Inicio",
    "Estado",
    "Notas",
    "Creado",
    "Actualizado"
  ],
  payment: ["ID", "Préstamo ID", "Monto (centavos)", "Pagado", "Método", "Notas", "Creado"],
  visit: [
    "ID",
    "Cliente ID",
    "Préstamo ID",
    "Resultado",
    "Fecha promesa",
    "Monto promesa (centavos)",
    "Nota",
    "Creado"
  ],
  cashClose: ["ID", "Monto (centavos)", "Desde", "Cerrado", "Creado"]
};

function tabTitle(range: string): string {
  return range.split("!")[0];
}

async function provisionTabs(spreadsheetId: string): Promise<void> {
  const titles = Object.values(ENTITY_RANGES).map(tabTitle);
  await addSheetTabs(spreadsheetId, titles);
  for (const [entity, range] of Object.entries(ENTITY_RANGES)) {
    await writeHeaderRow(spreadsheetId, `${tabTitle(range)}!A1`, TAB_HEADERS[entity]);
  }
}

/**
 * Ensures the lender's `Micobro/Datos` spreadsheet exists, stores its id, and
 * backfills pending local mutations. Returns the spreadsheet id.
 */
export async function provisionSheet(db: Database): Promise<string> {
  const storedId = await getSheetId();
  if (storedId) {
    logger.info("sheet already provisioned, reusing", { spreadsheetId: storedId });
    return storedId;
  }

  const folders = await findDriveFiles(
    `name = '${FOLDER_NAME}' and mimeType = '${FOLDER_MIME}' and trashed = false`
  );
  const folderId =
    folders[0]?.id ?? (await createDriveFile({ name: FOLDER_NAME, mimeType: FOLDER_MIME }));

  const existingSheets = await findDriveFiles(
    `name = '${SPREADSHEET_NAME}' and mimeType = '${SPREADSHEET_MIME}' and '${folderId}' in parents and trashed = false`
  );
  let spreadsheetId = existingSheets[0]?.id ?? null;

  if (spreadsheetId) {
    logger.info("found existing Datos spreadsheet, reusing", { spreadsheetId });
  } else {
    spreadsheetId = await createDriveFile({
      name: SPREADSHEET_NAME,
      mimeType: SPREADSHEET_MIME,
      parents: [folderId]
    });
    await provisionTabs(spreadsheetId);
    logger.info("provisioned new Datos spreadsheet", { spreadsheetId, folderId });
  }

  await setSheetId(spreadsheetId);
  await pushPendingMutations(db);
  return spreadsheetId;
}
