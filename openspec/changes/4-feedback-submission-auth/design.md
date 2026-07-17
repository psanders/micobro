# Design: 4-feedback-submission-auth

## Context

### What a submission actually is

`lib/feedback/finishFeedbackRecording.ts` turns a
`ScreenRecordingFile` (from `react-native-nitro-screen-recorder`) into the
only payload the repo seam knows about:

```ts
// lib/repo/types.ts
export interface FeedbackSubmission {
  videoUri: string;
  title: string;
}

export interface FeedbackRepo {
  submit(input: FeedbackSubmission): Promise<{ ok: true }>;
}
```

`videoUri` is a local file path (`file.path` off the recorder, an on-device
MP4 from Android's `MediaProjection`); `title` is currently a hardcoded
`"Feedback de la app"` (no title-entry UI exists yet — that's a follow-up
concern, not this one). There is no transcript, no structured metadata, no
server-side enrichment — `profile-tools-screens`' design.md is explicit that
mikro's Deepgram-transcription/LLM-structuring pipeline was dropped, not
ported. So the auth question is narrowly: **how does an MP4 file plus a
short string get from the lender's phone to somewhere Pedro can review it,
without a shippable secret.**

`FeedbackContext.tsx` calls `feedbackRepo.submit(...)` from a `processing`
stage and moves to `result` on success or `error` (with retry) on rejection
— see `lib/feedback/FeedbackContext.tsx:48-61`. Today `submit()` in both
`lib/repo/mock/feedbackRepo.ts` and `lib/repo/real/feedbackRepo.ts` resolves
immediately with `{ ok: true }` and does nothing else — no network call, no
persistence, no retry semantics to design around yet. Whatever this change
recommends has to fill in a `submit()` that:

1. does not need a shippable long-lived secret,
2. actually gets the video and title in front of a human (Pedro) to triage,
3. behaves sanely offline (the app is offline-first; a lender recording
   feedback in a customer's home with no signal is a real path — the
   existing `pending_mutations` queue in `lib/db/schema.ts:15-25` is the
   established pattern here, replayed by `lib/sync/push.ts`), and
4. doesn't ask an informal DR lender to create an account with a service
   they have no other reason to use.

### What auth the app already has

`lib/sync/googleAuth.ts` already does per-lender Google Sign-In: PKCE
(`exchangeCodeForTokens`), no client secret shipped (`getGoogleClientId()`
reads a public OAuth client ID from `app.config.ts` `extra`), tokens cached
in `expo-secure-store`, silently refreshed by `getValidAccessToken()`. The
scope requested is deliberately narrow:

```ts
const SHEETS_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const googleAuthScopes = [SHEETS_SCOPE, "profile"];
```

`drive.file` grants the app access only to Drive files _it_ creates (or
that the user explicitly opens with a picker) — not the lender's whole
Drive. `lib/sync/sheetsClient.ts` is a thin `fetch` wrapper over Sheets API
v4 (`appendRow`, `readRange`); `lib/sync/push.ts` replays queued
`pending_mutations` rows through it. Per `openspec/specs/google-connect/spec.md`,
connecting is optional, offered once after PIN setup, and backs up to "a
Google Sheet they own" — note `setSheetId()` (`lib/sync/config.ts`) isn't
called from any screen yet in this codebase snapshot, so the
create-or-associate-a-sheet step of onboarding is itself not fully wired;
that's an existing gap outside this issue's scope, but it means "the app
already creates a Drive file for a lender under `drive.file`" is the
_intended_ shape, not yet a proven one.

Critically: **connecting Google sync is optional.** A lender can use
micobro fully offline, never sign in, and still want to send feedback. Any
approach that requires the _existing_ Google sign-in as a precondition for
feedback submission either (a) forces sign-in at the moment of feedback —
new friction unrelated to backup — or (b) fails closed for a lender who
skipped it. This constrains every option below.

## Goals / Non-Goals

**Goals:**

- Land on one auth/delivery approach for `FeedbackRepo.submit()`'s real
  implementation, justified against the same axes for every option:
  developer-review ergonomics, security, infra cost/maintenance,
  offline-first fit, lender UX friction.
- Produce a recommendation concrete enough that a follow-up change can
  implement it without re-litigating the tradeoffs.

**Non-Goals:**

- No code changes. `feedbackRepo.ts` stays a stub until the owner signs
  off on an option here.
- No transcription/LLM structuring — out of scope per
  `profile-tools-screens`' design.md and not reconsidered here.
- No title-entry UI — `title` stays a hardcoded string until a separate
  change adds that (noted in the implementation sketch as a nice-to-have,
  not blocking).

## Options considered

### Option 1 — GitHub OAuth device flow (per lender)

Each lender authorizes their own GitHub account via the [device
authorization
grant](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow)
(no client secret needed client-side, same reason PKCE works for Google
here); the app then files an issue on `github.com/psanders/micobro` as
that lender's account, attaching or linking the video.

- **Developer-review ergonomics:** Good if it works — a real GitHub issue,
  in the real repo, with the app's existing issue-triage workflow (this
  very issue #4 lives there). No new inbox to check.
- **Security:** Sound in principle — no shared secret, device flow is a
  standard OAuth pattern. But it grants issue-creation-in-a-repo-you-don't-own
  scope to a stranger's GitHub account, which normally requires the
  repo owner to have granted access, or the flow targets an app-owned
  proxy anyway (see Option 2's overlap below) — GitHub doesn't let an
  arbitrary authenticated user file issues against a repo they have no
  access to via a "create issue" OAuth scope; `public_repo`/`repo` scope
  from a lender's _own_ token only lets them file issues on repos _they_
  can already see and where issue creation is open (public repos accept
  issues from any authenticated GitHub user, so this technically works
  _if_ the repo stays public — but that's an accident of GitHub's public-repo
  model, not a designed permission boundary, and breaks the moment the repo
  goes private).
- **Infra cost/maintenance:** None — no server. A GitHub OAuth App
  registration (free, one-time).
- **Offline-first fit:** Poor. Device flow needs the lender to visit
  `github.com/login/device` on _another_ screen/device and type a code —
  not something that can be queued and silently retried like
  `pending_mutations`. It's inherently a foreground, online, multi-step
  human action, mid-feedback-flow.
- **Lender UX friction:** Very high, and this is the disqualifying flaw
  the issue itself calls out: these are informal Dominican lenders using
  this app to track loans on paper-replacement software. They are not
  developers. Asking someone to create a GitHub account, understand device
  codes, and authorize an OAuth app mid-way through "let me show you this
  bug" is a UX non-starter — it will suppress feedback submissions, not
  enable them.
- **Verdict: reject.** Wrong audience for GitHub-account friction, and the
  permission model doesn't actually give a stranger's token clean
  issue-filing rights against a repo they don't own without the repo
  being public and staying that way.

### Option 2 — Small proxy service holding a GitHub token server-side

App POSTs `{ videoUri (uploaded bytes), title }` to a minimal endpoint (say,
a Cloudflare Worker or a tiny Node/Fastify service) that holds one
repo-scoped GitHub PAT and files the issue (Octokit), attaching the video
(as a release asset, a gist, or a link to wherever it uploaded the video
first, since GitHub issues can't hold large binary attachments directly
without going through GitHub's own upload flow).

- **Developer-review ergonomics:** Excellent — same as Option 1's outcome
  (a real GitHub issue) without the auth problem, since the proxy holds
  the real credential.
  - **Security:** This is the right shape for hiding a secret — but it
    reintroduces exactly the thing `CLAUDE.md`'s repo description says this
    app deliberately doesn't have: _"no backend server; local SQLite is the
    source of truth on-device."_ Now there's a server holding a
    repo-write-scoped PAT, reachable from any lender's phone — an
    unauthenticated (or weakly authenticated) public endpoint that can file
    GitHub issues is itself an abuse surface (spam, large-file DoS,
    someone scripting arbitrary issue bodies against the target repo). It
    would need its own auth (API key per install? shipped in the APK —
    same extractability problem the PAT had, just one layer removed) or
    rate-limiting/attestation (Play Integrity API) to not just move the
    vulnerability rather than close it.
- **Infra cost/maintenance:** This is the real cost of this option — a
  service to provision, deploy, monitor, patch, and pay for (even
  serverless has cold-start/quota/billing surface), for a single-purpose
  low-volume endpoint (occasional bug reports from a handful of lenders).
  Disproportionate to the problem for a one-developer, no-backend app.
- **Offline-first fit:** Fine — an HTTP POST queued like any other
  network call, retried by the same `pending_mutations`-style mechanism
  this app already has for Sheets pushes.
- **Lender UX friction:** None — invisible to the lender, same as today's
  stub.
- **Verdict: viable, but disproportionate.** Technically the cleanest
  path to "real GitHub issue," at the cost of standing up and running
  the one thing this whole app is architected to avoid. Worth keeping in
  mind if issue-filing ergonomics later prove essential, but not the
  first move.

### Option 3 — Reuse the existing Google auth (Drive upload + Sheet log) — **recommended**

Upload the recorded video straight to Google Drive using the _same_
per-lender OAuth token `googleAuth.ts` already manages, and log a row (one
line: lender, device/app version, timestamp, Drive file link, title) to a
`Feedback` tab so Pedro has a single place to see what came in.

Two sub-shapes, both compatible with `drive.file`:

**3a — lender's own Drive, shared-to-Pedro folder.** The app creates (or
reuses) a folder named e.g. `Micobro feedback` in _the lender's own Drive_
via the Drive API `files.create` (a file the app itself creates, so
`drive.file` covers it with zero extra scope), uploads the MP4 into it, and
— this is the part that needs a decision — either (i) the app also calls
`files.permissions.create` to share that specific file/folder with a
Pedro-controlled email, which needs the broader `drive` scope or at least
`drive.file`'s permission-management sibling and Pedro's email baked in as
a config constant (not a secret, but a piece of PII/config to manage), or
(ii) nothing is auto-shared and Pedro has no way to see it without asking
each lender — defeating the point.

**3b — a Pedro-owned Drive folder, lender uploads directly into it (recommended
sub-shape).** Pre-provision one Drive folder Pedro owns
(`Micobro feedback/`), and share it with **"anyone with the link can
upload"** or, more precisely, use a Drive API pattern where the folder's
sharing is `writer` access granted broadly (or, better: use a lightweight
per-file `files.create` call from the lender's own OAuth token targeting
that folder as `parents: [folderId]` — this requires the folder owner
(Pedro) to have granted `writer` permission on the folder to a very broad
principal, since arbitrary lenders' tokens are all different Google
accounts). This is the cleanest version of "no new auth system": the
lender's _existing_ `drive.file`-scoped access token (already sitting in
`expo-secure-store`, already refreshed by `getValidAccessToken()`) is
reused as-is — `drive.file` explicitly permits creating a new file inside
a folder the app didn't create _if_ that folder was shared with the
signed-in user with edit access, or more simply the API is called with the
folder ID as parent and the user has at least `writer` on that folder.
Concretely:

```ts
// lib/sync/driveClient.ts (new, sibling to sheetsClient.ts)
const DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3/files";

export async function uploadFeedbackVideo(
  localUri: string,
  fileName: string,
  parentFolderId: string
): Promise<{ fileId: string; webViewLink: string }> {
  // multipart upload: metadata (name, parents: [parentFolderId]) + media bytes,
  // authorizedFetch()-style Bearer token from getValidAccessToken(), same
  // pattern as sheetsClient.ts's authorizedFetch — plain fetch, no SDK.
}
```

and then a row appended to a `Feedback!A:E` range (lender name from
`ProfileRepo.get()`, app version, timestamp, `title`, `webViewLink`) via
the _existing_ `appendRow()` — either into the lender's own sync sheet (if
connected) or, cleaner for triage, into **one spreadsheet Pedro owns**
alongside the `Micobro feedback/` folder, so all lenders' submissions land
in one sheet Pedro already has open, not scattered across N per-lender
sheets he'd have to individually check.

