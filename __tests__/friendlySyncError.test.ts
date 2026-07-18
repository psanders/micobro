/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: friendly Google Drive connection errors — every error surfaced along
 * the connect/sync path (native sign-in, network, Sheets/Drive REST) maps to
 * a Spanish, lender-facing message instead of a raw technical one.
 */
jest.mock("../lib/sync/googleAuth", () => ({
  isErrorWithCode: (err: unknown): err is { code: string } =>
    typeof err === "object" && err !== null && "code" in err,
  statusCodes: {
    SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED",
    IN_PROGRESS: "IN_PROGRESS",
    PLAY_SERVICES_NOT_AVAILABLE: "PLAY_SERVICES_NOT_AVAILABLE",
    SIGN_IN_REQUIRED: "SIGN_IN_REQUIRED"
  }
}));

import { friendlySyncErrorMessage } from "../lib/sync/friendlySyncError";

describe("friendlySyncErrorMessage", () => {
  it("translates a cancelled Google sign-in", () => {
    const err = Object.assign(new Error("native cancel"), { code: "SIGN_IN_CANCELLED" });
    expect(friendlySyncErrorMessage(err)).toBe("Conexión con Google cancelada.");
  });

  it("translates outdated/missing Play Services", () => {
    const err = Object.assign(new Error("x"), { code: "PLAY_SERVICES_NOT_AVAILABLE" });
    expect(friendlySyncErrorMessage(err)).toContain("Google Play Services");
  });

  it("translates a sign-in already in progress", () => {
    const err = Object.assign(new Error("x"), { code: "IN_PROGRESS" });
    expect(friendlySyncErrorMessage(err)).toBe(
      "Ya hay una conexión con Google en curso. Espera un momento e inténtalo de nuevo."
    );
  });

  it("translates a plain network failure", () => {
    expect(friendlySyncErrorMessage(new Error("Network request failed"))).toBe(
      "Sin conexión a internet. Verifica tu conexión y vuelve a intentarlo."
    );
  });

  it("translates a missing/expired Google session", () => {
    expect(
      friendlySyncErrorMessage(
        new Error("Not signed in to Google. Call the sign-in flow before syncing.")
      )
    ).toBe("Tu sesión de Google expiró. Vuelve a conectar tu cuenta.");
  });

  it.each([
    [401, "Tu acceso a Google Drive expiró o fue revocado. Vuelve a conectar tu cuenta."],
    [403, "Tu acceso a Google Drive expiró o fue revocado. Vuelve a conectar tu cuenta."],
    [
      404,
      "No encontramos tu Hoja de Cálculo en Google Drive. Puede que la hayas movido o eliminado."
    ],
    [
      429,
      "Google está limitando las solicitudes en este momento. Inténtalo de nuevo en unos minutos."
    ],
    [500, "Google Drive no está disponible en este momento. Inténtalo de nuevo más tarde."],
    [503, "Google Drive no está disponible en este momento. Inténtalo de nuevo más tarde."]
  ])("maps a Sheets/Drive HTTP %i failure to a friendly message", (status, expected) => {
    expect(
      friendlySyncErrorMessage(new Error(`Sheets append failed (${status}): {"error":"..."}`))
    ).toBe(expected);
  });

  it("falls back to a generic friendly message for unrecognized errors", () => {
    expect(friendlySyncErrorMessage(new Error("some obscure internal error"))).toBe(
      "No se pudo conectar con Google Drive. Inténtalo de nuevo más tarde."
    );
  });

  it("handles non-Error thrown values", () => {
    expect(friendlySyncErrorMessage("Network request failed")).toBe(
      "Sin conexión a internet. Verifica tu conexión y vuelve a intentarlo."
    );
  });
});
