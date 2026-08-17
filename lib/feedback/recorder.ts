/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Platform-branching wrapper around react-native-nitro-screen-recorder's two
 * incompatible recording APIs (global vs. in-app — see FeedbackContext.tsx's
 * header comment for why each platform uses the one it does). Pulled out
 * into plain functions, rather than inlined in the context, so the branch is
 * testable without rendering a component tree — this repo has no React
 * Native Testing Library precedent (issue #120).
 */
import { Platform } from "react-native";
import {
  startGlobalRecording,
  stopGlobalRecording,
  startInAppRecording,
  stopInAppRecording,
  cancelInAppRecording
} from "react-native-nitro-screen-recorder";
import type { ScreenRecordingFile } from "react-native-nitro-screen-recorder";

/** Grace window to catch an immediate `onRecordingError` before declaring
 * Android's fire-and-forget `startGlobalRecording` "started". iOS's
 * `startInAppRecording` returns a real promise, so it needs no equivalent. */
const START_GRACE_MS = 300;

export function startFeedbackRecording(): Promise<void> {
  if (Platform.OS === "ios") {
    return startInAppRecording({
      options: { enableMic: true, enableCamera: false },
      onRecordingFinished: () => {}
    });
  }
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    startGlobalRecording({
      options: { enableMic: true },
      onRecordingError: (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      }
    });
    setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve();
    }, START_GRACE_MS);
  });
}

export function stopFeedbackRecording(): Promise<ScreenRecordingFile | undefined> {
  return Platform.OS === "ios" ? stopInAppRecording() : stopGlobalRecording();
}

export function discardFeedbackRecording(): Promise<void> {
  return Platform.OS === "ios"
    ? cancelInAppRecording()
    : stopGlobalRecording().then(() => undefined);
}