- **Developer-review ergonomics:** Good — Pedro gets one Drive folder of
  videos and one spreadsheet of metadata, both native Google UI he
  already lives in for sync debugging. Not as workflow-integrated as a
  GitHub issue (no labels, no "close" state, no linking to this repo's
  issue tracker directly) — a submission is a spreadsheet row someone has
  to manually triage into a GitHub issue if it warrants one. That manual
  step is the honest cost of this option; noted, not hidden.
- **Security:** No new secret anywhere — reuses the token machinery that
  already exists and is already reviewed (`googleAuth.ts`). The one thing
  to get right: the Pedro-owned target folder/sheet must not be so openly
  writable that it becomes a spam sink for anyone who reverse-engineers
  the (public, non-secret) folder ID — but that's a Drive sharing setting
  Pedro controls and can revoke/rotate any time, categorically different
  from an unrevokable PAT baked into shipped APKs. Worth scoping the
  shared folder to require Google sign-in (not "anyone with the link" in
  the fully public sense) so at minimum a submission is tied to a real
  Google account, same trust level the app already puts in Sheets sync.
- **Infra cost/maintenance:** Zero new infra. No server, no new service
  to run — this is the strongest point in its favor relative to Option 2,
  and the reason it fits `CLAUDE.md`'s "no backend server" framing
  exactly.
