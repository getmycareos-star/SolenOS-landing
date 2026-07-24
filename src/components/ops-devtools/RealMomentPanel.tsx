/**
 * FUTURE / not MVP — multi-channel panel including voice (ADR-018).
 * Live MVP entry is AddSituationPanel (text + documents only). Do not remount voice UI.
 *
 * Phase 1 voice→CareEvent provenance remains valid for future channel plug-in.
 */
"use client";

import { useCallback, useState } from "react";
import { Mic, MicOff, FileText, Camera, Loader2 } from "lucide-react";

import type { AttachedDocument } from "@/lib/mvp-workspace";
import type { ActivationSessionContext } from "@/lib/activation-system";
import { trackClientActivationEvent } from "@/lib/activation-system/client";
import type { InputProvenance } from "@/lib/care-events";
import { useVoiceInput } from "@/lib/voice-input";

import { ActivationPromptBanner } from "./ActivationPromptBanner";
import { DementiaCareRecordPanel } from "./DementiaCareRecordPanel";
import { CareJourneyTimelinePanel } from "./CareJourneyTimelinePanel";
import { MeetingPreparationPanel } from "./MeetingPreparationPanel";
import { MemoryReconstructionPanel } from "./MemoryReconstructionPanel";
import { PatternIntelligencePanel } from "./PatternIntelligencePanel";
import { ContinuityGraphPanel } from "./ContinuityGraphPanel";

type InputChannel = "text" | "voice" | "document";

type Props = {
  value: string;
  onChange: (value: string) => void;
  documents: AttachedDocument[];
  onDocumentsChange: (docs: AttachedDocument[]) => void;
  onSubmit: (provenance: InputProvenance) => void;
  loading: boolean;
  error: string | null;
  activationSession: ActivationSessionContext | null;
  onActivationSessionRefresh: () => void;
  hasContextRoot?: boolean;
};

