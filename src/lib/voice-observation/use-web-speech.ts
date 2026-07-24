"use client";

import { useCallback, useMemo, useRef } from "react";
import { defaultBrowserSpeechDictation, isBrowserWebSpeechSupported } from "@/lib/voice/client";

export type SpeechRecognitionLike = import("@/lib/voice/speech-to-text/browser-web-speech").SpeechRecognitionLike;

export {
  getSpeechRecognitionConstructor,
  isBrowserWebSpeechSupported as isWebSpeechSupported,
} from "@/lib/voice/speech-to-text/browser-web-speech";

type UseWebSpeechOptions = {
  languageHint?: string;
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
};

/** Browser dictation hook — wraps MVP BrowserWebSpeechDictation. */
export function useWebSpeechRecognition({
  languageHint,
  onTranscript,
  onError,
}: UseWebSpeechOptions) {
  const dictationRef = useRef(defaultBrowserSpeechDictation);
  const recordingRef = useRef(false);

  const stop = useCallback(() => {
    dictationRef.current.stop();
    recordingRef.current = false;
  }, []);

  const start = useCallback(
    (baseText: string) => {
      if (!isBrowserWebSpeechSupported()) {
        onError?.(
          "Voice recognition is not supported in this browser. Type your observation instead.",
        );
        return false;
      }

      stop();
      dictationRef.current.seedBaseText(baseText);

      const started = dictationRef.current.start(languageHint, {
        onPartial: onTranscript,
        onFinal: () => {},
        onError: (err) => {
          if (err.code === "permission_denied") {
            onError?.("Microphone permission denied. You can still type.");
          } else if (err.code !== "aborted" && err.code !== "no_speech") {
            onError?.("Voice recognition interrupted. You can still type.");
          }
        },
      });

      recordingRef.current = started;
      return started;
    },
    [languageHint, onError, onTranscript, stop],
  );

  return useMemo(
    () => ({
      start,
      stop,
      isSupported: isBrowserWebSpeechSupported(),
    }),
    [start, stop],
  );
}
