"use client";

import { useState } from "react";
import { ensureAnonymousSession, getJSON, postJSON } from "@/api/client";
import { LivingArchiveMark } from "@/components/brand";

export type QwenWorkflow =
  | "daily_capture" | "add_record" | "document" | "living_care_record"
  | "care_history_search" | "care_situation_change" | "delta_engine"
  | "evidence_provenance" | "uncertainty_contradictions" | "returning_caregiver"
  | "appointment" | "after_appointment" | "handoff" | "professional_summary"
  | "open_loops" | "two_week_review" | "decision_outcome" | "medication_day"
  | "reminders_notifications" | "care_coordination" | "companion"
  | "caregiver_feedback" | "sharing_export" | "roles_access" | "account_recovery"
  | "settings_security" | "record_lifecycle" | "offline_sync" | "ai_reliability"
  | "audit_review" | "care_transition" | "incident_follow_through"
  | "emergency_readiness" | "care_coverage_gap" | "care_instruction_change_tracker"
  | "critical_information_completeness" | "personal_preferences_distress_context"
  | "caregiver_strain_support" | "document_validity_renewal";

type QwenClaimSource = {
  record_type?: string;
  record_id?: string;
  label?: string;
  occurred_at?: string | null;
  recorded_at?: string | null;
  entered_by?: string | null;
  reported_by?: string | null;
  source_excerpt?: string | null;
  source_state_label?: string | null;
};
type QwenClaimProvenance = {
  coverage?: string;
  unmatched_statement_count?: number;
  claims?: Array<{
    claim_id: string;
    text: string;
    support_status: string;
    validation_basis?: string;
    aggregate?: { topic?: string; window_label?: string; count?: number; candidate_count?: number } | null;
    source_references: QwenClaimSource[];
  }>;
};
type QwenBackgroundJobResult = {
  job_id: string;
  status: string;
  workflow?: QwenWorkflow | null;
  reply: string | null;
  error?: string | null;
  source_event_ids: string[];
  source_evidence_ids: string[];
  source_document_analysis_ids: string[];
  source_appointment_ids: string[];
  source_handoff_ids: string[];
  source_notification_ids: string[];
  source_freshness_assessment_ids: string[];
  claim_provenance?: QwenClaimProvenance | null;
  review_required: boolean;
  written_to_lcr: false;
  persistence: "read_only_assistance";
};

type Props = {
  defaultWorkflow?: QwenWorkflow;
  contextText?: string;
  evidenceIds?: string[];
  appointmentId?: string | null;
  title?: string;
  description?: string;
  compact?: boolean;
};

/**
 * Sends the caregiver's request to a durable background queue. The backend
 * classifies the workflow internally; caregivers never select or see workflow
 * IDs. Qwen suggestions are read-only and never write to the LCR.
 */
