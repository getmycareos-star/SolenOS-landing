"use client";

import { useState } from "react";
import { ensureAnonymousSession, getJSON, postJSON } from "@/api/client";

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

type QwenStatus = {
  available: boolean;
  model: string;
  provider: "local_ollama";
  inference_api: "ollama_native_http";
  hosted_inference_api: false;
  runtime: string;
};

const WORKFLOWS: Array<{ value: QwenWorkflow; label: string }> = [
  { value: "living_care_record", label: "Living Care Record" },
  { value: "daily_capture", label: "Daily Capture" },
  { value: "document", label: "Documents and extracted text" },
  { value: "community", label: "Community experiences" },
  { value: "appointment", label: "Appointment preparation" },
  { value: "after_appointment", label: "After-appointment notes" },
  { value: "handoff", label: "Care handoff" },
  { value: "professional_summary", label: "Professional summary" },
  { value: "open_loops", label: "Open questions and follow-ups" },
  { value: "two_week_review", label: "Two-week review" },
  { value: "decision_outcome", label: "Decision and reported outcome" },
  { value: "medication_day", label: "Medication-day observations" },
];

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
  title = "Qwen support",
  compact = false,
}: Props) {
  const [workflow, setWorkflow] = useState<QwenWorkflow>(defaultWorkflow);
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState<QwenAssistResult | null>(null);
  const [status, setStatus] = useState<QwenStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [loading, setLoading] = useState(false);

  async function checkQwen() {
    setChecking(true);
    setStatusError(null);
    try {
      // The status route is care-session scoped. Resolve the server-issued
      // bearer capability first so a healthy local model is not misreported
      // as unavailable merely because this panel was opened before session bootstrap.
      await ensureAnonymousSession();
      const result = (await getJSON("/assistant/status")) as QwenStatus;
      if (
        result?.available !== true ||
        result.provider !== "local_ollama" ||
        result.inference_api !== "ollama_native_http" ||
        result.hosted_inference_api !== false
      ) {
        throw new Error("The backend did not confirm its Railway-local Qwen runtime.");
      }
      setStatus(result);
    } catch (cause) {
      setStatus(null);
      setStatusError(cause instanceof Error ? cause.message : "Qwen runtime status could not be verified.");
    } finally {
      setChecking(false);
    }
  }

  async function askQwen() {
    const requestText = question.trim();
    if (!requestText) {
      setError("Enter what you want Qwen to help organize.");
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
        throw new Error("The backend did not confirm a real, read-only Qwen response. No substitute response was shown.");
      }
      setReply(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Qwen could not complete this request. No generated response was substituted.");
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
            Optional Qwen assistance using the Railway-hosted local model. Suggestions only; it cannot edit or overrule the Living Care Record.
          </p>
        </div>
        <button
          type="button"
          onClick={checkQwen}
          disabled={checking}
          style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "7px 10px", background: "var(--bg)", color: "var(--text)", fontSize: "12px", cursor: checking ? "wait" : "pointer" }}
        >
          {checking ? "Checking…" : "Check Qwen"}
        </button>
      </div>

      {status && (
        <p role="status" style={{ color: "var(--trust)", fontSize: "12px", marginTop: "8px" }}>
          Qwen runtime confirmed: {status.model} via {status.runtime.replaceAll("_", " ")}. No hosted inference API.
        </p>
      )}
      {statusError && <p role="alert" style={{ color: "var(--error)", fontSize: "12px", marginTop: "8px" }}>{statusError}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "10px", marginTop: "12px" }}>
        <label style={{ display: "grid", gap: "5px", fontSize: "12px", color: "var(--text-secondary)" }}>
          Workflow
          <select
            value={workflow}
            onChange={(event) => { setWorkflow(event.target.value as QwenWorkflow); setReply(null); setError(null); }}
            style={{ width: "100%", border: "1px solid var(--border)", borderRadius: "8px", padding: "9px 10px", background: "var(--bg)", color: "var(--text)", fontSize: "13px" }}
          >
            {WORKFLOWS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label style={{ display: "grid", gap: "5px", fontSize: "12px", color: "var(--text-secondary)" }}>
          What should Qwen help organize?
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            rows={compact ? 2 : 3}
            maxLength={1800}
            placeholder="Ask a focused question about the current care information…"
            style={{ width: "100%", boxSizing: "border-box", border: "1px solid var(--border)", borderRadius: "8px", padding: "10px", background: "var(--bg)", color: "var(--text)", fontSize: "13px", resize: "vertical" }}
          />
        </label>
        <div>
          <button
            type="button"
            onClick={askQwen}
            disabled={loading || !question.trim()}
            style={{ border: 0, borderRadius: "8px", padding: "9px 14px", background: loading || !question.trim() ? "var(--text-secondary)" : "var(--accent)", color: "white", fontSize: "13px", cursor: loading || !question.trim() ? "wait" : "pointer" }}
          >
            {loading ? "Qwen is working…" : "Ask Qwen"}
          </button>
        </div>
      </div>

      {error && <p role="alert" style={{ color: "var(--error)", fontSize: "12px", marginTop: "10px" }}>{error}</p>}
      {reply && (
        <div style={{ marginTop: "12px", border: "1px solid var(--border)", borderRadius: "9px", padding: "12px", background: "var(--bg)" }}>
          <p style={{ fontSize: "13px", lineHeight: 1.6, whiteSpace: "pre-wrap", margin: 0 }}>{reply.reply}</p>
          <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "10px" }}>
            Qwen suggestion · {reply.model} · human review required · not saved to the Living Care Record
          </p>
          {(reply.source_event_ids.length > 0 || reply.source_evidence_ids.length > 0) && (
            <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px" }}>
              Context used: {reply.source_event_ids.length} recorded event(s), {reply.source_evidence_ids.length} supplied evidence item(s).
            </p>
          )}
        </div>
      )}
    </section>
  );
}