function createDocId() {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

async function extractDocument(file: File): Promise<AttachedDocument> {
  const id = createDocId();
  const base: AttachedDocument = {
    id,
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    extractedText: "",
    status: "pending",
  };

  try {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/extract", { method: "POST", body: form });
    const data = (await res.json()) as {
      ok?: boolean;
      text?: string;
      note?: string;
      message?: string;
      error?: string;
    };

    if (!res.ok || !data.ok || !data.text?.trim()) {
      return {
        ...base,
        status: "failed",
        errorNote:
          data.note ??
          data.message ??
          data.error ??
          "Text extraction failed. For PDFs start Tika; for images ensure Tesseract OCR is available.",
      };
    }

    return { ...base, extractedText: data.text.trim(), status: "ready" };
  } catch {
    return {
      ...base,
      status: "failed",
      errorNote: "Could not reach extraction service.",
    };
  }
}

const CHANNELS: { id: InputChannel; label: string }[] = [
  { id: "text", label: "Type" },
  { id: "voice", label: "Speak" },
  { id: "document", label: "Photo / PDF" },
];

/**
 * Multi-channel care entry — text, voice, and document at equal hierarchy.
 */
export function RealMomentPanel({
  value,
  onChange,
  documents,
  onDocumentsChange,
  onSubmit,
  loading,
  error,
  activationSession,
  onActivationSessionRefresh,
  hasContextRoot = false,
}: Props) {
  const [channel, setChannel] = useState<InputChannel>("text");
  const [extracting, setExtracting] = useState(false);

  const { voiceAvailable, state, provenance, toggleListening, markTypedInput } = useVoiceInput({
    value,
    onChange,
  });

  const listening = state === "listening";

  const handleTextChange = useCallback(
    (next: string) => {
      if (!listening) {
        markTypedInput();
      }
      onChange(next);
    },
    [listening, markTypedInput, onChange],
  );

  async function handleFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setExtracting(true);
    const next = [...documents];

    for (const file of Array.from(fileList)) {
      const doc = await extractDocument(file);
      next.push(doc);
      if (doc.status === "ready") {
        void trackClientActivationEvent({
          event_type: "DOCUMENT_UPLOADED",
          payload: { file_name: doc.name, mime_type: doc.mimeType },
        });
      }
    }

    onDocumentsChange(next);
    setExtracting(false);
  }

  const hasReadyDocs = documents.some((d) => d.status === "ready" && d.extractedText.trim());
  const canSubmit = (value.trim().length > 0 || hasReadyDocs) && !loading && !extracting;

  const showDementiaPanel =
    activationSession?.trust_stage === "building" ||
    activationSession?.trust_stage === "established";

  return (
    <div className="workspace-panel-inner real-moment">
      <h2 className="workspace-headline">What is happening right now?</h2>
      <p className="workspace-lede">
        Dump everything on your mind. Fragments, shorthand, incomplete thoughts — all fine.
      </p>

      <ActivationPromptBanner
        session={activationSession}
        onDismiss={onActivationSessionRefresh}
        onRespond={() => setChannel("text")}
      />

      <div className="input-channel-bar" role="tablist" aria-label="Input method">
        {CHANNELS.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={channel === c.id}
            className={`input-channel-tab${channel === c.id ? " is-active" : ""}`}
            onClick={() => setChannel(c.id)}
            disabled={loading}
          >
            {c.label}
          </button>
        ))}
      </div>

      {channel === "text" && (
        <div role="tabpanel" className="input-channel-panel">
          <textarea
            className="brain-dump"
            value={value}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="mom confused again · need refill · insurance issue · forgot appointment date"
            rows={10}
            disabled={loading}
            aria-label="Text care entry"
          />
        </div>
      )}

      {channel === "voice" && (
        <div role="tabpanel" className="input-channel-panel voice-channel-panel">
          <button
            type="button"
            className={`voice-primary-btn${listening ? " is-recording" : ""}`}
            onClick={toggleListening}
            disabled={loading || extracting || !voiceAvailable}
            aria-pressed={listening}
            aria-label={listening ? "Stop recording" : "Start recording"}
          >
            {listening ? <MicOff size={28} aria-hidden /> : <Mic size={28} aria-hidden />}
            <span>{listening ? "Stop" : "Start speaking"}</span>
          </button>
          {!voiceAvailable && (
            <p className="voice-unavailable">
              Voice is not available in this browser. Use Type or Photo / PDF instead.
            </p>
          )}
          {listening && (
            <p className="listening-pulse" role="status">
              Recording — words appear below as you speak.
            </p>
          )}
          <textarea
            className="brain-dump voice-transcript"
            value={value}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="Your words appear here as you speak…"
            rows={8}
            disabled={loading}
            aria-label="Voice transcript"
          />
        </div>
      )}

      {channel === "document" && (
        <div role="tabpanel" className="input-channel-panel document-channel-panel">
          <div className="document-actions-row">
            <label className="file-attach document-action">
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                disabled={loading || extracting}
                onChange={(e) => {
                  void handleFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <FileText size={20} aria-hidden />
              <span>{extracting ? "Reading document…" : "Upload file"}</span>
            </label>

            <label className="file-attach document-action camera-attach">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                disabled={loading || extracting}
                onChange={(e) => {
                  void handleFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <Camera size={20} aria-hidden />
              <span>Take photo</span>
            </label>
          </div>
          <p className="document-hint">
            Discharge paperwork, medication labels, insurance letters, appointment summaries.
          </p>
        </div>
      )}

      {documents.length > 0 && (
        <ul className="attached-list" aria-label="Attached documents">
          {documents.map((doc) => (
            <li key={doc.id}>
              {doc.name}
              {doc.status === "pending" && " · Reading document…"}
              {doc.status === "failed" &&
                ` · ${doc.errorNote ?? "Could not read this document."}`}
              {doc.status === "ready" && " · ready"}
              <button
                type="button"
                className="linkish"
                onClick={() => onDocumentsChange(documents.filter((d) => d.id !== doc.id))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {showDementiaPanel && hasContextRoot && <DementiaCareRecordPanel />}

      {hasContextRoot && (
        <>
          <CareJourneyTimelinePanel />
          <ContinuityGraphPanel />
          <MeetingPreparationPanel />
          <MemoryReconstructionPanel />
          <PatternIntelligencePanel />
        </>
      )}

      {error && (
        <p className="workspace-error" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        className="workspace-primary"
        disabled={!canSubmit}
        onClick={() => onSubmit(provenance)}
      >
        {loading ? (
          <>
            <Loader2 className="spin" size={18} aria-hidden />
            Carrying this for you…
          </>
        ) : (
          "Add Situation"
        )}
      </button>
    </div>
  );
}
