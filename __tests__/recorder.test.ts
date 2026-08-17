/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: feedback-report — recording overlay. Covers the platform branch
 * pulled out of FeedbackContext.tsx into lib/feedback/recorder.ts
 * specifically so it's testable without rendering a component tree (this
 * repo has no React Native Testing Library precedent, see issue #120).
 */
import { Platform } from "react-native";
import * as nitroScreenRecorder from "react-native-nitro-screen-recorder";
import type { ScreenRecordingFile } from "react-native-nitro-screen-recorder";
import {
  startFeedbackRecording,
  stopFeedbackRecording,
  discardFeedbackRecording
} from "../lib/feedback/recorder";

jest.mock("react-native-nitro-screen-recorder", () => ({
  startGlobalRecording: jest.fn(),
  stopGlobalRecording: jest.fn(),
  startInAppRecording: jest.fn(),
  stopInAppRecording: jest.fn(),
  cancelInAppRecording: jest.fn()
}));

const file: ScreenRecordingFile = {
  path: "/tmp/feedback.mp4",
  name: "feedback.mp4",
  size: 1024,
  duration: 12.5,
  enabledMicrophone: true
};

function setPlatform(os: "ios" | "android") {
  Object.defineProperty(Platform, "OS", { get: () => os, configurable: true });
}

describe("recorder", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("startFeedbackRecording", () => {
    it("on iOS, calls startInAppRecording with mic on and camera off", async () => {
      setPlatform("ios");
      jest.mocked(nitroScreenRecorder.startInAppRecording).mockResolvedValue(undefined);

      await startFeedbackRecording();

      expect(nitroScreenRecorder.startInAppRecording).toHaveBeenCalledWith(
        expect.objectContaining({ options: { enableMic: true, enableCamera: false } })
      );
      expect(nitroScreenRecorder.startGlobalRecording).not.toHaveBeenCalled();
    });

    it("on iOS, rejects when startInAppRecording rejects", async () => {
      setPlatform("ios");
      jest.mocked(nitroScreenRecorder.startInAppRecording).mockRejectedValue(new Error("denied"));

      await expect(startFeedbackRecording()).rejects.toThrow("denied");
    });

    it("on Android, calls startGlobalRecording and resolves after the grace window", async () => {
      setPlatform("android");
      jest.mocked(nitroScreenRecorder.startGlobalRecording).mockImplementation(() => {});

      await expect(startFeedbackRecording()).resolves.toBeUndefined();

      expect(nitroScreenRecorder.startGlobalRecording).toHaveBeenCalledWith(
        expect.objectContaining({ options: { enableMic: true } })
      );
      expect(nitroScreenRecorder.startInAppRecording).not.toHaveBeenCalled();
    });

    it("on Android, rejects when onRecordingError fires within the grace window", async () => {
      setPlatform("android");
      jest.mocked(nitroScreenRecorder.startGlobalRecording).mockImplementation((input) => {
        input.onRecordingError(new Error("mic denied") as never);
      });

      await expect(startFeedbackRecording()).rejects.toThrow("mic denied");
    });
  });

  describe("stopFeedbackRecording", () => {
    it("on iOS, delegates to stopInAppRecording", async () => {
      setPlatform("ios");
      jest.mocked(nitroScreenRecorder.stopInAppRecording).mockResolvedValue(file);

      await expect(stopFeedbackRecording()).resolves.toBe(file);
      expect(nitroScreenRecorder.stopGlobalRecording).not.toHaveBeenCalled();
    });

    it("on Android, delegates to stopGlobalRecording", async () => {
      setPlatform("android");
      jest.mocked(nitroScreenRecorder.stopGlobalRecording).mockResolvedValue(file);

      await expect(stopFeedbackRecording()).resolves.toBe(file);
      expect(nitroScreenRecorder.stopInAppRecording).not.toHaveBeenCalled();
    });
  });

  describe("discardFeedbackRecording", () => {
    it("on iOS, cancels without producing a file (cancelInAppRecording, not stop)", async () => {
      setPlatform("ios");
      jest.mocked(nitroScreenRecorder.cancelInAppRecording).mockResolvedValue(undefined);

      await discardFeedbackRecording();

      expect(nitroScreenRecorder.cancelInAppRecording).toHaveBeenCalled();
      expect(nitroScreenRecorder.stopGlobalRecording).not.toHaveBeenCalled();
    });

    it("on Android, stops the global recording (no separate cancel API)", async () => {
      setPlatform("android");
      jest.mocked(nitroScreenRecorder.stopGlobalRecording).mockResolvedValue(file);

      await expect(discardFeedbackRecording()).resolves.toBeUndefined();
      expect(nitroScreenRecorder.cancelInAppRecording).not.toHaveBeenCalled();
    });
  });
});
