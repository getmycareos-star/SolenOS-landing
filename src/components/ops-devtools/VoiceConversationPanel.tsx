/**
 * FUTURE / not MVP — voice conversation UI (ADR-018). Keep unmounted.
 */
"use client";

import { Loader2, Mic, MicOff, RotateCcw } from "lucide-react";
import { useVoiceConversation, isBrowserWebSpeechSupported } from "@/lib/voice/client";
import type { ClarityEnvelope } from "@/lib/mvp-workspace";
import { normalizeClarityEnvelope } from "@/lib/mvp-workspace";

type Props = {
  languageHint?: string;
  telemetryUserId?: string;
  careSessionId?: string;
  /** Fired each turn — workspace updates clarity without leaving voice mode. */
  onTurn?: (payload: {
    envelope: ClarityEnvelope;
    rawInput: string;
    rawResponse: Record<string, unknown>;
    turnCount: number;
  }) => void;
  /** Stop with at least one completed turn — transition to carrying. */
  onStopWithClarity?: (payload: {
    envelope: ClarityEnvelope;
    rawInput: string;
    rawResponse: Record<string, unknown>;
    turnCount: number;
  }) => void;
  onExit: () => void;
};

export function VoiceConversationPanel({
  languageHint,
  telemetryUserId,
  careSessionId,
  onTurn,
  onStopWithClarity,
  onExit,
}: Props) {
  const supported = isBrowserWebSpeechSupported();

  const voice = useVoiceConversation({
    languagePreference: languageHint,
    telemetryUserId,
    careSessionId,
    onTurn: (turn, turnIndex) => {
      if (turn.rawAnalyze) {
        onTurn?.({
          envelope: normalizeClarityEnvelope(turn.rawAnalyze),
          rawInput: turn.userTranscript,
          rawResponse: turn.rawAnalyze,
          turnCount: turnIndex,
        });
      }
    },
  });

  function handleStop() {
    const latest = voice.lastTurn;
    const turnCount = voice.turns.length;
    voice.deactivate();
    if (latest?.rawAnalyze) {
      onStopWithClarity?.({
        envelope: normalizeClarityEnvelope(latest.rawAnalyze),
        rawInput: latest.userTranscript,
        rawResponse: latest.rawAnalyze,
        turnCount,
      });
    }
  }

  return (
    <div className="workspace-panel-inner voice-conversation-panel">
      <h2 className="workspace-headline">Voice Mode</h2>
      <p className="workspace-lede">
        Speak naturally. solenos listens, understands, and responds aloud. No typing required.
      </p>

      {!supported && (
        <p className="workspace-error" role="alert">
          Voice Conversation is not supported in this browser. Use Chrome, Edge, or Safari.
        </p>
      )}

      <div className="voice-state-display" role="status" aria-live="polite">
        {voice.stateLabel ? (
          <p className={`voice-state voice-state-${voice.state}`}>
            {voice.state === "listening" && <Mic size={28} aria-hidden className="pulse-icon" />}
            {voice.state === "processing" && (
              <Loader2 size={28} aria-hidden className="spin pulse-icon" />
            )}
            {voice.state === "responding" && (
              <span className="voice-wave pulse-icon" aria-hidden>
                ♪
              </span>
            )}
            <span>{voice.stateLabel}</span>
          </p>
        ) : voice.active ? (
          <p className="voice-state">Starting…</p>
        ) : (
          <p className="voice-state-muted">Tap start to begin a voice conversation.</p>
        )}
        {voice.state === "processing" && voice.lastHeard && (
          <p className="voice-heard-hint">Heard: {voice.lastHeard}</p>
        )}
      </div>

      {voice.lastError && (
        <div className="voice-error-row">
          <p className="workspace-error" role="alert">
            {voice.lastError}
          </p>
          {voice.active && (
            <button type="button" className="linkish" onClick={voice.retry}>
              <RotateCcw size={14} aria-hidden /> Retry
            </button>
          )}
        </div>
      )}

      {voice.turns.length > 0 && voice.active && (
        <p className="voice-turn-count" aria-live="polite">
          {voice.turns.length === 1 ? "1 exchange" : `${voice.turns.length} exchanges`}
        </p>
      )}

      <div className="voice-conversation-actions">
        {!voice.active ? (
          <button
            type="button"
            className="workspace-primary voice-start-btn"
            disabled={!supported}
            onClick={() => void voice.activate()}
          >
            <Mic size={20} aria-hidden />
            Start Voice Mode
          </button>
        ) : (
          <button
            type="button"
            className="mic-btn is-recording"
            onClick={handleStop}
            aria-pressed
          >
            <MicOff size={20} aria-hidden />
            Stop Voice Mode
          </button>
        )}

        <button
          type="button"
          className="linkish voice-exit-btn"
          onClick={() => {
            if (voice.active) voice.deactivate();
            onExit();
          }}
        >
          Back to typing
        </button>
      </div>

      <p className="voice-footnote">
        Your words are understood internally — clarity appears as solenos speaks. Transcript is
        not the main experience.
      </p>
    </div>
  );
}
