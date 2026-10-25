"use client";

import { useState } from "react";
import { ensureAnonymousSession, postJSON } from "@/api/client";

export type QwenWorkflow =
  | "daily_capture"
  | "document"
  | "community"
  | "appointment"
  | "after_appointment"
  | "handoff"
  | "professional_summary"
  | "open_loops"
  | "two_week_review"
  | "decision_outcome"
  | "medication_day"
  | "living_care_record";

type QwenAssistResult = {
  workflow: QwenWorkflow;
  reply: string;
  ai_generated: boolean;
  model: string;
  authority: "solenos_care_record_and_caregiver";
  review_required: boolean;
  written_to_lcr: false;
  persistence: "read_only_assistance";
  source_event_ids: string[];
  source_evidence_ids: string[];
  provider_status: string;
};

type Props = {
  defaultWorkflow?: QwenWorkflow;
  contextText?: string;
  evidenceIds?: string[];
  appointmentId?: string | null;
  title?: string;
  compact?: boolean;
};

/**
 * Routes optional language assistance through Railway's private/bundled Ollama
 * Qwen endpoint. This panel is read-only: the LCR remains authoritative and
 * only explicit caregiver actions can create or change records.
 */
export default function QwenAssistPanel({
  defaultWorkflow = "living_care_record",
  contextText = "",
  evidenceIds = [],
  appointmentId = null,
  title = "Help with your care information",
  compact = false,
}: Props) {
  const workflow = defaultWorkflow;
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState<QwenAssistResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function askQwen() {
    const requestText = question.trim();
    if (!requestText) {
      setError("Enter a question or describe what you need help with.");
      return;
    }
    setLoading(true);
    setError(null);
    setReply(null);
    try {
      await ensureAnonymousSession();
      const boundedContext = contextText.trim().slice(0, 5_500);
      const text = [
        "Caregiver request:",
        requestText.slice(0, 1_800),
        boundedContext
          ? "\nContext supplied for this request (may be an unsaved draft; do not claim it is saved):\n" + boundedContext
          : "",
      ].filter(Boolean).join("\n").slice(0, 7_900);
      const result = (await postJSON("/assistant/assist", {
        workflow,
        text,
        evidence_ids: [...new Set(evidenceIds)].slice(0, 10),
        ...(appointmentId ? { appointment_id: appointmentId } : {}),
      })) as QwenAssistResult;

      if (
        result?.ai_generated !== true ||
        result.provider_status !== "available" ||
        result.authority !== "solenos_care_record_and_caregiver" ||
        result.review_required !== true ||
        result.written_to_lcr !== false ||
        result.persistence !== "read_only_assistance" ||
        typeof result.reply !== "string" ||
        !result.reply.trim()
      ) {
        throw new Error("We couldn’t complete that request. Please try again.");
      }
      setReply(result);
    } catch {
      setError("We couldn’t complete that request. Your information has not been changed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      aria-label={title}
      style={{
        border: "1px solid var(--border)",
        borderRadius: "12px",
        padding: compact ? "12px" : "16px",
        background: "var(--surface)",
        margin: "16px 0",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: "15px", fontWeight: 650, margin: 0 }}>{title}</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "12px", marginTop: "4px", lineHeight: 1.5 }}>
            Get help understanding or organizing the information here. Suggestions are not saved to the Living Care Record automatically.
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "10px", marginTop: "12px" }}>
        <label style={{ display: "grid", gap: "5px", fontSize: "12px", color: "var(--text-secondary)" }}>
          What would you like help with?
          <textarea
            value={question}
            onChange={(event) => { setQuestion(event.target.value); setError(null); }}
            rows={compact ? 2 : 3}
            maxLength={1800}
            placeholder="Ask a question about the information here…"
            style={{ width: "100%", boxSizing: "border-box", border: "2px solid #718477", borderRadius: "8px", padding: "10px", background: "#ffffff", color: "#172b35", caretColor: "#172b35", WebkitTextFillColor: "#172b35", fontSize: "16px", resize: "vertical" }}
          />
        </label>
        <div>
          <button
            type="button"
            onClick={askQwen}
            disabled={loading || !question.trim()}
            style={{ border: "2px solid #8eae8a", borderRadius: "8px", padding: "10px 16px", minHeight: "44px", background: loading || !question.trim() ? "#e8eee9" : "#b9d5b5", color: "#17251c", fontSize: "14px", fontWeight: 750, opacity: 1, cursor: loading || !question.trim() ? "not-allowed" : "pointer" }}
          >
            {loading ? "Working…" : "Send"}
          </button>
        </div>
      </div>

      {error && <p role="alert" style={{ color: "var(--error)", fontSize: "12px", marginTop: "10px" }}>{error}</p>}
      {reply && (
        <div style={{ marginTop: "12px", border: "1px solid var(--border)", borderRadius: "9px", padding: "12px", background: "var(--bg)" }}>
          <p style={{ fontSize: "13px", lineHeight: 1.6, whiteSpace: "pre-wrap", margin: 0 }}>{reply.reply}</p>
          <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "10px" }}>
            Suggestion · Please review it. This does not change your care record.
          </p>
          {(reply.source_event_ids.length > 0 || reply.source_evidence_ids.length > 0) && (
            <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px" }}>
              Based on {reply.source_event_ids.length} saved care update(s) and {reply.source_evidence_ids.length} attached item(s).
            </p>
          )}
        </div>
      )}
    </section>
  );
}
