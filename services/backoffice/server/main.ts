/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * The back office's entry point and admin commands:
 *
 *   npm run backoffice -- serve                         HTTP server + nightly closes
 *   npm run backoffice -- register-tenant <id> "<name>"  serve a provisioned Fineract tenant
 *   npm run backoffice -- issue-token <tenant> [days]    a one-time connection token
 *   npm run backoffice -- revoke-device <device-id>      stop a device from syncing
 *   npm run backoffice -- close-day <tenant> [date]      run a nightly close now
 *
 * Configuration (environment; defaults fit backoffice/fineract/compose.yaml):
 *   BACKOFFICE_DATABASE_URL, BACKOFFICE_PORT (8090), BACKOFFICE_GRACE_DAYS (0),
 *   FINERACT_URL, FINERACT_USERNAME, FINERACT_PASSWORD
 */
import { Pool } from "pg";
import { Backoffice } from "./backoffice";
import { PostgresCredentialStore, UnknownTenantError } from "./credentials";
import { createBackofficeServer } from "./http";
import { logger } from "./log";
import { ensureTenant, migrate, PostgresStore } from "./postgresStore";
import { businessClock, closeDue } from "./schedule";
import { TenantRouter } from "./tenants";
import { HttpFineract } from "../fineract/httpFineract";

const env = {
  databaseUrl:
    process.env.BACKOFFICE_DATABASE_URL ??
    "postgres://fineract:fineract@localhost:5433/micobro_backoffice",
  port: Number(process.env.BACKOFFICE_PORT ?? 8090),
  graceDays: Number(process.env.BACKOFFICE_GRACE_DAYS ?? 0),
  fineractUrl: process.env.FINERACT_URL ?? "http://localhost:8088/fineract-provider/api/v1",
  fineractUser: process.env.FINERACT_USERNAME ?? "mifos",
  fineractPassword: process.env.FINERACT_PASSWORD ?? "password"
};

const CLOSE_CHECK_MS = 5 * 60 * 1000;

function fineractFor(tenantId: string) {
  return new HttpFineract({
    baseUrl: env.fineractUrl,
    tenantId,
    username: env.fineractUser,
    password: env.fineractPassword
  });
}

function routerFor(pool: Pool) {
  return new TenantRouter(
    (tenantId) =>
      new Backoffice(fineractFor(tenantId), new PostgresStore(pool, tenantId), {
        graceDays: env.graceDays
      })
  );
}

async function registeredTenants(pool: Pool): Promise<string[]> {
  const { rows } = await pool.query<{ id: string }>("SELECT id FROM tenants ORDER BY id");
  return rows.map((r) => r.id);
}

/** Runs every business's nightly close that is due. */
async function runDueCloses(pool: Pool, router: TenantRouter, now = new Date()) {
  for (const tenantId of await registeredTenants(pool)) {
    const lastClosed = await new PostgresStore(pool, tenantId).getLastClosed();
    const due = closeDue(lastClosed, now);
    if (!due) continue;
    try {
      await router.run(tenantId, (backoffice) => backoffice.closeDay(due));
      logger.info("nightly close done", { tenantId, date: due });
    } catch (error) {
      logger.error("nightly close failed", { tenantId, date: due, error: String(error) });
    }
  }
}

async function serve(pool: Pool) {
  const router = routerFor(pool);
  const server = createBackofficeServer({ credentials: new PostgresCredentialStore(pool), router });
  server.listen(env.port, () => logger.info("back office listening", { port: env.port }));
  const tick = () =>
    runDueCloses(pool, router).catch((e) =>
      logger.error("close check failed", { error: String(e) })
    );
  void tick();
  const timer = setInterval(tick, CLOSE_CHECK_MS);
  const stop = () => {
    clearInterval(timer);
    server.close(() => void pool.end().then(() => process.exit(0)));
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

async function main(argv: string[]) {
  const [command, ...args] = argv;
  const pool = new Pool({ connectionString: env.databaseUrl });
  await migrate(pool);

  switch (command) {
    case "serve":
      return serve(pool);

    case "register-tenant": {
      const [id, name] = args;
      if (!id || !name) throw new Error('usage: register-tenant <id> "<business name>"');
      // The Fineract tenant must already exist (backoffice:provision).
      await fineractFor(id).request("GET", "/offices");
      await ensureTenant(pool, id, name);
      console.log(`✓ ${name} (${id}) registered`);
      break;
    }

    case "issue-token": {
      const [tenantId, days] = args;
      if (!tenantId) throw new Error("usage: issue-token <tenant> [days]");
      const issued = await new PostgresCredentialStore(pool).issueToken(
        tenantId,
        new Date(),
        days ? Number(days) : undefined
      );
      console.log(`Connection token for ${tenantId}: ${issued.token}`);
      console.log(
        `Valid once, until ${issued.expiresAt.toISOString()}. It is not stored: copy it now.`
      );
      break;
    }

    case "revoke-device": {
      const [id] = args;
      if (!id) throw new Error("usage: revoke-device <device-id>");
      const revoked = await new PostgresCredentialStore(pool).revokeDevice(id);
      console.log(revoked ? `✓ device ${id} revoked` : `no active device ${id}`);
      break;
    }

    case "close-day": {
      const [tenantId, date] = args;
      if (!tenantId) throw new Error("usage: close-day <tenant> [YYYY-MM-DD]");
      const day = date ?? businessClock(new Date()).date;
      await routerFor(pool).run(tenantId, (backoffice) => backoffice.closeDay(day));
      console.log(`✓ ${tenantId} closed for ${day}`);
      break;
    }

    default:
      throw new Error(
        "commands: serve | register-tenant <id> <name> | issue-token <tenant> [days] | revoke-device <id> | close-day <tenant> [date]"
      );
  }
  await pool.end();
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(
    error instanceof UnknownTenantError || error instanceof Error ? error.message : error
  );
  process.exit(1);
});