- **Offline-first fit:** Good, with one addition needed: today's
  `pending_mutations` queue (`lib/db/schema.ts:15-25`, replayed by
  `lib/sync/push.ts`) only handles small JSON row payloads
  (`ENTITY_RANGES` currently maps only `"customer"` — see
  `lib/sync/push.ts:17-19`); it was never designed to hold a multi-MB
  video file reference across app restarts. A feedback-specific queue (or
  extending `pending_mutations` with an `entity: "feedback"` case whose
  payload is `{ videoUri, title, createdAt }`, uploaded on next
  `pushPendingMutations`-style pass when connectivity + a valid Google
  token are available) covers the "recorded with no signal" case cleanly
  and reuses an established pattern rather than inventing a new one.
- **Lender UX friction:** The catch — **this option is only frictionless
  for a lender who already connected Google sync.** Per
  `openspec/specs/google-connect/spec.md`, connecting is optional and
  skippable, so a lender who skipped it (or disconnected) has no valid
  `getValidAccessToken()` result and `uploadFeedbackVideo` would fail the
  same way `sheetsClient.ts`'s `authorizedFetch` already fails today
  ("Not signed in to Google..."). The submit flow needs a defined
  fallback for that case — see recommendation below — rather than
  silently erroring, which would violate the existing `feedback-report`
  spec's "Failed submission" scenario in a confusing way (the lender
  didn't do anything wrong; they just never connected sync).
