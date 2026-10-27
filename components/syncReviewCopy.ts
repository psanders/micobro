/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spanish copy for the sync review cards (held Sheet deletions, broken tabs)
 * and the backup list. lib/sync stays UI-agnostic; the words live here.
 */
import { formatFullDate, formatTime } from "../lib/utils/dates";
import type { DeletionCounts, TabProblem } from "../lib/sync/pullPlan";
import type { PulledEntity } from "../lib/sync/syncedTables";
import type { Backup } from "../lib/backups";

export const TAB_NAMES: Record<PulledEntity, string> = {
  customer: "Clientes",
  loan: "Préstamos",
  payment: "Pagos",
  visit: "Visitas"
};

const NOUNS: Record<PulledEntity, [string, string]> = {
  customer: ["cliente", "clientes"],
  loan: ["préstamo", "préstamos"],
  payment: ["pago", "pagos"],
  visit: ["visita", "visitas"]
};

export function countLabel(entity: PulledEntity, n: number): string {
  const [one, many] = NOUNS[entity];
  return `${n} ${n === 1 ? one : many}`;
}

/** ["4 clientes", "4 préstamos", "1 pago"] — tables with nothing to delete are left out. */
export function deletionLines(counts: DeletionCounts): string[] {
  return (Object.keys(NOUNS) as PulledEntity[])
    .filter((entity) => counts.byEntity[entity] > 0)
    .map((entity) => countLabel(entity, counts.byEntity[entity]));
}

/** "Pagos · fila 3: el ID se repite (también en la fila 2)" */
export function problemLine(problem: TabProblem): string {
  return `${TAB_NAMES[problem.entity]} · fila ${problem.sheetRow}: ${problem.reason}`;
}

/** "27/10/2026 · 10:42 a. m." */
export function backupTitle(backup: Backup): string {
  return `${formatFullDate(backup.createdAt)} · ${formatTime(backup.createdAt)}`;
}

/** "24 clientes · 31 préstamos · 412 pagos" */
export function backupSummary(backup: Backup): string {
  return [
    countLabel("customer", backup.customers),
    countLabel("loan", backup.loans),
    countLabel("payment", backup.payments)
  ].join(" · ");
}
