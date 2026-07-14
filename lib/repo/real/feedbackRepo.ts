/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Stubbed pending a per-lender GitHub auth decision — see the
 * `feedback-report` capability's design notes. Never embed a shared
 * GitHub token here: this app ships to many lenders' phones and a PAT
 * baked into the APK would be extractable and abusable against the
 * target repo.
 */
import type { FeedbackRepo } from "../types";

export function createRealFeedbackRepo(): FeedbackRepo {
  return {
    submit: async () => ({ ok: true })
  };
}
