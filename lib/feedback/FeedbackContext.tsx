/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Ports mikro's feedback state machine (idle/recording/processing/result/
 * error) and its native-recorder calls — mikro's server pipeline
 * (transcription, LLM structuring, GitHub filing) is not ported; see
 * `FeedbackRepo` for why. Micobro is Android-only, so only the global
 * recording API is used (MediaProjection has no in-app-only mode — this
 * is the same reason mikro's Android side uses it too).
 */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import {
  getMicrophonePermissionStatus,
  requestMicrophonePermission,
  startGlobalRecording,
  stopGlobalRecording
} from "react-native-nitro-screen-recorder";
import type { ScreenRecordingFile } from "react-native-nitro-screen-recorder";
import { useFeedbackRepo } from "../repo/RepoProvider";
import { finishFeedbackRecording } from "./finishFeedbackRecording";

export type FeedbackStage = "idle" | "recording" | "processing" | "result" | "error";

interface FeedbackContextValue {
  stage: FeedbackStage;
  errorMessage: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  discardRecording: () => void;
  retrySubmit: () => void;
  reset: () => void;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

const START_ERROR = "No se pudo iniciar la grabación. Revisa los permisos de pantalla y micrófono.";
const SUBMIT_ERROR = "No se pudo enviar el feedback. Intenta de nuevo más tarde.";

/** Grace window to catch an immediate `onRecordingError` before declaring "started". */
const START_GRACE_MS = 300;

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const feedbackRepo = useFeedbackRepo();
  const [stage, setStage] = useState<FeedbackStage>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pendingFileRef = useRef<ScreenRecordingFile | undefined>(undefined);

  const submit = useCallback(
    async (file: ScreenRecordingFile | undefined) => {
      pendingFileRef.current = file;
      setStage("processing");
      try {
        await feedbackRepo.submit(finishFeedbackRecording(file));
        setStage("result");
      } catch {
        setErrorMessage(SUBMIT_ERROR);
        setStage("error");
      }
    },
    [feedbackRepo]
  );

  const startRecording = useCallback(async () => {
    try {
      if (getMicrophonePermissionStatus() !== "granted") {
        const response = await requestMicrophonePermission();
        if (!response.granted) throw new Error("microphone permission denied");
      }
      await new Promise<void>((resolve, reject) => {
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
      setErrorMessage(null);
      setStage("recording");
    } catch {
      setErrorMessage(START_ERROR);
      setStage("error");
    }
  }, []);

  const stopRecording = useCallback(async () => {
    const file = await stopGlobalRecording();
    await submit(file);
  }, [submit]);

  const discardRecording = useCallback(() => {
    stopGlobalRecording().catch(() => {});
    pendingFileRef.current = undefined;
    setStage("idle");
  }, []);

  const retrySubmit = useCallback(() => {
    submit(pendingFileRef.current);
  }, [submit]);

  const reset = useCallback(() => {
    pendingFileRef.current = undefined;
    setErrorMessage(null);
    setStage("idle");
  }, []);

  return (
    <FeedbackContext.Provider
      value={{
        stage,
        errorMessage,
        startRecording,
        stopRecording,
        discardRecording,
        retrySubmit,
        reset
      }}
    >
      {children}
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackContextValue {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used within a FeedbackProvider");
  return ctx;
}
