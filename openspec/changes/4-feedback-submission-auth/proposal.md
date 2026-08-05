# Proposal: 4-feedback-submission-auth

> **Status: decision doc, pending owner sign-off.** This change proposes an
> approach and a rough sketch; it does not implement anything.
> `lib/repo/real/feedbackRepo.ts` stays a no-op until the recommendation below
> (or a different option) is explicitly approved and a follow-up change is
> shipped against it.

## Why

`lib/repo/real/feedbackRepo.ts` has been a deliberate stub since
`profile-tools-screens` shipped the full recording UX (`lib/feedback/`,
`FeedbackConsentScreen`, `RecordingPill`, `FeedbackStatusModal`,
`FeedbackContext`'s `idle → recording → processing → result/error` state
machine). Recorded feedback videos are captured on-device and then thrown
away — `submit()` always returns `{ ok: true }` without transmitting
anything. The blocker was never the UI; it's that the sibling app `mikro`
files feedback as a GitHub issue via a server-side PAT (Octokit), and
micobro has no server. A shared GitHub token baked into the APK would be
extractable (any lender, or anyone with the APK, can pull secrets from a
built RN bundle) and abusable against `github.com/psanders/micobro`
(spam issues, or worse, scoped write access to the repo). GitHub issue #4
tracks resolving this.

## What Changes

This change is **documentation only**: `design.md` works through four
candidate auth/delivery approaches — GitHub OAuth device flow, a small
proxy service, reusing the app's existing Google Sign-In to land videos in
Drive, and a Google Apps Script webhook bound to the lender's own sheet —
scored against developer-review ergonomics, security (no shippable
secrets), infra cost/maintenance, offline-first fit, and lender UX
friction. It recommends **reusing the existing Google auth**: upload the
recorded video to a Pedy-owned Drive folder using the per-lender Google
token the app already holds for Sheets sync, and log a row (lender name,
device/app version, timestamp, Drive file link) to a `Feedback` tab in
each lender's own spreadsheet (or a folder-level manifest — see
`design.md`) so Pedro has one place to triage new submissions.

No code changes ship in this PR. A follow-up implementation change
(`lib/repo/real/feedbackRepo.ts`, a new `lib/feedback/uploadFeedback.ts`,
possibly a `feedback-report` scope addition to `googleAuth.ts`) is scoped
in `tasks.md` for whichever approach the owner signs off on.

## Capabilities

No capability specs change. `feedback-report`'s existing requirement
("Submission is stubbed pending an auth decision") — currently living in
the still-open `openspec/changes/profile-tools-screens/specs/feedback-report/spec.md`,
not yet synced to `openspec/specs/` — remains accurate until a follow-up
change implements the chosen approach and updates that spec.

## Impact

- None to shipped code. `openspec/changes/4-feedback-submission-auth/design.md`
  is the deliverable — an options analysis and recommendation for the
  owner to approve or override before any implementation work starts.
