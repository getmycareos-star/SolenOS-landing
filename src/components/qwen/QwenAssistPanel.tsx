"use client";

import { useState } from "react";
import { ensureAnonymousSession, getJSON, postJSON } from "@/api/client";

export type QwenWorkflow =
  | "daily_capture" | "add_record" | "document" | "living_care_record"
  | "care_history_search" | "care_situation_change" | "delta_engine"
  | "evidence_provenance" | "uncertainty_contradictions" | "returning_caregiver"
  | "appointment" | "after_appointment" | "handoff" | "professional_summary"
  | "open_loops" | "two_week_review" | "decision_outcome" | "medication_day"
  | "reminders_notifications" | "care_coordination" | "companion"
  | "caregiver_feedback" | "sharing_export" | "roles_access" | "account_recovery"
  | "settings_security" | "record_lifecycle" | "offline_sync" | "ai_reliability"
  | "audit_review";

type QwenAssistResult = {
  workflow: QwenWorkflow;
  reply: string;
  ai_generated: boolean;
  model?: string;
  authority: "solenos_care_record_and_caregiver";
  review_required: boolean;
  written_to_lcr: false;
  persistence: "read_only_assistance";
  source_event_ids: string[];
  source_evidence_ids: string[];
  provider_status?: string;
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
  contextText = "",
  evidenceIds = [],
  appointmentId = null,
  title = "Help with your care information",
  compact = false,
}: Props) {
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
      const queued = (await postJSON("/assistant/jobs", {
        task_text: requestText.slice(0, 1_800),
        context_text: boundedContext,
        evidence_ids: [...new Set(evidenceIds)].slice(0, 10),
        ...(appointmentId ? { appointment_id: appointmentId } : {}),
      })) as { job_id?: string; status?: string };
      if (!queued?.job_id) {
        throw new Error("The request could not be queued.");
      }

      let completed: QwenAssistResult | null = null;
      for (let attempt = 0; attempt < 60; attempt += 1) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 2000));
        const status = (await getJSON(`/assistant/jobs/${encodeURIComponent(queued.job_id)}`)) as {
          status?: string;
          workflow?: QwenWorkflow | null;
          reply?: string | null;
          error?: string | null;
          source_event_ids?: string[];
          source_evidence_ids?: string[];
          review_required?: boolean;
          written_to_lcr?: boolean;
          persistence?: string;
        };
        if (status.status === "failed") {
          throw new Error(status.error || "The request could not be completed.");
        }
        if (status.status === "completed") {
          if (
            status.written_to_lcr !== false ||
            status.review_required !== true ||
            status.persistence !== "read_only_assistance" ||
            typeof status.reply !== "string" ||
            !status.reply.trim() ||
            !status.workflow
          ) {
            throw new Error("The request did not return a valid reviewed suggestion.");
          }
          completed = {
            workflow: status.workflow,
            reply: status.reply,
            ai_generated: true,
            authority: "solenos_care_record_and_caregiver",
            review_required: true,
            written_to_lcr: false,
            persistence: "read_only_assistance",
            source_event_ids: status.source_event_ids || [],
            source_evidence_ids: status.source_evidence_ids || [],
          };
          break;
        }
      }
      if (!completed) {
        throw new Error("The request is still processing. Please try again shortly.");
      }
      setReply(completed);
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

      {error && <p role="alert" style={{ color: "#3b2e11", background: "#fff4dc", border: "1px solid #c8a85d", borderRadius: "8px", padding: "10px 12px", fontSize: "14px", lineHeight: 1.5, marginTop: "10px" }}>{error}</p>}
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
