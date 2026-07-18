/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Translates any error surfaced along the Google Drive connection path —
 * native sign-in failures, an expired/revoked token, a Sheets/Drive REST
 * call rejecting, or a plain offline fetch — into one Spanish, lender-facing
 * message. Without this, SyncProvider's Alert and ConnectGoogleScreen's
 * inline error show the raw err.message, which is English, technical, and
 * sometimes a raw HTTP response body (see sheetsClient.ts).
 */
import { isErrorWithCode, statusCodes } from "./googleAuth";

const GOOGLE_SIGN_IN_MESSAGES: Record<string, string> = {
  [statusCodes.SIGN_IN_CANCELLED]: "Conexión con Google cancelada.",
  [statusCodes.IN_PROGRESS]:
    "Ya hay una conexión con Google en curso. Espera un momento e inténtalo de nuevo.",
  [statusCodes.PLAY_SERVICES_NOT_AVAILABLE]:
    "Este dispositivo necesita actualizar Google Play Services para conectar con Google.",
  [statusCodes.SIGN_IN_REQUIRED]: "Tu sesión de Google expiró. Vuelve a conectar tu cuenta."
};

function httpStatusMessage(status: number): string | null {
  if (status === 401 || status === 403) {
    return "Tu acceso a Google Drive expiró o fue revocado. Vuelve a conectar tu cuenta.";
  }
  if (status === 404) {
    return "No encontramos tu Hoja de Cálculo en Google Drive. Puede que la hayas movido o eliminado.";
  }
  if (status === 429) {
    return "Google está limitando las solicitudes en este momento. Inténtalo de nuevo en unos minutos.";
  }
  if (status >= 500) {
    return "Google Drive no está disponible en este momento. Inténtalo de nuevo más tarde.";
  }
  return null;
}

export function friendlySyncErrorMessage(err: unknown): string {
  if (isErrorWithCode(err) && GOOGLE_SIGN_IN_MESSAGES[err.code]) {
    return GOOGLE_SIGN_IN_MESSAGES[err.code]!;
  }

  const message = err instanceof Error ? err.message : String(err);

  if (/network request failed/i.test(message) || /failed to fetch/i.test(message)) {
    return "Sin conexión a internet. Verifica tu conexión y vuelve a intentarlo.";
  }

  if (/not signed in to google/i.test(message)) {
    return "Tu sesión de Google expiró. Vuelve a conectar tu cuenta.";
  }

  const statusMatch = message.match(/\((\d{3})\)/);
  if (statusMatch) {
    const friendly = httpStatusMessage(Number(statusMatch[1]));
    if (friendly) return friendly;
  }

  return "No se pudo conectar con Google Drive. Inténtalo de nuevo más tarde.";
}
