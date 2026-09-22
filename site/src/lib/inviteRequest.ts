/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { parsePhoneNumberFromString } from "libphonenumber-js";

// Google Apps Script web app that appends a row to the "Micobro — Solicitudes
// de invitación" Sheet. Same integration pattern as QCobro: a plain POST with
// a JSON string body and no content-type header, so the browser never sends a
// CORS preflight. Not a secret — the deployment only accepts a specific shape
// and writes to a single Sheet.
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzD2CavuZHQc1MSZANrPp9n-fgWsdK3wEAU8QIA_lDsmSQmMMlbhTdIuxCpMcPl_X-Y1A/exec";

// People type their WhatsApp however they think of it — 8291111111,
// 829-111-1111, (849) 111 1111, +1 829 111 1111. Parse instead of pattern
// matching: the country default makes a bare local number resolve to the
// Dominican Republic, while a number written with its own country code is
// honoured as typed, so someone abroad can still ask for an invitation.
const DEFAULT_COUNTRY = "DO";

/** The typed number as E.164 (+18291111111), or null when it isn't a real number. */
export function normalizeWhatsapp(raw: string): string | null {
  const phone = parsePhoneNumberFromString(raw, DEFAULT_COUNTRY);

  return phone?.isValid() ? phone.number : null;
}

export interface InviteRequestPayload {
  nombre: string;
  whatsapp: string;
}

export async function submitInviteRequest({
  nombre,
  whatsapp
}: InviteRequestPayload): Promise<void> {
  const payload = {
    nombre: nombre.trim(),
    whatsapp,
    origen: window.location.href,
    user_agent: navigator.userAgent
  };

  // Apps Script answers /exec with a 302 to script.googleusercontent.com, and
  // that redirect target sends no CORS headers — so a normal fetch runs the
  // script (the row is written) and then rejects on the redirect, which the
  // caller reads as failure. "no-cors" keeps this a simple request, still
  // delivers the POST, and resolves with an opaque response instead of
  // throwing. The response was never read anyway.
  await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify(payload)
  });
}
