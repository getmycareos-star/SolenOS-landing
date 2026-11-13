"use client";

import { useEffect, useState } from "react";
import { getJSON, postJSON } from "@/api/client";

type CaptureCandidate = {
  subject?: string;
  observation?: string;
  source_quote?: string;
  corrected_subject?: string;
  corrected_observation?: string;
  review_status?: string;
};

type CaptureAnalysisPayload = {
  analysis_id: string;
  extraction_status?: string;
  candidates?: { observations?: CaptureCandidate[] };
  review_required?: boolean;
};

export default function CaptureAnalysisReview({
  analysisId,
  onClose,
  onReviewed,
}: {
  analysisId: string;
  onClose: () => void;
  onReviewed?: () => void;
}) {
  const [analysis, setAnalysis] = useState<CaptureAnalysisPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyIndex, setBusyIndex] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, { subject: string; observation: string }>>({});
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void getJSON(`/capture/analyses/${encodeURIComponent(analysisId)}`)
      .then((result) => {
        if (!active) return;
        setAnalysis(result as CaptureAnalysisPayload);
      })
      .catch(() => {
        if (active) setError("These suggested details could not be loaded. Your original care entry is still saved.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [analysisId]);

  async function review(index: number, decision: "accept" | "correct" | "reject") {
    const candidate = analysis?.candidates?.observations?.[index];
    if (!candidate) return;
    const draft = drafts[index] || {
      subject: candidate.corrected_subject ?? candidate.subject ?? "",
      observation: candidate.corrected_observation ?? candidate.observation ?? "",
    };
    if (decision === "correct" && !(draft.subject.trim() || draft.observation.trim())) {
      setFeedback("Enter a correction before saving it.");
      return;
    }
    setBusyIndex(index);
    setFeedback("");
    try {
      const result = await postJSON(`/capture/analyses/${encodeURIComponent(analysisId)}/review`, {
        candidate_index: index,
        decision,
        corrected_subject: decision === "correct" ? draft.subject.trim() || undefined : undefined,
        corrected_observation: decision === "correct" ? draft.observation.trim() || undefined : undefined,
      }) as { candidate?: CaptureCandidate; written_to_lcr?: boolean; message?: string };
      if (!result.candidate || result.written_to_lcr !== (decision === "accept")) {
        throw new Error("Review was not confirmed");
      }
      setAnalysis((current) => {
        if (!current?.candidates?.observations) return current;
        const observations = [...current.candidates.observations];
        observations[index] = result.candidate as CaptureCandidate;
        return {
          ...current,
          candidates: { ...current.candidates, observations },
          review_required: observations.some((item) =>
            ["pending_review", "corrected_pending_approval", "corrected_by_caregiver"].includes(item.review_status || "pending_review")
          ),
        };
      });
      setFeedback(result.message || (decision === "accept"
        ? "The reviewed detail was added to the care record."
        : decision === "correct"
          ? "Correction saved. It still needs approval before it becomes part of the care record."
          : "Suggestion dismissed. No care-record detail was added."));
      if (decision === "accept") {
        window.dispatchEvent(new Event("careRecordUpdated"));
      }
      onReviewed?.();
    } catch {
      setFeedback("We couldn’t save that review. Your original care entry is still saved.");
    } finally {
      setBusyIndex(null);
    }
  }

  return (
    <section aria-label="Review suggested care details" style={{
      border: "1px solid var(--border)", borderRadius: 10, padding: 16,
      margin: "12px 0", background: "var(--surface)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>Review suggested details</h3>
        <button type="button" onClick={onClose} aria-label="Close review">Close</button>
      </div>
      <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
        These suggestions are not part of the care record until you accept them.
      </p>
      {loading ? <p role="status">Loading saved suggestions…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {!loading && !error && (analysis?.candidates?.observations || []).length === 0
        ? <p>No suggested details are waiting for review.</p>
        : null}
      {!loading && !error && (analysis?.candidates?.observations || []).map((candidate, index) => {
        const status = candidate.review_status || "pending_review";
        const final = status === "accepted_by_caregiver" || status === "rejected_by_caregiver";
        const draft = drafts[index] || {
          subject: candidate.corrected_subject ?? candidate.subject ?? "",
          observation: candidate.corrected_observation ?? candidate.observation ?? "",
        };
        return (
          <article key={index} style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 12 }}>
            <strong>Suggested detail {index + 1}</strong>
            <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
              {status === "accepted_by_caregiver" ? "Accepted and added to the care record"
                : status === "rejected_by_caregiver" ? "Dismissed"
                  : status === "corrected_pending_approval" || status === "corrected_by_caregiver"
                    ? "Correction saved — waiting for approval" : "Waiting for your review"}
            </p>
            <label style={{ display: "block", marginBottom: 8 }}>
              What is this about?
              <input
                aria-label={`Suggested detail subject ${index + 1}`}
                value={draft.subject}
                disabled={final || busyIndex !== null}
                onChange={(event) => setDrafts((current) => ({
                  ...current,
                  [index]: { ...draft, subject: event.target.value },
                }))}
                maxLength={160}
                style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 4 }}
              />
            </label>
            <label style={{ display: "block", marginBottom: 8 }}>
              What was reported?
              <textarea
                aria-label={`Suggested detail observation ${index + 1}`}
                value={draft.observation}
                disabled={final || busyIndex !== null}
                onChange={(event) => setDrafts((current) => ({
                  ...current,
                  [index]: { ...draft, observation: event.target.value },
                }))}
                maxLength={500}
                rows={3}
                style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 4 }}
              />
            </label>
            {candidate.source_quote ? (
              <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>From your note: {candidate.source_quote}</p>
            ) : null}
            {!final ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button type="button" disabled={busyIndex !== null} onClick={() => void review(index, "accept")}>
                  Accept and add to care record
                </button>
                <button type="button" disabled={busyIndex !== null} onClick={() => void review(index, "correct")}>
                  Save correction
                </button>
                <button type="button" disabled={busyIndex !== null} onClick={() => void review(index, "reject")}>
                  Dismiss suggestion
                </button>
              </div>
            ) : null}
          </article>
        );
      })}
      {feedback ? <p role="status">{feedback}</p> : null}
    </section>
  );
}
