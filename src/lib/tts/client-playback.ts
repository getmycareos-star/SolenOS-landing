"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toSpeechRecognitionLang } from "@/lib/voice-observation/speech-language";

export type TtsPlaybackStatus = "idle" | "loading" | "playing" | "error";

export type TtsPlaybackResult = {
  engine: "polly" | "google" | "browser" | null;
  message?: string;
};

/**
 * Cloud TTS via POST /api/tts/synthesize with Web Speech speechSynthesis fallback.
 * Polly/Google preferred when credentials exist; browser read-aloud for accessibility.
 */
export function useTtsPlayback(languageHint?: string) {
  const [status, setStatus] = useState<TtsPlaybackStatus>("idle");
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    utteranceRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const stop = useCallback(() => {
    cleanup();
    setStatus("idle");
  }, [cleanup]);

  const playBrowserFallback = useCallback(
    (text: string): TtsPlaybackResult => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        return {
          engine: null,
          message: "Read-aloud unavailable — no cloud TTS credentials and browser speech unsupported.",
        };
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = toSpeechRecognitionLang(languageHint);
      utterance.rate = 0.92;
      utteranceRef.current = utterance;

      utterance.onstart = () => setStatus("playing");
      utterance.onend = () => setStatus("idle");
      utterance.onerror = () => {
        setStatus("error");
        setLastMessage("Browser read-aloud failed.");
      };

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      return { engine: "browser", message: "Using browser read-aloud (cloud TTS unavailable)." };
    },
    [languageHint],
  );

  const play = useCallback(
    async (text: string): Promise<TtsPlaybackResult> => {
      const trimmed = text.trim();
      if (!trimmed) {
        setStatus("error");
        setLastMessage("Nothing to read aloud.");
        return { engine: null, message: "Nothing to read aloud." };
      }

      cleanup();
      setStatus("loading");
      setLastMessage(null);

      try {
        const res = await fetch("/api/tts/synthesize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: trimmed,
            ...(languageHint ? { language_preference: languageHint } : {}),
          }),
        });

        if (res.ok) {
          const engine = (res.headers.get("X-SolenOS-TTS-Engine") ?? "polly") as
            | "polly"
            | "google";
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          objectUrlRef.current = url;
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onended = () => setStatus("idle");
          audio.onerror = () => {
            setStatus("error");
            setLastMessage("Audio playback failed.");
          };
          await audio.play();
          setStatus("playing");
          return { engine };
        }

        const data = (await res.json().catch(() => ({}))) as {
          code?: string;
          error?: string;
        };

        if (res.status === 503 || data.code === "MISSING_CREDENTIALS") {
          const fallback = playBrowserFallback(trimmed);
          setLastMessage(fallback.message ?? null);
          if (fallback.engine) {
            return fallback;
          }
          setStatus("error");
          const msg =
            data.error ??
            "Cloud TTS not configured (AWS Polly / Google TTS). Browser read-aloud also unavailable.";
          setLastMessage(msg);
          return { engine: null, message: msg };
        }

        const fallback = playBrowserFallback(trimmed);
        if (fallback.engine) {
          setLastMessage(fallback.message ?? null);
          return fallback;
        }

        setStatus("error");
        const msg = data.error ?? "Speech synthesis failed.";
        setLastMessage(msg);
        return { engine: null, message: msg };
      } catch {
        const fallback = playBrowserFallback(trimmed);
        if (fallback.engine) {
          setLastMessage(fallback.message ?? null);
          return fallback;
        }
        setStatus("error");
        setLastMessage("Could not reach TTS service.");
        return { engine: null, message: "Could not reach TTS service." };
      }
    },
    [cleanup, languageHint, playBrowserFallback],
  );

  return { play, stop, status, lastMessage, isBusy: status === "loading" || status === "playing" };
}
