/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: feedback-report — a discarded/failed recording never reaches
 * FeedbackRepo.submit (no file → throws before any submission happens).
 */
import { finishFeedbackRecording } from "../lib/feedback/finishFeedbackRecording";
import type { ScreenRecordingFile } from "react-native-nitro-screen-recorder";

const file: ScreenRecordingFile = {
  path: "/data/user/0/com.micobro.app/files/feedback.mp4",
  name: "feedback.mp4",
  size: 1024,
  duration: 12.5,
  enabledMicrophone: true
};

describe("finishFeedbackRecording", () => {
  it("packages a completed recording into a submission", () => {
    const submission = finishFeedbackRecording(file);
    expect(submission).toEqual({ videoUri: file.path, title: "Feedback de la app" });
  });

  it("throws when there is no recording file", () => {
    expect(() => finishFeedbackRecording(undefined)).toThrow("No hay una grabación para enviar");
  });

  it("throws when the file has no path", () => {
    expect(() => finishFeedbackRecording({ ...file, path: "" })).toThrow();
  });
});
