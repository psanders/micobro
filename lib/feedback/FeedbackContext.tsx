/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Ports mikro's feedback state machine (idle/recording/processing/result/
 * error) and its native-recorder calls — mikro's server pipeline
 * (transcription, LLM structuring, GitHub filing) is not ported; see
 * `FeedbackRepo` for why. Recording API differs by platform: Android uses
 * the global recorder (MediaProjection has no in-app-only mode), iOS uses
 * the in-app recorder (ReplayKit's global/broadcast API needs a
 * BroadcastExtension target that hits a known EAS provisioning bug — see
 * `patches/react-native-nitro-screen-recorder+0.7.0.patch` — and in-app
 * capture is a better fit anyway, since feedback here is always about
 * something inside Micobro). The one real UX difference: iOS in-app
 * recording is scoped to this app, so it stops if the lender backgrounds
 * the app mid-capture — expected and acceptable for this use case.
 */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import {
  getMicrophonePermissionStatus,
  requestMicrophonePermission
} from "react-native-nitro-screen-recorder";
import type { ScreenRecordingFile } from "react-native-nitro-screen-recorder";
import { useFeedbackRepo } from "../repo/RepoProvider";
import { finishFeedbackRecording } from "./finishFeedbackRecording";
import {
  startFeedbackRecording,
  stopFeedbackRecording,
  discardFeedbackRecording
} from "./recorder";

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
      await startFeedbackRecording();
      setErrorMessage(null);
      setStage("recording");
    } catch {
      setErrorMessage(START_ERROR);
      setStage("error");
    }
  }, []);

  const stopRecording = useCallback(async () => {
    const file = await stopFeedbackRecording();
    await submit(file);
  }, [submit]);

  const discardRecording = useCallback(() => {
    discardFeedbackRecording().catch(() => {});
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
