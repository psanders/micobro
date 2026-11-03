# AGENTS.md

## Overview

Micobro is an offline-first Expo/React Native app (Android and iOS) for independent, informal
lenders (prestamistas) in the Dominican Republic to track customers, loans, payments and
visits. There is no backend: on-device SQLite is the source of truth, synced to a Google
Sheet each lender owns, and editing that Sheet directly (including deleting rows) is a
supported path. The repo also holds the marketing site (`site/`, micobro.app) and the
lender-facing Mintlify docs (`docs-site/`, docs.micobro.app).

## Commands

- Install: `npm ci` (worktrees have no `node_modules`; symlink the main checkout's or install, and don't commit the `package-lock.json` drift `npm install` causes).
- Gate (what CI runs): `npm run lint && npm run typecheck && npm run test && npm run format:check`.
- One test file: `npx jest __tests__/<name>.test.ts`.
- DB migrations: `npm run db:generate` after editing `lib/db/schema.ts`.
- E2E (Maestro CLI on the machine, not an npm dep): `npm run test:e2e`.
- Run: `npm start`; demo data `npm run start:demo`; Storybook `npm run start:storybook:native`.
- Default Verify: `npx jest __tests__/<touched>.test.ts` then the gate. For `designs/`, `docs-site/`, `site/`: `npm run format:check`.

## Conventions

Profile: typescript
Overrides:

- Single package, no `common`: schemas sit beside their function in `lib/<domain>/`; `ValidationError` in `lib/errors/`, `withErrorHandlingAndValidation` in `lib/utils/`. Reference: `lib/customers/createCustomer.ts`.
- drizzle-orm on expo-sqlite, not Prisma: Prisma's engine needs a native binary or WASM, and Hermes runs neither. `lib/db/migrations/` is generated; never hand-edit it.
- Jest (`jest-expo` preset) with `jest.fn()`, not mocha/chai/sinon: RN modules and JSX need its transforms. Tests live in `__tests__/<name>.test.ts`.
- No `.js` extension on relative imports: Metro resolves `.ts`/`.tsx` directly.
- No transport layer (no tRPC, no server).
- Google APIs over plain `fetch` (`lib/sync/sheetsClient.ts`), not the `googleapis` SDK, which assumes Node.
- Logging via `lib/logger.ts`; never add `@fonoster/logger` (winston and fluent-logger are Node-only).
- All user-facing text is hardcoded Spanish; there is no i18n layer, on purpose.
- Commits: Conventional Commits, plus the non-standard types `copy` and `design` (both patch releases). Keep the type list in sync across `commitlint.config.js`, `release.config.js` and the `pr-title` job in `ci.yml`.
- Product behavior lives in OpenSpec (`openspec/specs/`, changes in `openspec/changes/`). Change names must start with a letter: `validate` accepts `107-foo`, but `status` and `archive` reject it. `openspec archive` syncs the specs itself, so don't sync before archiving.

## Areas

| Area label    | Paths                                                                            | Experts                                                    |
| :------------ | :------------------------------------------------------------------------------- | :--------------------------------------------------------- |
| area: app     | app/, components/, .maestro/                                                     | ux-designer, visual-designer                               |
| area: domain  | lib/ (except db, sync), `__tests__/`                                             | qa-engineer                                                |
| area: db      | lib/db/, lib/backups/, drizzle.config.ts                                         | database-engineer                                          |
| area: sync    | lib/sync/                                                                        | security-engineer, database-engineer, performance-engineer |
| area: release | .github/workflows/, release.config.js, eas.json, app.config.ts, store/, patches/ | release-engineer, security-engineer                        |
| area: design  | designs/, assets/, images/                                                       | visual-designer                                            |
| area: site    | site/                                                                            | visual-designer, ux-designer                               |
| area: docs    | docs-site/                                                                       | technical-writer                                           |

## Compatibility

Breaking here means it breaks a lender's existing phone or Sheet:

