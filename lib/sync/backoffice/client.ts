/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * The app's client for the back office's HTTP surface (contract v1), over
 * plain `fetch`. Every failure becomes a `BackofficeError` with a kind the
 * sync code acts on and a Spanish message the lender can be shown.
 */
import {
  CONTRACT_VERSION,
  connectResponse,
  disconnectResponse,
  syncResponse,
  type ConnectResponse,
  type SyncRequest,
  type SyncResponse
} from "@micobro/contract";

export type BackofficeErrorKind =
  | "unauthenticated" // bad token, or this device's credential was revoked
  | "forbidden"
  | "invalid"
  | "rate_limited"
  | "unavailable" // the back office answered 5xx or something unexpected
  | "offline"; // no answer at all

const MESSAGES: Record<BackofficeErrorKind, string> = {
  unauthenticated: "El código no es válido o ya venció. Pide uno nuevo a tu financiera.",
  forbidden: "El back office no permite esta operación desde este teléfono.",
  invalid: "El back office no entendió la solicitud. Actualiza la aplicación.",
  rate_limited: "Demasiados intentos. Espera un minuto y vuelve a intentar.",
  unavailable: "El back office no está disponible ahora. Se reintentará más tarde.",
  offline: "No hay conexión a internet. Se enviará cuando vuelva la señal."
};

export class BackofficeError extends Error {
  constructor(
    readonly kind: BackofficeErrorKind,
    message = MESSAGES[kind]
  ) {
    super(message);
    this.name = "BackofficeError";
  }
}

export interface BackofficeClient {
  connect(input: {
    connectionToken: string;
    deviceId: string;
    deviceName?: string;
  }): Promise<ConnectResponse>;
  sync(credential: string, batch: SyncRequest): Promise<SyncResponse>;
  disconnect(credential: string): Promise<void>;
}

export function createBackofficeClient(deps: {
  baseUrl: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}): BackofficeClient {
  const doFetch = deps.fetch ?? fetch;
  const base = deps.baseUrl.replace(/\/$/, "");

  async function post(path: string, body: unknown, credential?: string): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? 30_000);
    let response: Response;
    try {
      response = await doFetch(`${base}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(credential ? { Authorization: `Bearer ${credential}` } : {})
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
    } catch {
      throw new BackofficeError("offline");
    } finally {
      clearTimeout(timer);
    }
    if (response.status === 401) throw new BackofficeError("unauthenticated");
    if (response.status === 403) throw new BackofficeError("forbidden");
    if (response.status === 429) throw new BackofficeError("rate_limited");
    if (response.status === 400 || response.status === 413) throw new BackofficeError("invalid");
    if (!response.ok) throw new BackofficeError("unavailable");
    try {
      return await response.json();
    } catch {
      throw new BackofficeError("unavailable");
    }
  }

  function parse<T>(
    schema: { safeParse(v: unknown): { success: boolean; data?: T } },
    value: unknown
  ): T {
    const parsed = schema.safeParse(value);
    if (!parsed.success) throw new BackofficeError("unavailable");
    return parsed.data as T;
  }

  return {
    async connect(input) {
      return parse(
        connectResponse,
        await post("/v1/connect", { contractVersion: CONTRACT_VERSION, ...input })
      );
    },
    async sync(credential, batch) {
      return parse(syncResponse, await post("/v1/sync", batch, credential));
    },
    async disconnect(credential) {
      parse(disconnectResponse, await post("/v1/disconnect", {}, credential));
    }
  };
}
