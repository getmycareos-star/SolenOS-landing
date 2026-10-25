"use client";

import { useEffect, useState } from "react";
import {
  requestQwenSupport,
  type QwenSupportResponse,
  type QwenSupportWorkflow,
} from "@/api/client";

const WORKFLOWS: Array<{ value: QwenSupportWorkflow; label: string }> = [
  { value: "daily_capture", label: "Daily Capture" },
  { value: "document", label: "Documents" },
  { value: "community", label: "Community experiences" },
  { value: "appointment", label: "Appointment preparation" },
  { value: "after_appointment", label: "After-appointment follow-up" },
  { value: "handoff", label: "Care handoff" },
  { value: "professional_summary", label: "Professional summary draft" },
  { value: "open_loops", label: "Open loops and pending actions" },
  { value: "two_week_review", label: "Two-week care review" },
  { value: "decision_outcome", label: "Decision and outcome notes" },
  { value: "medication_day", label: "Medication observations and questions" },
  { value: "living_care_record", label: "Living Care Record explanation" },
];

const WORKFLOW_DESCRIPTIONS: Record<QwenSupportWorkflow, string> = {
  daily_capture: "Organize what you observed today. Saved observations remain separate from Qwen suggestions.",
  document: "Ask for help understanding text from a care document. Include the relevant passage or question.",
  community: "Reflect on a caregiving experience. Peer stories are not verified care facts or clinical advice.",
  appointment: "Prepare questions for an appointment from what is recorded and what you provide.",
  after_appointment: "Organize the appointment outcome and follow-up details you actually know.",
  handoff: "Clarify a caregiver-to-caregiver handoff without creating or sending one.",
  professional_summary: "Draft a source-grounded summary to review before sharing with a professional.",
  open_loops: "Review recorded pending actions and handoffs without marking anything complete.",
  two_week_review: "Review recorded events from the last fourteen days and what remains unclear.",
  decision_outcome: "Organize a decision, its stated basis, and any recorded outcome.",
  medication_day: "Organize recorded medication observations and questions. Qwen cannot advise medication changes.",
  living_care_record: "Explain the authorized care context and identify what is known, uncertain, or missing.",
};

/**
 * Qwen is an optional language-support layer. This component never writes model
 * output to the Living Care Record and never fabricates a fallback reply.
 */
export default function QwenSupportPanel({
  workflow,
  evidenceIds = [],
  appointmentId,
}: {
  workflow?: QwenSupportWorkflow;
  evidenceIds?: string[];
  appointmentId?: string;
}) {
  const [selectedWorkflow, setSelectedWorkflow] = useState<QwenSupportWorkflow>(
    workflow ?? "living_care_record",
  );
  const [text, setText] = useState("");
  const [response, setResponse] = useState<QwenSupportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (workflow) setSelectedWorkflow(workflow);
  }, [workflow]);

  async function submit() {
    const message = text.trim();
    if (!message || loading) return;
    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      const result = await requestQwenSupport({
        workflow: selectedWorkflow,
        text: message,
        evidence_ids: evidenceIds,
        appointment_id: appointmentId,
      });
      if (!result.ai_generated || result.provider_status !== "available" || result.written_to_lcr !== false) {
        setError("Qwen did not confirm a valid model-generated response. Nothing was written to the Living Care Record.");
        return;
      }
      setResponse(result);
    } catch {
      setError("Qwen is unavailable or could not produce a clear response. Nothing was written to the Living Care Record. Your text is still here so you can retry.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      className="qwen-support-panel"
      aria-labelledby="qwen-support-heading"
      style={{
        border: "1px solid var(--border, #d8dee8)",
        borderRadius: 16,
        padding: 16,
        margin: "20px 0",
        background: "var(--surface, #fff)",
        color: "var(--text, #172033)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span aria-hidden="true" style={{ fontSize: 20 }}>✳</span>
        <div>
          <h2 id="qwen-support-heading" style={{ margin: 0, fontSize: 17, fontWeight: 650 }}>
            Qwen support
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-secondary, #596579)" }}>
            Optional assistance, not the authority.
          </p>
        </div>
      </div>

      {!workflow && (
        <label style={{ display: "grid", gap: 6, margin: "12px 0" }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>What would you like help with?</span>
          <select
            value={selectedWorkflow}
            onChange={(event) => setSelectedWorkflow(event.target.value as QwenSupportWorkflow)}
            disabled={loading}
            style={{ width: "100%", padding: 10, borderRadius: 9, border: "1px solid var(--border, #cbd5e1)", background: "var(--surface, #fff)", color: "inherit" }}
          >
            {WORKFLOWS.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </label>
      )}

      <p style={{ margin: "8px 0 12px", fontSize: 13, lineHeight: 1.5, color: "var(--text-secondary, #596579)" }}>
        {WORKFLOW_DESCRIPTIONS[selectedWorkflow]}
      </p>
      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Your question or details</span>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={8000}
          rows={3}
          placeholder="Tell Qwen what you want help organizing…"
          disabled={loading}
          style={{ width: "100%", boxSizing: "border-box", padding: 11, borderRadius: 9, border: "1px solid var(--border, #cbd5e1)", background: "var(--surface, #fff)", color: "inherit", resize: "vertical" }}
        />
      </label>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 10 }}>
        <span style={{ fontSize: 12, color: "var(--text-secondary, #596579)" }}>No model output is saved to the care record.</span>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!text.trim() || loading}
          style={{ border: 0, borderRadius: 9, padding: "10px 14px", fontWeight: 650, background: "var(--accent, #2458a6)", color: "#fff", opacity: !text.trim() || loading ? 0.6 : 1, cursor: !text.trim() || loading ? "not-allowed" : "pointer" }}
        >
          {loading ? "Asking Qwen…" : "Ask Qwen"}
        </button>
      </div>

      {error && (
        <p role="alert" style={{ marginTop: 12, color: "var(--danger, #b42318)", fontSize: 14, lineHeight: 1.5 }}>
          {error}
        </p>
      )}
      {response && (
        <div role="status" aria-live="polite" style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border, #d8dee8)" }}>
          <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{response.reply}</p>
          <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--text-secondary, #596579)" }}>
            Generated by the configured local Qwen model · {response.model}. This is a suggestion for review, not a confirmed care fact. The Living Care Record was not changed.
          </p>
        </div>
      )}
    </section>
  );
}