- **Verdict: recommended**, conditional on explicitly handling the
  not-connected case (see below) rather than treating Google auth as a
  silent hard requirement.

### Option 4 — Google Apps Script webhook bound to a Pedro-owned sheet

A Google Apps Script deployed as a public web app (`doPost`), bound to a
spreadsheet Pedro owns, running under _Pedro's_ Google identity (Apps
Script executes as the deploying account, not the caller) — the lender's
app POSTs `{ videoBase64 or a pre-uploaded Drive link, title }` to the
script's URL with no Google auth needed client-side at all (Apps Script
web apps can be deployed "Anyone" access, authenticated by nothing but the
URL).

- **Developer-review ergonomics:** Same as Option 3 — one sheet, plus
  whatever the script does with the video (append to a Drive folder it
  also owns).
- **Security:** This is the most exposed option of the four: the webhook
  URL, once known (URLs like this are easy to find by decompiling the
  APK, same extractability problem as a PAT, just for a URL instead of a
  token — and a leaked Apps Script web-app URL bound to "Anyone" access is
  just as abusable as a leaked token, since anyone can POST arbitrary
  garbage to it forever with no rate limit unless hand-rolled inside the
  script). It sidesteps "no secret in the APK" by not needing a secret at
  all, at the cost of an unauthenticated public write endpoint — arguably
  worse than Option 2's proxy, since Apps Script has weaker
  operational tooling (no real rate limiting, quota errors are opaque,
  logs are minimal) for detecting/stopping abuse.
- **Infra cost/maintenance:** Free and requires no server _process_ to
  run, which is its appeal — but "maintenance" here means babysitting
  Apps Script's quirky quota limits (Apps Script has daily execution-time
  and URL-fetch quotas that are easy to hit and non-obvious to diagnose)
  and its auth model, which doesn't compose with the per-lender identity
  the rest of this app is built around — every submission looks identical
  (Pedro's own script identity), so there's no per-lender attribution
  without the client adding it manually to the POST body (spoofable,
  unlike Option 3 where the request is authenticated as a real signed-in
  Google account).
- **Offline-first fit:** Same as Option 2 — a queueable POST.
- **Lender UX friction:** Best of all four — no auth requirement of any
  kind on the lender's side, works even if they never connected Google
  sync.
- **Verdict: rejected but noted.** The friction-free lender UX is
  genuinely attractive (it's the only option unconstrained by
  google-connect being optional), but the unauthenticated-public-endpoint
  security posture is a worse tradeoff than Option 3's "requires prior
  Google sign-in" gap, and it introduces an identity model (Pedro's Apps
  Script identity) that doesn't reuse anything already reviewed in this
  codebase. If Option 3's not-connected-lender gap proves unacceptable in
  practice, this is the fallback worth revisiting — not GitHub OAuth
  device flow or a real server.

## Options comparison

|                                                        | Dev-review ergonomics                                            | Security (no shippable secret)                                                                 | Infra cost                                                               | Offline-first fit                           | Lender UX friction                                             |
| ------------------------------------------------------ | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------- | -------------------------------------------------------------- |
| 1. GitHub OAuth device flow                            | Good (real issue) if it worked                                   | Fails — no clean cross-account issue-file permission model                                     | None                                                                     | Poor — needs a live foreground human step   | Very high — GitHub account unfamiliar to target users          |
| 2. Proxy service + PAT                                 | Excellent (real issue)                                           | Sound in principle, but shifts the abuse surface to a new public endpoint needing its own auth | High — a server to run, forever, for this app's one no-backend exception | Good — queueable POST                       | None                                                           |
| 3. Reuse Google auth (Drive + Sheet) — **recommended** | Good (one folder + one sheet, manual GitHub triage if warranted) | Strong — zero new secrets, reuses reviewed token machinery                                     | None                                                                     | Good, needs a feedback-specific queue entry | None _if_ Google-connected; needs a defined fallback otherwise |
| 4. Apps Script webhook                                 | Good (one folder + one sheet)                                    | Weak — unauthenticated public endpoint, URL itself is a de facto secret once extracted         | None (but real Apps Script quota/ops burden)                             | Good — queueable POST                       | Best — no auth needed at all                                   |

