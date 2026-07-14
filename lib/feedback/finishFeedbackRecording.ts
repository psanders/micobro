/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Pure step between "the recorder produced a file" and "hand it to
 * FeedbackRepo.submit" — mirrors mikro's finishFeedbackRecording.ts shape
 * (a testable function with no native calls), simplified because the
 * stubbed submit() takes a file path + title rather than a base64 upload
 * payload.
 */
import type { ScreenRecordingFile } from "react-native-nitro-screen-recorder";
import type { FeedbackSubmission } from "../repo/types";

export function finishFeedbackRecording(file: ScreenRecordingFile | undefined): FeedbackSubmission {
  if (!file?.path) {
    throw new Error("No hay una grabación para enviar");
  }
  return { videoUri: file.path, title: "Feedback de la app" };
}
