"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { defaultBrowserSpeechOutput } from "./speech-output/browser-speech-synthesis";

export type ReadAloudStatus = "idle" | "speaking" | "error";

/**
 * MVP Read Aloud — browser speechSynthesis only (no cloud TTS round-trip).
 */
export function useBrowserReadAloud(languageHint?: string) {
  const [status, setStatus] = useState<ReadAloudStatus>("idle");
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const outputRef = useRef(defaultBrowserSpeechOutput);

  useEffect(() => {
    return () => outputRef.current.stop();
  }, []);

  const stop = useCallback(() => {
    outputRef.current.stop();
    setStatus("idle");
  }, []);

  const play = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        setStatus("error");
        setLastMessage("Nothing to read aloud.");
        return;
      }

      if (!outputRef.current.isSupported()) {
        setStatus("error");
        setLastMessage("Read-aloud is not supported in this browser.");
        return;
      }

      setLastMessage(null);
      outputRef.current.speak(trimmed, languageHint, {
        onStart: () => setStatus("speaking"),
        onEnd: () => setStatus("idle"),
        onError: (msg) => {
          setStatus("error");
          setLastMessage(msg);
        },
      });
    },
    [languageHint],
  );

  return {
    play,
    stop,
    status,
    lastMessage,
    isBusy: status === "speaking",
  };
}
