/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * The back office's HTTP surface (contract v1):
 *
 *   GET  /health
 *   POST /v1/connect      connection token → device credential
 *   POST /v1/sync         Bearer device credential; a contract v1 batch
 *   POST /v1/disconnect   Bearer device credential; revokes it
 *
 * The business is always the credential's, never anything in a body. Bad
 * tokens and bad credentials get one indistinguishable 401.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "http";
import {
  bearerCredential,
  connectRequest,
  CONTRACT_VERSION,
  syncRequest,
  type HttpError
} from "@micobro/contract";
import type { CredentialStore } from "./credentials";
import type { TenantRouter } from "./tenants";
import { logger } from "./log";

const MAX_BODY_BYTES = 2 * 1024 * 1024;

export interface HttpOptions {
  credentials: CredentialStore;
  router: TenantRouter;
  /** Connect attempts allowed per client IP per minute. */
  connectPerMinute?: number;
  now?: () => number;
}

class HttpFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: HttpError["error"]["code"],
    message: string
  ) {
    super(message);
  }
}

const UNAUTHENTICATED = new HttpFailure(401, "UNAUTHENTICATED", "Not authenticated");

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new HttpFailure(413, "VALIDATION", "Body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
      } catch {
        reject(new HttpFailure(400, "VALIDATION", "Body is not JSON"));
      }
    });
    req.on("error", reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(json)
  });
  res.end(json);
}

/** A sliding one-minute window per key. */
function rateLimiter(perMinute: number, now: () => number) {
  const hits = new Map<string, number[]>();
  return (key: string) => {
    const t = now();
    const recent = (hits.get(key) ?? []).filter((h) => t - h < 60_000);
    recent.push(t);
    hits.set(key, recent);
    return recent.length <= perMinute;
  };
}

export function createBackofficeServer(options: HttpOptions): Server {
  const { credentials, router } = options;
  const allowConnect = rateLimiter(options.connectPerMinute ?? 10, options.now ?? Date.now);

  async function authenticated(req: IncomingMessage) {
    const credential = bearerCredential(req.headers.authorization);
    const device = credential ? await credentials.authenticate(credential) : null;
    if (!credential || !device) throw UNAUTHENTICATED;
    return { credential, device };
  }

  async function route(req: IncomingMessage, res: ServerResponse) {
    const path = (req.url ?? "/").split("?")[0];
    if (req.method === "GET" && path === "/health") return send(res, 200, { ok: true });
    if (req.method !== "POST") throw new HttpFailure(404, "VALIDATION", "Not found");

    if (path === "/v1/connect") {
      const ip = req.socket.remoteAddress ?? "unknown";
      if (!allowConnect(ip)) throw new HttpFailure(429, "RATE_LIMITED", "Too many attempts");
      const parsed = connectRequest.safeParse(await readJson(req));
      // A malformed token is just another bad token.
      if (!parsed.success) {
        if (parsed.error.issues.some((i) => i.path[0] === "connectionToken")) throw UNAUTHENTICATED;
        throw new HttpFailure(400, "VALIDATION", "Invalid connect request");
      }
      const connected = await credentials.connect({
        token: parsed.data.connectionToken,
        deviceId: parsed.data.deviceId,
        deviceName: parsed.data.deviceName
      });
      if (!connected) throw UNAUTHENTICATED;
      logger.info("device connected", {
        tenantId: connected.tenantId,
        deviceId: parsed.data.deviceId
      });
      return send(res, 200, {
        contractVersion: CONTRACT_VERSION,
        deviceCredential: connected.credential,
        tenantId: connected.tenantId,
        businessName: connected.businessName
      });
    }

    if (path === "/v1/sync") {
      const { device } = await authenticated(req);
      const parsed = syncRequest.safeParse(await readJson(req));
      if (!parsed.success) throw new HttpFailure(400, "VALIDATION", "Invalid sync batch");
      if (parsed.data.deviceId !== device.deviceId) {
        throw new HttpFailure(403, "FORBIDDEN", "Batch deviceId does not match this device");
      }
      const response = await router.run(device.tenantId, (backoffice) =>
        backoffice.handleSync(parsed.data)
      );
      return send(res, 200, response);
    }

    if (path === "/v1/disconnect") {
      const { credential, device } = await authenticated(req);
      await credentials.revokeCredential(credential);
      logger.info("device disconnected", { tenantId: device.tenantId, deviceId: device.deviceId });
      return send(res, 200, { contractVersion: CONTRACT_VERSION, revoked: true });
    }

    throw new HttpFailure(404, "VALIDATION", "Not found");
  }

  return createServer((req, res) => {
    route(req, res).catch((error: unknown) => {
      if (error instanceof HttpFailure) {
        return send(res, error.status, { error: { code: error.code, message: error.message } });
      }
      logger.error("request failed", { url: req.url, error: String(error) });
      send(res, 503, { error: { code: "UNAVAILABLE", message: "Back office unavailable, retry" } });
    });
  });
}
