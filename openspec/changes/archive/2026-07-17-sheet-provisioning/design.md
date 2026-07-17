## Context

Auth to Google now works (native `@react-native-google-signin`, see
`lib/sync/googleAuth.ts`), and the push half of sync is built
(`lib/sync/push.ts` replays `pending_mutations` into fixed tab ranges). The gap:
`connect()` stores a session but never creates a spreadsheet — `setSheetId` has
no caller — so `getSheetId()` is always null and `pushPendingMutations` returns
early. This change adds the missing provisioning step so the first connect
produces a target sheet in the lender's own Drive.

Constraints: on-device only, no backend; `drive.file` scope (per-file access to
what the app creates); `sheetsClient.ts` is deliberately plain `fetch` over the
REST APIs, not the Node `googleapis` SDK.

## Goals / Non-Goals

**Goals:**

- First successful connect creates `Micobro/Datos` in the lender's Drive with
  the four correctly-structured tabs, stores its id, and backfills local data.
- Idempotent: never create a duplicate folder or spreadsheet; survive reinstall.
- Failure never blocks the lender or touches local SQLite.

**Non-Goals:**

- Pull / two-way sync and conflict resolution (separate change, `7-pull-two-way-sync`).
- A `Recibos` folder or any non-`Datos` file (the `Micobro` folder just leaves
  room for them later).
- Migrating the existing "update mutations stay queued" limitation in `push.ts`.
- Changing money representation (cents) — see Open Questions.

## Decisions

**1. Create via Drive API, structure via Sheets API.**
The folder and the spreadsheet are created with the **Drive API**
(`files.create`, `mimeType` `application/vnd.google-apps.folder` and
`application/vnd.google-apps.spreadsheet`, `parents:[folderId]`), because the
Sheets API's `spreadsheets.create` cannot place a file in a folder. Tabs and
header rows are then applied with the **Sheets API**
(`spreadsheets.batchUpdate` to add the four sheets and delete the default one,
`spreadsheets.values.update` to write headers). Alternative considered:
`spreadsheets.create` with a full body in one call — rejected, no parent-folder
support.

**2. Resolve order: stored id → find by name → create.**
`provisionSheet` runs:

1. `getSheetId()` → if present, return it (no API calls).
2. Else `files.list` (Drive) for an app-created folder named `Micobro`
   (`mimeType = folder, trashed = false`); create it if absent.
3. `files.list` for an app-created `Datos` spreadsheet with the folder as
   parent; if found, `setSheetId` and return it.
4. Else create `Datos` in the folder, structure its tabs/headers, `setSheetId`.
   `drive.file`'s `files.list` only returns files this app created for this user,
   and that grant persists across reinstalls — so name lookup is a safe dedup key
   without a broader scope.

**3. Header rows are the labels for `push.ts`'s existing column order.**
Each tab's header is a fixed Spanish label row matching the mapper in
`push.ts` one-to-one (source of truth for order):
`Clientes` A:F, `Préstamos` A:K, `Pagos` A:G, `Visitas` A:H. The header text
lives next to the range constants so the two stay visibly coupled; a test
asserts header column count equals each range's width.

**4. New `lib/sync/provisionSheet.ts`; `sheetsClient.ts` grows Drive helpers.**
`sheetsClient.ts` gains `createDriveFile`, `findDriveFiles`, and
`addSheetTabs`/`writeHeaderRow` (all plain `fetch`, reusing `authorizedFetch`).
`provisionSheet(db)` orchestrates the resolve-order above and calls
`pushPendingMutations(db)` at the end. `lib/repo/real/syncRepo.ts` `connect()`
awaits `signInWithGoogle()` then `provisionSheet(db)` before returning status.
The mock repo keeps simulating (`mock-sheet-id`) with no network.

**5. Provisioning is best-effort within connect.**
`setSheetId` is written only after the sheet exists and is structured, so a
mid-way failure leaves no half-registered id; the next connect retries from the
current Drive state (folder may exist, sheet may not — step 3/4 handles it).

## Risks / Trade-offs

- **Partial provisioning** (folder created, then failure before the sheet) →
  the resolve order treats an existing folder + missing sheet as "create sheet
  in folder", so a retry converges instead of duplicating.
- **`files.list` eventual consistency / name collisions** (a lender manually
  makes their own `Micobro` folder) → we scope the query to app-created files
  (`drive.file` already enforces this), so a user's unrelated same-named folder
  is invisible to us; worst case we create our own.
- **Sheets/Drive APIs not enabled or scope not consented** → calls 403. This is
  a deploy prerequisite, not a code path; surfaced as a connect error.
- **Extra latency on first connect** (several sequential API calls) → acceptable,
  one-time; shown behind the existing connecting spinner.

## Migration Plan

Prerequisite (Google Cloud, project `micobro`, one-time): enable **Google Drive
API** and **Google Sheets API**; add the `drive.file` scope to the OAuth consent
screen. No app data migration — `sheetId` storage already exists. Additive and
safe to roll back: if reverted, connect simply stops provisioning (auth still
works), matching today's behavior.

## Open Questions

- Money columns are pushed as integer **cents**; since lenders may edit the
  sheet directly, header labels say "(centavos)". Do we want a pesos
  representation for the human-facing columns later? Out of scope here, but the
  header labels are the natural place to revisit it.
