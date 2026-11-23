"use client";

import { useEffect, useState } from "react";
import { getJSON, postJSON } from "@/api/client";
import { caregiverSafeGeneratedText } from "@/lib/caregiver-language";

type CaptureCandidate = {
  subject?: string;
  observation?: string;
  source_quote?: string;
  corrected_subject?: string;
  corrected_observation?: string;
  review_status?: string;
};

function candidateReviewValues(candidate: CaptureCandidate) {
  const safeSubject = caregiverSafeGeneratedText(candidate.subject);
  const safeObservation = caregiverSafeGeneratedText(candidate.observation);
  const correctedSubject = typeof candidate.corrected_subject === "string" && candidate.corrected_subject.trim()
    ? candidate.corrected_subject
    : null;
  const correctedObservation = typeof candidate.corrected_observation === "string" && candidate.corrected_observation.trim()
    ? candidate.corrected_observation
    : null;
  const subject = correctedSubject ?? safeSubject ?? "";
  const observation = correctedObservation ?? safeObservation ?? "";
  return {
    safeSubject,
    safeObservation,
    subject,
    observation,
    needsRewrite: !subject.trim() || !observation.trim(),
  };
}

type CaptureAnalysisPayload = {
  analysis_id: string;
  extraction_status?: string;
  candidates?: { observations?: CaptureCandidate[] };
  review_required?: boolean;
  written_to_lcr?: boolean;
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
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

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
    const values = candidateReviewValues(candidate);
    const draft = drafts[index] || {
      subject: values.subject,
      observation: values.observation,
    };
    if (decision === "accept" && values.needsRewrite) {
      setFeedback("Check the original note and correct this suggestion before adding it to your Care Record.");
      return;
    }
    if (decision === "correct" && (!draft.subject.trim() || !draft.observation.trim())) {
      setFeedback("Enter both what this detail is about and what happened before saving a correction.");
      return;
    }
    setBusyIndex(index);
    setFeedback("");
    try {
      const expectedReviewStatus = decision === "accept"
        ? "accepted_by_caregiver"
        : decision === "correct"
          ? "corrected_pending_approval"
          : "rejected_by_caregiver";
      let writeMessage: string | undefined;
      let writeFailed = false;
      try {
        const result = await postJSON(`/capture/analyses/${encodeURIComponent(analysisId)}/review`, {
          candidate_index: index,
          decision,
          // Bind the caregiver decision to the exact source suggestion shown.
          // The backend requires both values to reject stale review snapshots.
          expected_source_quote: candidate.source_quote ?? "",
          expected_subject: candidate.subject ?? "",
          corrected_subject: decision === "correct" ? draft.subject.trim() || undefined : undefined,
          corrected_observation: decision === "correct" ? draft.observation.trim() || undefined : undefined,
        }) as { message?: string };
        writeMessage = result.message;
      } catch {
        // A lost response does not prove that the server transaction failed.
        writeFailed = true;
      }

      try {
        // The persisted analysis is the source of truth, not the POST receipt
        // or optimistic component state. This also resolves a lost response
        // without asking the caregiver to submit the same decision twice.
        const persisted = await getJSON(
          `/capture/analyses/${encodeURIComponent(analysisId)}`
        ) as CaptureAnalysisPayload;
        const persistedCandidate = persisted.candidates?.observations?.[index];
        if (
          !persistedCandidate
          || persistedCandidate.review_status !== expectedReviewStatus
          || (decision === "accept" && persisted.written_to_lcr !== true)
        ) {
          throw new Error("The saved review could not be independently verified");
        }
        setAnalysis(persisted);
        if (decision === "correct") setEditingIndex(null);
        setFeedback(writeFailed
          ? "Your review was saved and confirmed after reconnecting."
          : writeMessage || (decision === "accept"
            ? "The reviewed detail was added to the care record."
            : decision === "correct"
              ? "Correction saved. It still needs approval before it becomes part of the care record."
              : "Suggestion dismissed. No care-record detail was added."));
        if (decision === "accept") {
          window.dispatchEvent(new Event("careRecordUpdated"));
        }
        onReviewed?.();
      } catch {
        setFeedback("We couldn’t confirm whether this review was saved. Your original care entry is still saved. Reopen the review before trying again.");
      }
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
        <h3 style={{ margin: 0, fontSize: "calc(16px * var(--solenos-text-scale, 1))" }}>Review suggested details</h3>
        <button type="button" onClick={onClose} aria-label="Close review">Close</button>
      </div>
      <p style={{ color: "var(--text-secondary)", fontSize: "calc(13px * var(--solenos-text-scale, 1))" }}>
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
        const values = candidateReviewValues(candidate);
        const draft = drafts[index] || {
          subject: values.subject,
          observation: values.observation,
        };
        return (
          <article key={index} style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 12 }}>
            <strong>Suggested detail {index + 1}</strong>
            <p style={{ color: "var(--text-secondary)", fontSize: "calc(13px * var(--solenos-text-scale, 1))" }}>
              {status === "accepted_by_caregiver" ? "Accepted and added to the care record"
                : status === "rejected_by_caregiver" ? "Dismissed"
                  : status === "corrected_pending_approval" || status === "corrected_by_caregiver"
                    ? "Correction saved — waiting for approval" : "Waiting for your review"}
            </p>
            {values.needsRewrite && !final ? (
              <p role="status" style={{ color: "var(--text-secondary)", fontSize: "calc(13px * var(--solenos-text-scale, 1))" }}>
                We could not show this suggestion clearly. Check the original note and correct it before adding it to your Care Record.
              </p>
            ) : null}
            <div style={{ marginBottom: 8 }}>
              <strong>What is this about?</strong>
              {editingIndex === index ? (
                <input
                  aria-label={`Suggested detail subject ${index + 1}`}
                  value={draft.subject}
                  disabled={busyIndex !== null}
                  onChange={(event) => setDrafts((current) => ({
                    ...current,
                    [index]: { ...draft, subject: event.target.value },
                  }))}
                  maxLength={160}
                  style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 4 }}
                />
              ) : <p>{draft.subject || "Not specified"}</p>}
            </div>
            <div style={{ marginBottom: 8 }}>
              <strong>What was reported?</strong>
              {editingIndex === index ? (
                <textarea
                  aria-label={`Suggested detail observation ${index + 1}`}
                  value={draft.observation}
                  disabled={busyIndex !== null}
                  onChange={(event) => setDrafts((current) => ({
                    ...current,
                    [index]: { ...draft, observation: event.target.value },
                  }))}
                  maxLength={500}
                  rows={3}
                  style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 4 }}
                />
              ) : <p>{draft.observation || "No details were provided."}</p>}
            </div>
            {candidate.source_quote ? (
              <blockquote style={{ margin: "8px 0", padding: "8px 12px", borderLeft: "3px solid var(--border)", color: "var(--text-secondary)", fontSize: "calc(13px * var(--solenos-text-scale, 1))" }}>
                <strong>From your note</strong>
                <p style={{ margin: "4px 0 0" }}>{candidate.source_quote}</p>
              </blockquote>
            ) : (
              <p style={{ color: "var(--text-secondary)", fontSize: "calc(13px * var(--solenos-text-scale, 1))" }}>The original quotation is not available in this review.</p>
            )}
            {!final ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {editingIndex === index ? (
                  <>
                    <button type="button" disabled={busyIndex !== null || !draft.subject.trim() || !draft.observation.trim()} onClick={() => void review(index, "correct")}>
                      Save correction
                    </button>
                    <button
                      type="button"
                      disabled={busyIndex !== null}
                      onClick={() => {
                        setDrafts((current) => ({
                          ...current,
                          [index]: {
                            subject: values.subject,
                            observation: values.observation,
                          },
                        }));
                        setEditingIndex(null);
                      }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" disabled={busyIndex !== null || values.needsRewrite} onClick={() => void review(index, "accept")}>
                      Accept and add to care record
                    </button>
                    <button type="button" disabled={busyIndex !== null} onClick={() => setEditingIndex(index)}>
                      Correct
                    </button>
                    <button type="button" disabled={busyIndex !== null} onClick={() => void review(index, "reject")}>
                      Dismiss
                    </button>
                  </>
                )}
              </div>
            ) : null}
          </article>
        );
      })}
      {feedback ? <p role="status">{feedback}</p> : null}
    </section>
  );
}
