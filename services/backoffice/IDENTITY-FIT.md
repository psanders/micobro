# Fonoster Identity for the Micobro back office — fit report

Status: study only, 2026-11-03. Read from `~/Projects/fonoster`
(`mods/identity`, `openspec/specs/identity/spec.md`, `@fonoster/identity`
0.47.1). Nothing was run.

## What we need

- A **tenant is a lending business** (decided 2026-11-03). It has an owner,
  maybe managers, and collectors, each on their own phone.
- A lender connects the app to the back office with a token. From then on,
  every sync carries proof of **who** (user), **which business** (tenant)
  and **which device**.
- Collectors work offline for days and sync when they get a signal.
- The back office checks all of this on each request without calling
  Identity every time.

## What fits as is

| Need                                  | Fonoster Identity                                                                                          |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Tenant = lending business             | A **workspace**. A user can belong to several.                                                             |
| Owner / manager / collector           | Workspace roles `WORKSPACE_OWNER`, `WORKSPACE_ADMIN`, `WORKSPACE_MEMBER`.                                  |
| Add a collector                       | **Workspace invites** (expiring invite token by email; the invitee sets a password or uses an email code). |
| Tenant in the token                   | The access token carries `accessKeyId` and `access: [{ accessKeyId, role }]`, one per workspace.           |
| Check tokens without calling Identity | RS256 signatures; the public key comes from `GetPublicKey`, so the BFF verifies tokens offline.            |
| Long sessions, safe sign-out          | Refresh-token rotation with reuse detection; `RevokeToken`.                                                |
| Machine access (e.g. Mikro's systems) | Workspace **API keys**, exchangeable for tokens, owner/admin only.                                         |
| Run it alone                          | `fonoster-identity` runs standalone (own Postgres, `identity.json`), no telephony.                         |

## Gaps

**1. Sign-in by phone.** Identity requires a unique email for every user, and
its only passwordless sign-in is an email code. Many collectors in the DR
have no email they use, but all have a phone and WhatsApp. Identity already
stores and verifies phone numbers (SMS through Twilio), but nothing signs in
with them. _Needs an Identity change:_ a `phone_code` sign-in method (SMS,
ideally WhatsApp), and email optional when a verified phone is present.

**2. The app can't speak Identity's protocol.** Identity is gRPC. The React
Native app can't use `@grpc/grpc-js`, and this repo's convention is plain
`fetch`. _Proposal:_ the BFF exposes a small REST façade (`/v1/auth/...`)
and calls Identity over gRPC from Node. The app only ever talks to the BFF.

**3. Offline collectors and refresh rotation.** The access token is short;
the refresh token can be set long (it's configurable). But reuse detection
revokes the whole session when a refresh token is used again more than 30
seconds after its first use. On a weak signal, the app can send a refresh,
lose the response, and retry minutes later. That logs the collector out in
the field, with unsynced cobros on the phone. _Needs:_ a configurable reuse
grace, and an app that stores the new token before retrying. Unsynced cobros
must survive a forced sign-in.

**4. The "connect with a token" flow.** The literal token-for-a-lender is
closest to a workspace invite: the owner invites, and the collector accepts
in the app. The other candidate, a workspace API key per device, loses
_who_ did a cobro (the key is the subject, not a person). _Proposal:_
invites for people, plus a **device registration** in the BFF (device id
bound to user and workspace), so the existing `deviceId` in the contract
becomes verified rather than self-declared.

**5. Permissions inside a business.** Identity's roles are lists of
Identity's own gRPC methods. The BFF's actions (create a loan, waive mora,
close the caja) aren't among them. _Proposal:_ the BFF maps the token's
workspace role to its own permissions, e.g. a collector can collect and log
visits, an admin can also waive mora and correct loans. Identity stays the
source of who has which role.

**6. Not needed:** workspace regions, GitHub sign-in, MFA (later, for
owners).

## Recommendation

Use Fonoster Identity, standalone, behind the BFF. It already covers
tenants, roles, invites, verifiable tokens and API keys. Gaps 1 and 3 need
changes in Identity itself, which suits a product you own. Gaps 2, 4 and 5
are BFF work.

**Decision (2026-11-03): one Fineract tenant, with its own database, per
lending business.** The Identity workspace maps 1:1 to a Fineract tenant.
The BFF reads the workspace from the token and sends Fineract the matching
`Fineract-Platform-TenantId`, so one business's data never shares a database
with another's. What this brings:

- Onboarding a business provisions a Fineract tenant
  (`fineract/provision-tenant.sh`, verified live): create its database,
  register it in Fineract's tenant registry, restart Fineract. On startup
  Fineract creates the tenant's tables. The BFF then sets up the catalog on
  first use (products, mora charges, payment types, the grace setting).
  - Fineract has **no API to create tenants**; the registry is written
    directly.
  - A tenant added while Fineract runs **isn't usable until a restart**.
    Another instance can create its tables, but the running one still
    fails with "Rounding mode is not initialized for tenant". Locally that
    means about 30 s of downtime per new business. In production, run two
    or more Fineract instances and restart them one at a time.
  - The full live suite (43 tests) passes on a freshly provisioned tenant,
    and a client created in one tenant isn't visible from another.
- The nightly close runs per tenant.
- Every business costs a database, so backups, migrations on Fineract
  upgrades, and monitoring are per tenant too.
