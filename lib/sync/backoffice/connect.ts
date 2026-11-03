/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Connecting this device to a lending business's back office, and
 * disconnecting it. Connecting trades the one-time token for a device
 * credential, keeps it in secure storage, and queues the initial upload;
 * from then on push goes to the back office (see `./push.ts`).
 */
import { normalizeConnectionToken } from "@micobro/contract";
import { createQueueSnapshot } from "./snapshot";
import { BackofficeError, type BackofficeClient } from "./client";
import type { BackofficeConnection } from "./connection";
import type { Database } from "../../db/client";
import { logger } from "../../logger";

export interface ConnectResult {
  businessName: string;
  /** Changes queued for the initial upload. */
  queued: number;
}

export function createConnectBackoffice(deps: {
  db: Database;
  client: BackofficeClient;
  connection: BackofficeConnection;
  now?: () => Date;
}) {
  const { db, client, connection } = deps;
  const queueSnapshot = createQueueSnapshot({ db });

  return async function connectBackoffice(input: {
    token: string;
    deviceName?: string;
  }): Promise<ConnectResult> {
    if (await connection.isActive()) {
      throw new BackofficeError(
        "forbidden",
        "Este teléfono ya está conectado. Desconéctalo primero."
      );
    }
    // Same answer as the server's for anything that can't be a token.
    if (!normalizeConnectionToken(input.token)) throw new BackofficeError("unauthenticated");
    const response = await client.connect({
      connectionToken: input.token,
      deviceId: await connection.deviceId(),
      deviceName: input.deviceName
    });
    await connection.save(
      {
        tenantId: response.tenantId,
        businessName: response.businessName,
        connectedAt: (deps.now ?? (() => new Date()))().toISOString()
      },
      response.deviceCredential
    );
    const queued = await queueSnapshot();
    logger.info("connected to back office", { tenantId: response.tenantId, queued });
    return { businessName: response.businessName, queued };
  };
}

export function createDisconnectBackoffice(deps: {
  client: BackofficeClient;
  connection: BackofficeConnection;
}) {
  const { client, connection } = deps;
  /** Revokes the credential on the server when it can be reached; always forgets it here. */
  return async function disconnectBackoffice(): Promise<{ revokedOnServer: boolean }> {
    const credential = await connection.credential();
    let revokedOnServer = false;
    if (credential) {
      try {
        await client.disconnect(credential);
        revokedOnServer = true;
      } catch (error) {
        // Offline, or already revoked: the device forgets it either way.
        logger.warn("back office disconnect not confirmed", { error: String(error) });
      }
    }
    await connection.clear();
    return { revokedOnServer };
  };
}