- SQLite schema: every install upgrades in place via `lib/db/migrations/`, so a migration must carry existing data forward.
- The Google Sheet: tab names (`Clientes`, `Préstamos`, `Pagos`, `Visitas`) and column order (`lib/sync/clientesLayout.ts`, `push.ts`, `pull.ts`). Lenders' existing Sheets and hand edits depend on them.
- App identity: bundle id/package `com.micobro.app` and URL schemes `micobro` / `com.micobro.app` (the Google OAuth redirect depends on them).
- Build-time env vars: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID`, `EXPO_PUBLIC_USE_FAKE_GOOGLE`, `EXPO_PUBLIC_USE_MOCK_REPOS`.
- `.github/ISSUE_TEMPLATE/soporte.yml`: shipped app versions open `issues/new?template=soporte.yml&version=…` (`components/screens/ProfileScreen.tsx`). Its filename and the `version` field id must not change.

## Risk hotspots

- `lib/sync/` (`googleAuth.ts`, `push.ts`, `pull.ts`, `provisionSheet.ts`): auth plus two-way writes to lender data; a bug can delete rows on either side. Several past fix commits.
- `lib/db/schema.ts` and migrations: run on every device's real data, with no server copy.
- `lib/backups/`, `lib/account/eraseDeviceData.ts`: destructive or recovery paths.
- Money math: `lib/loans/loanViews.ts` (6 fix commits), `components/screens/NewLoanFormScreen.tsx` (8), `CollectPaymentScreen.tsx` (5).
- `.github/workflows/release.yml`, `submit.yml`, `release.config.js`, `eas.json`, `app.config.ts`: these cut store builds.

## Release

- PRs are squash-merged, so the PR title is the commit on `main` (the `pr-title` CI job checks it). `main` has no branch protection, so a green CI is the only gate.
- Every push to `main` runs `release.yml`: lint, typecheck, test, then `semantic-release` bumps `package.json`, writes `CHANGELOG.md`, tags `vX.Y.Z` and builds and attaches the Android `.aab`/`.apk` and iOS `.ipa`. `chore(release): … [skip ci]` commits come from it.
- Store submission is manual: `submit.yml` (workflow_dispatch, pick a tag and platform).
- After a PR is confirmed merged (`gh pr list --head <branch> --state merged`; squash merges mean `merge-base` won't show it), delete the branch without asking: remove its worktree first, use `git branch -D`, and delete the remote branch if it still exists. If the branch has commits `origin/main` lacks, push them or ask first.

## Expert notes

### database-engineer

Each phone holds the only primary copy of its data, apart from the lender's Sheet and local backups. Migrations come from `drizzle-kit` and run through `lib/db/migrate.ts` on app start.

### security-engineer

Google auth is native Google Sign-In (`@react-native-google-signin/google-signin`) with the Web client ID. The browser `expo-auth-session` flow was dropped because Google rejects it for Android OAuth clients (see the header of `lib/sync/googleAuth.ts`). No service-account secret ships in the app; `google-service-account.json` is only for `eas submit`.

### ux-designer

The users are Dominican lenders; all copy is Spanish and must match the on-screen labels exactly. Onboarding is PIN-first, and Google is an optional backup, never a login wall.

### visual-designer

Designs are Pencil files in `designs/`: `micobro.lib.pen` holds the shared library (refs `ui:<id>`, variables `$ui:<name>`); `app.pen`, `website.pen`, `ads.pen`, `ops.pen` and `exports.pen` import it. Reusable components and variables live only in the lib. The `.pen` screens lag shipped code, so check labels against `components/`.

### technical-writer

`docs-site/AGENTS.md` sets the docs editorial policy: Spanish, written for lenders only, no implementation details. Pages are authored with `/ps:docs`.

### qa-engineer

E2E flows (Maestro, `.maestro/`) aren't part of the required CI gate; `e2e.yml` runs only part of them. A local `expo run:android` replaces the EAS-signed emulator build and wipes its SQLite data, so back it up first.

## Decisions

- 2026-08-05: Any user-facing UI change (app or site) gets a Pencil design approved by Pedro before code or a PR. Exceptions are only by his explicit call, and they're logged as Pencil debt.
- 2026-10-27: Two-way sync: manual and auto-sync run backup → push → pull; Sheet edits and deletes sync back; the app wins conflicts.