## Recommendation

**Option 3 — reuse the existing Google auth**, uploading the video to a
Pedro-owned Drive folder and logging a row to a Pedro-owned "Feedback"
spreadsheet, both via the token machinery `lib/sync/googleAuth.ts` and
`lib/sync/sheetsClient.ts` already implement and this codebase already
trusts.

Rationale, in order of weight:

1. It is the only option that adds **zero new auth systems** — no OAuth
   App registration for GitHub, no server holding a PAT, no public
   webhook URL to protect. Every other option either recreates the "no
   backend server" architecture this app explicitly avoids (Option 2), is
   an outright security downgrade (Option 4's unauthenticated endpoint),
   or doesn't actually work for the target users (Option 1).
2. It fits this app's existing trust model exactly: a feedback submission
   is authenticated the same way a Sheets sync push already is — a real,
   signed-in Google account, PKCE-issued, least-privilege `drive.file`
   scope, no client secret. Nothing new to audit.
3. The one real gap — a lender who skipped Google connect has no token to
   upload with — is a **known, boundable** problem, not an open one: it
   should surface as a distinct, honest state (not the generic
   `SUBMIT_ERROR` in `FeedbackContext.tsx`), e.g. prompting the lender to
   connect Google first, or (cheaper to ship first) simply queuing the
   submission in `pending_mutations`-style storage until a Google
   connection exists, same as any other queued write. This is a UX
   decision for the follow-up implementation change, not a blocker to
   choosing this approach.

If, after shipping, Option 3's "must be Google-connected" gap turns out to
block a meaningful fraction of real feedback attempts, Option 4 (Apps
Script, no auth required) is the documented fallback — not Option 1 or 2.

## Implementation sketch (for the follow-up change, not this one)

- `lib/sync/driveClient.ts` (new) — `uploadFeedbackVideo(localUri, fileName,
parentFolderId)`, multipart upload via plain `fetch` against
  `https://www.googleapis.com/upload/drive/v3/files`, mirroring
  `sheetsClient.ts`'s `authorizedFetch` pattern (same `getValidAccessToken()`
  call, same error-on-`!response.ok` shape).
- Config: a `feedbackFolderId` (Drive folder ID) and `feedbackSheetId`
  (spreadsheet ID) constant, both Pedro-owned, added the same way
  `getGoogleClientId()` reads `EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID` from
  `app.config.ts` `extra` — non-secret IDs, safe to ship, since the
  security boundary is Drive's sharing permissions, not the ID's secrecy.
- `lib/repo/real/feedbackRepo.ts` — `submit()` calls
  `getValidAccessToken()` first; if null, either queues (preferred) or
  returns a distinct "not connected" outcome the `FeedbackContext`/
  `FeedbackStatusModal` can render as its own copy rather than the generic
  Spanish error; if present, uploads via `uploadFeedbackVideo` then
  `appendRow(feedbackSheetId, "Feedback!A:E", [lenderName, appVersion,
new Date().toISOString(), title, webViewLink])`.
- Offline queuing: extend `lib/db/schema.ts`'s `pendingMutations` usage
  with `entity: "feedback"` (payload `{ videoUri, title }`), or a
  dedicated `feedback_queue` table if video-file lifecycle (the local MP4
  must not be deleted until upload confirms) doesn't fit the generic
  JSON-payload shape `pending_mutations` uses today — needs a small design
  decision in the follow-up change, not resolved here.
- No changes needed to `googleAuth.ts`'s scopes — `drive.file` already
  covers "create a file in a folder I have writer access to."
- Spec impact (for the follow-up change): updates `feedback-report`'s
  "Submission is stubbed pending an auth decision" requirement to describe
  the real Drive/Sheet delivery and the not-connected fallback state. As of
  this doc, that capability spec lives only in the still-open
  `openspec/changes/profile-tools-screens/specs/feedback-report/spec.md`
  (not yet synced to `openspec/specs/`) — the follow-up change should edit
  whichever copy is authoritative by the time it lands.
