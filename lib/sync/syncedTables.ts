/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * The entities that sync both ways with the Sheet (pulled back as well as
 * pushed), mapped to their local tables. `cashClose` is push-only by design
 * (see the "Cash closes are upload-only" requirement) and has no `pushedAt`.
 */
import { customers, loans, payments, visits } from "../db/schema";

export const PULLED_ENTITIES = ["customer", "loan", "payment", "visit"] as const;
export type PulledEntity = (typeof PULLED_ENTITIES)[number];

export const PULLED_TABLES = {
  customer: customers,
  loan: loans,
  payment: payments,
  visit: visits
} as const;

export function isPulledEntity(entity: string): entity is PulledEntity {
  return (PULLED_ENTITIES as readonly string[]).includes(entity);
}
