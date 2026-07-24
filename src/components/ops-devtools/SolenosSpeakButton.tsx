/**
 * FUTURE / not MVP — TTS control (ADR-018). Do not mount in live workspace panels.
 */
"use client";

import { useEffect, useRef } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { useBrowserReadAloud } from "@/lib/voice/client";

type Props = {
  text: string;
  languageHint?: string;
  className?: string;
  label?: string;
};

/**
 * Hear solenos — FUTURE. Requires a user click (browsers block auto-play speech).
 */
export function SolenosSpeakButton({
  text,
  languageHint,
  className,
  label = "Hear solenos",
}: Props) {
  const { play, stop, status, lastMessage } = useBrowserReadAloud(languageHint);
  const lastTextRef = useRef(text);

  useEffect(() => {
    if (lastTextRef.current !== text && status === "speaking") {
      stop();
    }
    lastTextRef.current = text;
  }, [text, status, stop]);

  return (
    <div className={`listen-row${className ? ` ${className}` : ""}`}>
      <button
        type="button"
        className="listen-btn"
        disabled={!text.trim()}
        aria-pressed={status === "speaking"}
        onClick={() => {
          if (status === "speaking") stop();
          else play(text);
        }}
      >
        {status === "speaking" ? (
          <VolumeX size={18} aria-hidden />
        ) : (
          <Volume2 size={18} aria-hidden />
        )}
        <span>{status === "speaking" ? "Stop" : label}</span>
      </button>
      {lastMessage && (
        <p className="listen-note" role="status">
          {lastMessage}
        </p>
      )}
    </div>
  );
}
