/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */

// Google Apps Script web app that appends a row to the "Micobro — Solicitudes
// de invitación" Sheet. Same integration pattern as QCobro: a plain POST with
// a JSON string body and no content-type header, so the browser never sends a
// CORS preflight. Not a secret — the deployment only accepts a specific shape
// and writes to a single Sheet.
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzD2CavuZHQc1MSZANrPp9n-fgWsdK3wEAU8QIA_lDsmSQmMMlbhTdIuxCpMcPl_X-Y1A/exec";

const DR_AREA_CODES = ["809", "829", "849"];

export function normalizeWhatsapp(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  const tenDigits = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;

  if (tenDigits.length !== 10 || !DR_AREA_CODES.includes(tenDigits.slice(0, 3))) {
    return null;
  }

  return tenDigits;
}

export function formatWhatsapp(tenDigits: string): string {
  return `${tenDigits.slice(0, 3)}-${tenDigits.slice(3, 6)}-${tenDigits.slice(6)}`;
}

export interface InviteRequestPayload {
  nombre: string;
  whatsapp: string;
}

export async function submitInviteRequest({ nombre, whatsapp }: InviteRequestPayload): Promise<void> {
  const payload = {
    nombre: nombre.trim(),
    whatsapp: formatWhatsapp(whatsapp),
    origen: window.location.href,
    user_agent: navigator.userAgent
  };

  await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
