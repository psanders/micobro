/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * One `Backoffice` per lending business, created on first use: bound to that
 * business's own Fineract tenant and to a store scoped to it. Work for the
 * same business runs one request at a time (`run`), so two devices syncing
 * at once can't interleave changes to the same loan; different businesses
 * run in parallel.
 */
import { Backoffice, type BackofficePolicy } from "./backoffice";

export type BackofficeFactory = (tenantId: string) => Backoffice;

export class TenantRouter {
  private readonly backoffices = new Map<string, Backoffice>();
  private readonly queues = new Map<string, Promise<unknown>>();

  constructor(private readonly create: BackofficeFactory) {}

  get(tenantId: string): Backoffice {
    let backoffice = this.backoffices.get(tenantId);
    if (!backoffice) {
      backoffice = this.create(tenantId);
      this.backoffices.set(tenantId, backoffice);
    }
    return backoffice;
  }

  /** Runs `fn` after every earlier piece of work for this business has finished. */
  run<T>(tenantId: string, fn: (backoffice: Backoffice) => Promise<T>): Promise<T> {
    const previous = this.queues.get(tenantId) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(() => fn(this.get(tenantId)));
    this.queues.set(tenantId, next);
    return next;
  }

  /** The businesses this process has served (for the nightly close). */
  tenants(): string[] {
    return [...this.backoffices.keys()];
  }
}

export type { BackofficePolicy };