export default function QwenAssistPanel({
  defaultWorkflow,
  contextText = "",
  evidenceIds = [],
  appointmentId = null,
  title = "Help with your care information",
  description = "Get help understanding or organizing the information here. Suggestions are not saved to the Living Care Record automatically.",
  compact = false,
}: Props) {
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState<QwenBackgroundJobResult | null>(null);
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
      const boundedContext = contextText.trim().slice(0, 3_000);
      const taskText = defaultWorkflow === "document"
        ? "Explain the document text and answer only from uploaded document evidence. Caregiver request: " + requestText
        : requestText;
      const created = (await postJSON("/assistant/jobs", {
        task_text: taskText.slice(0, 1_800),
        context_text: boundedContext,
        evidence_ids: [...new Set(evidenceIds)].slice(0, 10),
        ...(appointmentId ? { appointment_id: appointmentId } : {}),
      })) as { job_id: string; status: string };

      if (!created?.job_id || !["queued", "processing"].includes(created.status)) {
        throw new Error("The request could not be queued.");
      }

      // The backend classifies the task and runs Qwen in its durable worker.
      // Poll the job resource; never fall back to a canned or guessed response.
      let completed: QwenBackgroundJobResult | null = null;
      for (let attempt = 0; attempt < 60; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2_000));
        const status = (await getJSON("/assistant/jobs/" + encodeURIComponent(created.job_id))) as QwenBackgroundJobResult;
        if (status.status === "completed") {
          if (
            status.written_to_lcr !== false ||
            status.persistence !== "read_only_assistance" ||
            status.review_required !== true ||
            typeof status.reply !== "string" ||
            !status.reply.trim() ||
            !Array.isArray(status.source_event_ids) ||
            !Array.isArray(status.source_evidence_ids) ||
            !Array.isArray(status.source_document_analysis_ids) ||
            !Array.isArray(status.source_appointment_ids) ||
            !Array.isArray(status.source_handoff_ids) ||
            !Array.isArray(status.source_notification_ids) ||
            !Array.isArray(status.source_freshness_assessment_ids)
          ) {
            throw new Error("The completed response failed safety checks.");
          }
          completed = status;
          break;
        }
        if (status.status === "failed") {
          throw new Error(status.error || "The background request failed.");
        }
      }
      if (!completed) {
        throw new Error("The request is taking longer than expected. You can try again shortly.");
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
      className="qwen-assist-panel"
      style={{
        border: "1px solid var(--theme-panel-border)",
        borderRadius: "12px",
        padding: compact ? "12px" : "16px",
        background: "var(--theme-panel-bg)",
        margin: "16px 0",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: "15px", fontWeight: 650, margin: 0 }}>{title}</h2>
          <p style={{ color: "var(--theme-panel-muted)", fontSize: "12px", marginTop: "4px", lineHeight: 1.5 }}>
            {description}
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
            style={{ width: "100%", boxSizing: "border-box", border: "2px solid var(--theme-panel-border)", borderRadius: "8px", padding: "10px", background: "var(--theme-field-bg)", color: "var(--theme-field-fg)", caretColor: "var(--theme-field-fg)", WebkitTextFillColor: "var(--theme-field-fg)", fontSize: "16px", resize: "vertical" }}
          />
        </label>
        <div>
          <button
            type="button"
            onClick={askQwen}
            disabled={loading || !question.trim()}
            style={{ border: "2px solid #8eae8a", borderRadius: "8px", padding: "10px 16px", minHeight: "44px", background: loading || !question.trim() ? "var(--theme-action-disabled-bg)" : "var(--theme-action-bg)", color: "var(--theme-action-fg)", fontSize: "14px", fontWeight: 750, opacity: 1, cursor: loading || !question.trim() ? "not-allowed" : "pointer" }}
          >
            {loading ? "Working…" : "Send"}
          </button>
        </div>
      </div>
      {loading && <div style={{ marginTop: 10 }}><LivingArchiveMark size="sm" label="Working on your request…" /></div>}

      {error && <p role="alert" style={{ color: "var(--theme-warning-fg)", background: "var(--theme-warning-bg)", border: "1px solid var(--theme-warning-border)", borderRadius: "8px", padding: "10px 12px", fontSize: "14px", lineHeight: 1.5, marginTop: "10px" }}>{error}</p>}
      {reply && (
        <div style={{ marginTop: "12px", border: "1px solid var(--border)", borderRadius: "9px", padding: "12px", background: "var(--bg)" }}>
          <p style={{ fontSize: "13px", lineHeight: 1.6, whiteSpace: "pre-wrap", margin: 0 }}>{reply.reply}</p>
          <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "10px" }}>
            Suggestion · Please review it. This does not change your care record.
          </p>
          {reply.claim_provenance?.claims && reply.claim_provenance.claims.length > 0 && (
            <div aria-label="What each statement is based on" style={{ marginTop: "12px", borderTop: "1px solid var(--border)", paddingTop: "10px", display: "grid", gap: "10px" }}>
              <p style={{ fontSize: "12px", fontWeight: 650, margin: 0 }}>What each statement is based on</p>
              {reply.claim_provenance.claims.map((claim) => (
                <section key={claim.claim_id} style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "9px", display: "grid", gap: "6px" }}>
                  <p style={{ fontSize: "12px", lineHeight: 1.5, margin: 0 }}>{claim.text}</p>
                  {claim.support_status === "matched_validated_aggregate" && (
                    <p style={{ fontSize: "11px", color: "var(--text-secondary)", margin: 0 }}>
                      Counted from {claim.aggregate?.count ?? claim.source_references.length} distinct saved care updates
                      {claim.aggregate?.window_label ? " during " + claim.aggregate.window_label : ""}.
                    </p>
                  )}
                  {claim.support_status === "matched_saved_wording" && (
                    <p style={{ fontSize: "11px", color: "var(--text-secondary)", margin: 0 }}>This wording appears in the saved information below.</p>
                  )}
                  {claim.support_status === "matched_historical_only" && (
                    <p style={{ fontSize: "11px", color: "var(--theme-warning-fg)", margin: 0 }}>This wording appears only in an earlier or corrected record. It is not treated as current information.</p>
                  )}
                  {claim.support_status === "not_matched_to_saved_wording" && (
                    <p style={{ fontSize: "11px", color: "var(--theme-warning-fg)", margin: 0 }}>We could not match this statement to the wording in a saved record. Check it before relying on it.</p>
                  )}
                  {claim.source_references.map((source, index) => (
                    <div key={(source.record_type ?? "source") + "-" + (source.record_id ?? index)} style={{ borderTop: "1px solid var(--border)", paddingTop: "6px" }}>
                      <p style={{ fontSize: "11px", fontWeight: 600, margin: 0 }}>{source.label || "Saved care information"}</p>
                      {source.occurred_at && <p style={{ fontSize: "11px", color: "var(--text-secondary)", margin: "3px 0 0" }}>When it happened: {new Date(source.occurred_at).toLocaleString()}</p>}
                      {source.recorded_at && <p style={{ fontSize: "11px", color: "var(--text-secondary)", margin: "3px 0 0" }}>When it was recorded: {new Date(source.recorded_at).toLocaleString()}</p>}
                      {source.reported_by && <p style={{ fontSize: "11px", color: "var(--text-secondary)", margin: "3px 0 0" }}>Reported by: {source.reported_by}</p>}
                      {source.entered_by && <p style={{ fontSize: "11px", color: "var(--text-secondary)", margin: "3px 0 0" }}>Recorded by: {source.entered_by}</p>}
                      {source.source_state_label && <p style={{ fontSize: "11px", color: "var(--theme-warning-fg)", margin: "3px 0 0" }}>{source.source_state_label}</p>}
                      {source.source_excerpt && <blockquote style={{ fontSize: "11px", lineHeight: 1.5, margin: "5px 0 0", paddingLeft: "8px", borderLeft: "2px solid var(--border)" }}>{source.source_excerpt}</blockquote>}
                    </div>
                  ))}
                </section>
              ))}
            </div>
          )}
          {/* Source details are shown beside the statements they support above; avoid a generic list of unrelated source IDs. */}
          )}
        </div>
      )}
    </section>
  );
}
