"use client";



import { useCallback, useEffect, useRef, useState } from "react";

import {
  useWebSpeechRecognition,
  isWebSpeechSupported,
} from "@/lib/voice-observation/client";



type CaptureTab = "voice" | "text";



interface ObservationInputProps {

  value: string;

  onChange: (value: string) => void;

  onSubmit: (source: "text" | "voice") => void;

  loading: boolean;

  error: string | null;

  pendingTranscript?: string | null;

  onPendingTranscriptChange?: (value: string) => void;

  onConfirmPendingTranscript?: () => void;

  onDiscardPendingTranscript?: () => void;

  /** solenos language code for Web Speech */

  languageHint?: string;

}



/**

 * FUTURE / not MVP — ADR-018. Do not mount in CognitiveWorkspace or caregiver entry.

 * Voice/mic capture is a future input channel into the same Care Reality pipeline.

 * Live MVP composer is AddSituationPanel (text + documents only).

 * Gate: assertFutureCapabilityNotMvp("voice input mic UI") before shipping.

 */

export function ObservationInput({

  value,

  onChange,

  onSubmit,

  loading,

  error,

  pendingTranscript = null,

  onPendingTranscriptChange,

  onConfirmPendingTranscript,

  onDiscardPendingTranscript,

  languageHint,

}: ObservationInputProps) {

  const [tab, setTab] = useState<CaptureTab>("voice");

  const [recording, setRecording] = useState(false);

  const [voiceError, setVoiceError] = useState<string | null>(null);

  const [voiceDraft, setVoiceDraft] = useState("");
  const voiceDraftRef = useRef("");

  const webSpeech = useWebSpeechRecognition({
    languageHint,
    onTranscript: (text) => {
      voiceDraftRef.current = text;
      setVoiceDraft(text);
    },
    onError: setVoiceError,
  });



  useEffect(() => {
    return () => {
      webSpeech.stop();
    };
  }, [webSpeech]);

  const stopRecording = useCallback(() => {
    webSpeech.stop();
    setRecording(false);
    const draft = voiceDraftRef.current.trim();
    if (draft) {
      onPendingTranscriptChange?.(draft);
    } else {
      setVoiceError("No speech detected. Try again or use the Type tab.");
    }
  }, [onPendingTranscriptChange, webSpeech]);

  const startRecording = useCallback(() => {
    setVoiceError(null);
    setVoiceDraft("");
    voiceDraftRef.current = "";

    if (!isWebSpeechSupported()) {
      setVoiceError(
        "Voice recognition is not supported in this browser. Use the Type tab instead.",
      );
      setTab("text");
      return;
    }

    const started = webSpeech.start(value);
    if (started) {
      setRecording(true);
    }
  }, [value, webSpeech]);



  const displayDraft = recording ? voiceDraft : "";



  return (

    <section className="observation-input" aria-label="Record observation">

      <div className="observation-input-header">
        <label className="label observation-input-title">Record Observation</label>
      </div>

      <p className="observation-hint">

        Capture what you observed — speak or type. Patterns are tracked over time, not diagnosed.

      </p>



      <div className="observation-tabs" role="tablist" aria-label="Observation input method">

        <button

          type="button"

          role="tab"

          aria-selected={tab === "voice"}

          className={tab === "voice" ? "observation-tab active" : "observation-tab"}

          onClick={() => setTab("voice")}

          disabled={loading}

        >

          Voice

        </button>

        <button

          type="button"

          role="tab"

          aria-selected={tab === "text"}

          className={tab === "text" ? "observation-tab active" : "observation-tab"}

          onClick={() => setTab("text")}

          disabled={loading}

        >

          Type

        </button>

      </div>



      {tab === "voice" ? (

        <div className="observation-voice-pane">

          {pendingTranscript != null ? (

            <div className="observation-transcript-edit">

              <label htmlFor="observation-transcript-edit" className="label">

                Transcript (edit before save)

              </label>

              <textarea

                id="observation-transcript-edit"

                className="input observation-input-field"

                rows={3}

                value={pendingTranscript}

                onChange={(e) => onPendingTranscriptChange?.(e.target.value)}

              />

              <div className="observation-input-actions">

                <button

                  type="button"

                  className="btn-secondary"

                  onClick={() => onConfirmPendingTranscript?.()}

                  disabled={loading || !pendingTranscript.trim()}

                >

                  {loading ? "Saving…" : "Save Observation"}

                </button>

                <button

                  type="button"

                  className="btn-voice"

                  onClick={() => onDiscardPendingTranscript?.()}

                  disabled={loading}

                >

                  Discard

                </button>

              </div>

            </div>

          ) : (

            <>

              {recording && (

                <textarea

                  className="input observation-input-field observation-live-transcript"

                  rows={3}

                  value={displayDraft}

                  readOnly

                  aria-label="Live voice transcription"

                  placeholder="Listening…"

                />

              )}

              <div className="observation-input-actions">

                {!recording ? (

                  <button

                    type="button"

                    className="btn-secondary btn-mic"

                    onClick={() => void startRecording()}

                    disabled={loading}

                    aria-label="Start recording observation"

                  >

                    ● Record

                  </button>

                ) : (

                  <button

                    type="button"

                    className="btn-secondary btn-mic recording"

                    onClick={stopRecording}

                    aria-label="Stop recording"

                  >

                    ■ Stop

                  </button>

                )}

              </div>

              {recording && (

                <p className="listening-pulse observation-listening" role="status">
                  Listening…
                </p>

              )}

            </>

          )}

          {voiceError && <p className="error">{voiceError}</p>}

        </div>

      ) : (

        <div className="observation-text-pane">

          <textarea

            id="observation-input"

            className="input observation-input-field"

            rows={2}

            placeholder="Share what happened, what changed, or what feels unclear…"

            value={value}

            onChange={(e) => onChange(e.target.value)}

            onKeyDown={(e) => {

              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !loading && value.trim()) {

                e.preventDefault();

                onSubmit("text");

              }

            }}

          />

          <div className="observation-input-actions">

            <button

              type="button"

              className="btn-secondary"

              onClick={() => onSubmit("text")}

              disabled={loading || !value.trim()}

            >

              {loading ? "Recording…" : "Record Observation"}

            </button>

          </div>

        </div>

      )}



      {error && <p className="error">{error}</p>}

    </section>

  );

}

