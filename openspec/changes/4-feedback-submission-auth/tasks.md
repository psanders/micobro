# Tasks: 4-feedback-submission-auth

> These tasks describe the follow-up implementation change for the
> **recommended** option (Option 3, `design.md`) — reusing the app's
> existing Google auth to upload feedback video + log a row. **None of
> these tasks are started or authorized by this PR.** Do not begin work on
> them until the owner has reviewed `design.md` and either approved Option
> 3 or picked a different option (in which case this file should be
> revised or replaced before implementation starts).

## 0. Owner decision (blocking everything below)

- [ ] 0.1 Owner reviews `design.md`'s four options and comparison table
- [ ] 0.2 Owner approves Option 3 (or names a different approach) and
      confirms: (a) a Drive folder + Sheet Pedro owns can be provisioned,
      (b) the not-connected-lender fallback behavior (queue vs. prompt to
      connect) they want

## 1. Config & Drive client

- [ ] 1.1 Provision a Pedro-owned Drive folder and a "Feedback" spreadsheet
      (or a `Feedback` tab in an existing Pedro-owned sheet); share the
      folder with `writer` access scoped to signed-in Google accounts (not
      fully public)
- [ ] 1.2 Add `feedbackFolderId` / `feedbackSheetId` config (non-secret
      IDs) via `app.config.ts` `extra`, read the same way
      `getGoogleClientId()` reads `EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID`
- [ ] 1.3 `lib/sync/driveClient.ts` — `uploadFeedbackVideo(localUri,
fileName, parentFolderId)`, multipart upload via `fetch` against the
      Drive v3 upload endpoint, mirroring `sheetsClient.ts`'s
      `authorizedFetch` pattern (reuses `getValidAccessToken()`); unit test
      with a stubbed `fetch`

## 2. Repo seam

- [ ] 2.1 Decide and implement the not-connected fallback in
      `lib/repo/real/feedbackRepo.ts`'s `submit()`: either queue (extend
      `pending_mutations` with `entity: "feedback"`, or a dedicated
      `feedback_queue` table if the local-file-lifecycle needs don't fit
      the generic JSON-payload shape) or a distinct "connect Google first"
      outcome surfaced through `FeedbackContext`
- [ ] 2.2 `submit()` (connected path): `uploadFeedbackVideo(...)` then
      `appendRow(feedbackSheetId, "Feedback!A:E", [lenderName, appVersion,
timestamp, title, webViewLink])`, reusing `ProfileRepo.get()` for
      the lender name
- [ ] 2.3 If queuing was chosen in 2.1, wire a `pushPendingMutations`-style
      replay path (or extend the existing one) so queued feedback uploads
      once a valid Google token + connectivity are available
- [ ] 2.4 Jest tests: `feedbackRepo.submit()` happy path (stubbed
      `driveClient`/`sheetsClient`), not-connected path, queue-and-replay
      path if applicable

## 3. UX for the not-connected case

- [ ] 3.1 If the fallback is "prompt to connect": new copy/state in
      `FeedbackStatusModal` distinct from the generic `SUBMIT_ERROR`,
      since this isn't a submission failure — the lender did nothing wrong
- [ ] 3.2 If the fallback is "queue silently": confirm the "sent"
      confirmation screen's copy still makes sense for a queued-not-yet-
      uploaded submission (may need its own "guardado, se enviará cuando
      haya conexión" variant)

## 4. Spec & gates

- [ ] 4.1 Update the `feedback-report` capability spec (wherever it's
      authoritative by then — `openspec/specs/feedback-report/spec.md` if
      `profile-tools-screens` has archived, or its still-open change
      folder otherwise) to replace "Submission is stubbed pending an auth
      decision" with the real Drive/Sheet delivery requirement and the
      not-connected scenario
- [ ] 4.2 lint/typecheck/test green; `openspec validate` on the follow-up
      change
- [ ] 4.3 On-device walk (real repos, dev-client build): record → stop →
      confirm the video lands in the Drive folder and a row appears in the
      Feedback sheet; repeat with Google sync disconnected to confirm the
      fallback path
