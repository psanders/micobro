# Proposal

## Why

Owners treat their Google Sheet as a working ledger: they want to fix many
rows at once, add rows, and delete mistakes in bulk, then have the app catch
up. Today the pull only reads `Clientes` and `Préstamos`, and it never
deletes anything. So a bulk clean-up in the Sheet either doesn't reach the
app, or is undone the next time the app pushes.

## What Changes

- Manual sync ("Sincronizar ahora" / "Cerrar día y sincronizar") and the
  automatic sync on app open run in a fixed order: **local backup → push
  every pending change → pull and apply the Sheet**. The push-only sync
  that runs after a local change or on reconnect is unchanged.
- **Conflicts are resolved in favor of the app.** A row with an unpushed
  local change is written to the Sheet as a whole and is not touched by
  that pull. This includes a row edited in the app but deleted in the
  Sheet, which is written back to the Sheet.
- After a clean push, any remaining difference on a row with no pending
  change comes from the Sheet and is applied locally.
- **BREAKING (behavior):** a row the Sheet is known to have held, that is
  missing from a complete read of its tab, is treated as deleted by the
  owner. The app **hard-deletes** it locally and **cascades**: deleting a
  customer removes their loans, payments and visits; deleting a loan
  removes its payments and visits. This replaces the rule "deletion is
  never inferred from absence".
- A sync that would delete more than a threshold (10 rows, or 20% of a tab,
  counting cascaded rows) stops and asks the owner to choose **Aplicar** or
  **Restaurar**. Restaurar writes the rows back to the Sheet.
- `Pagos` and `Visitas` are pulled too (edits, new rows and deletions).
  `Cierres` stays upload-only.
- A tab with a broken row (duplicate ID, a linked ID that doesn't exist, a
  row that can't be parsed) is skipped for that sync, and the owner sees
  which rows to fix. Other tabs still sync.
- Rows the owner adds in the Sheet with an empty ID get an ID from the app,
  which is written back to the Sheet's ID cell.
- Before each manual or automatic sync, the app saves a backup of the local
  database and keeps the last 5. A new **Copias de seguridad** screen lists
  them by date and restores one. Restored rows are queued as pending, so the
  next sync repairs the Sheet instead of deleting them again.
- The ID column and header row of every synced tab get a warning-only
  protection in the Sheet, both at provisioning and on Sheets that already
  exist.

## Capabilities

### New Capabilities

- `sync-backups`: pre-sync local database backups, how many are kept, and
  restoring one from the app.

### Modified Capabilities

- `pull-two-way-sync`: sync order (backup → push → pull), the app wins
  conflicts, deletion detection with cascading hard deletes, the bulk-delete
  confirmation, pulling `Pagos`/`Visitas`, handling broken tabs, and
  assigning IDs to new Sheet rows. Removes "Locally-present rows missing
  remotely are not deleted" and replaces "Malformed pulled rows are skipped,
  not fatal" with tab-level skipping.
- `google-connect`: provisioning (and re-connecting to an existing Sheet)
  adds warning-only protection to the ID column and header row of each
  synced tab.

## Impact

- **Code:** `lib/sync/pull.ts` (deletion detection, new entities,
  validating the whole tab, writing IDs back), `lib/sync/push.ts` (sets the
  per-row `pushedAt` marker), `lib/sync/SyncProvider.tsx` / `syncNow()`
  (backup step, bulk-delete confirmation), `lib/sync/sheetsClient.ts`
  (writes to a single cell, `addProtectedRange` through `batchUpdate`),
  `lib/sync/provisionSheet.ts` (protection), a new backup module,
  `app/sincronizar.tsx` (sync report, confirmation) and a new backups
  screen.
- **Database:** migration adding a nullable `pushed_at` column to
  `customers`, `loans`, `payments` and `visits` (generated with
  `npm run db:generate`).
- **Storage:** up to 5 copies of the database in the app's document
  directory.
- **Data safety:** deletions in the Sheet now permanently delete data on the
  phone. Recovery depends on the pre-sync backups and the bulk-delete
  confirmation.
- **Docs:** the docs-site page about editing the Sheet needs updating
  (deleting rows now syncs, plus the backups screen).
