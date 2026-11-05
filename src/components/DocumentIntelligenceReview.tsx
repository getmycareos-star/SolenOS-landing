"use client";

import { useCallback, useEffect, useState } from "react";
import { ensureAnonymousSession, getJSON, postJSON } from "@/api/client";

type Candidate = {
  subject: string;
  observation: string;
  source_quote: string;
  review_status: string;
  review_decision?: string;
};
type Analysis = {
  analysis_id: string;
  source_evidence_id: string;
  document_name: string;
  observations: Candidate[];
  open_questions?: string[];
  review_required: boolean;
  intelligence_status?: string;
  extractedText?: string;
};
type ListResponse = { items?: Analysis[] };
type LibraryDocument = { id: string; title: string };

export default function DocumentIntelligenceReview({ refreshToken = 0, documents = [] }: { refreshToken?: number; documents?: LibraryDocument[] }) {
  const [items, setItems] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [corrections, setCorrections] = useState<Record<string, { subject: string; observation: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await ensureAnonymousSession();
      const result = await getJSON("/documents/intelligence") as ListResponse;
      const summaries = Array.isArray(result.items) ? result.items : [];
      const hydrated = await Promise.all(summaries.map(async (item) => {
        try {
          const detail = await getJSON("/documents/analyses/" + encodeURIComponent(item.analysis_id)) as { extracted_text?: string };
          return { ...item, extractedText: typeof detail.extracted_text === "string" ? detail.extracted_text : "" };
        } catch { return { ...item, extractedText: "" }; }
      }));
      setItems(hydrated);
    } catch {
      setError("Saved document reviews could not be loaded. Retry without re-uploading the original.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load, refreshToken]);


  const extractAndAnalyze = async (document: LibraryDocument) => {
    const key = "extract:" + document.id;
    setBusy(key);
    setError(null);
    try {
      await postJSON("/documents/" + encodeURIComponent(document.id) + "/extract", {});
      let interpretationFailed = false;
      try {
        await postJSON("/documents/" + encodeURIComponent(document.id) + "/intelligence", {});
      } catch {
        interpretationFailed = true;
      }
      await load();
      if (interpretationFailed) {
        setError("The original and server extraction are saved, but document understanding did not finish. Retry it from the review list.");
      }
    } catch {
      setError("Server extraction could not be completed for this saved document. The original remains preserved.");
    } finally {
      setBusy(null);
    }
  };

  const analyze = async (analysis: Analysis) => {
    const key = "analyze:" + analysis.analysis_id;
    setBusy(key);
    setError(null);
    try {
      await postJSON("/documents/" + encodeURIComponent(analysis.source_evidence_id) + "/intelligence", {});
      await load();
    } catch {
      setError("Document understanding is not available yet. The original and extracted text remain saved; retry when document analysis is available.");
    } finally {
      setBusy(null);
    }
  };

  const decide = async (analysis: Analysis, index: number, decision: "accept" | "reject" | "correct") => {
    const key = analysis.analysis_id + ":" + index;
    setBusy(key);
    setError(null);
    try {
      const correction = corrections[key];
      await postJSON("/documents/intelligence/" + encodeURIComponent(analysis.analysis_id) + "/review", {
        candidate_index: index,
        decision,
        ...(decision === "correct" ? {
          corrected_subject: correction?.subject ?? analysis.observations[index].subject,
          corrected_observation: correction?.observation ?? analysis.observations[index].observation,
        } : {}),
      });
      await load();
    } catch {
      setError("The review decision was not saved. Check the connection and retry; the original document remains unchanged.");
    } finally {
      setBusy(null);
    }
  };

  if (loading && items.length === 0) {
    return <section aria-label="Document intelligence review" style={{ marginTop: 18, padding: 14, border: "1px solid var(--border)", borderRadius: 12, background: "var(--surface)" }}><p role="status">Loading saved document understanding…</p></section>;
  }

  return (
    <section aria-label="Document intelligence review" style={{ marginTop: 18, padding: 14, border: "1px solid var(--border)", borderRadius: 12, background: "var(--surface)", display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div><h2 style={{ margin: 0, fontSize: 17 }}>Document understanding</h2><p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>Review each extracted statement before it enters the Living Care Record.</p></div>
        <button type="button" onClick={() => void load()} disabled={loading || busy !== null} style={{ minHeight: 38, padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--text)" }}>Refresh</button>
      </div>
      {error && <p role="alert" style={{ margin: 0, fontSize: 13 }}>{error}</p>}
      {documents.filter((document) => !items.some((item) => item.source_evidence_id === document.id)).length > 0 && <div style={{ display: "grid", gap: 8 }}><strong style={{ fontSize: 13 }}>Saved documents awaiting server extraction</strong>{documents.filter((document) => !items.some((item) => item.source_evidence_id === document.id)).map((document) => <div key={document.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", padding: 9, border: "1px solid var(--border)", borderRadius: 8 }}><span style={{ fontSize: 13, overflowWrap: "anywhere" }}>{document.title}</span><button type="button" disabled={busy !== null} onClick={() => void extractAndAnalyze(document)} style={{ minHeight: 36, padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 7, background: "var(--surface)", color: "var(--text)" }}>Extract and understand</button></div>)}</div>}
      {!items.length && documents.length === 0 ? <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 14 }}>No saved document analyses yet. Upload a text-based document and run server extraction to begin review.</p> : items.map((analysis) => (
        <article key={analysis.analysis_id} style={{ display: "grid", gap: 10, padding: 12, border: "1px solid var(--border)", borderRadius: 10 }}>
          <div><strong style={{ overflowWrap: "anywhere" }}>{analysis.document_name || "Uploaded document"}</strong><p style={{ margin: "3px 0 0", color: "var(--text-secondary)", fontSize: 12 }}>Source document · {analysis.observations.length} candidate statement(s)</p></div>
          {analysis.extractedText && <details style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 9 }}><summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 650 }}>Persisted server-extracted text</summary><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 12, lineHeight: 1.5, maxHeight: 260, overflow: "auto" }}>{analysis.extractedText}</pre></details>}
          {analysis.intelligence_status !== "available" && <div style={{ display: "grid", gap: 7 }}><p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>Document understanding has not completed. The original file and server-extracted text remain saved; no LCR facts were created.</p><button type="button" disabled={busy !== null} onClick={() => void analyze(analysis)} style={{ justifySelf: "start", minHeight: 38, padding: "7px 11px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--text)" }}>Run / retry document understanding</button></div>}
          {analysis.intelligence_status === "available" && analysis.observations.length === 0 && <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>Document understanding found no care statements. No LCR facts were created.</p>}
          {analysis.observations.map((candidate, index) => {
            const key = analysis.analysis_id + ":" + index;
            const pending = candidate.review_status === "pending_review" || candidate.review_status === "corrected_pending_approval";
            const statusPresentation = pending
              ? { label: candidate.review_status === "corrected_pending_approval" ? "CORRECTION AWAITING APPROVAL" : "PENDING CAREGIVER REVIEW", border: "#8c8067", background: "#f3f0e7", color: "#4d4437" }
              : candidate.review_status === "accepted_by_caregiver"
                ? { label: "ACCEPTED INTO LCR", border: "#8eae8a", background: "#e4eee1", color: "#243b27" }
                : candidate.review_status === "rejected_by_caregiver"
                  ? { label: "REJECTED — NOT ADDED", border: "#999999", background: "#eeeeee", color: "#444444" }
                  : { label: candidate.review_status.replaceAll("_", " ").toUpperCase(), border: "var(--border)", background: "var(--surface)", color: "var(--text)" };
            const correction = corrections[key] || { subject: candidate.subject, observation: candidate.observation };
            return <div key={key} style={{ display: "grid", gap: 8, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}><strong style={{ fontSize: 14 }}>{candidate.subject}</strong><span aria-label={statusPresentation.label} style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.02em", padding: "4px 8px", borderRadius: 999, border: "1px solid " + statusPresentation.border, background: statusPresentation.background, color: statusPresentation.color }}>{statusPresentation.label}</span></div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{candidate.observation}</p>
              <div style={{ padding: 10, borderRadius: 8, background: "var(--bg)", border: "1px solid var(--border)" }}><span style={{ display: "block", marginBottom: 4, fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>EXACT SOURCE QUOTATION</span><p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{candidate.source_quote}</p></div>
              {pending && <>
                <label style={{ display: "grid", gap: 4, fontSize: 12 }}>Corrected subject<input value={correction.subject} maxLength={120} onChange={(event) => setCorrections((old) => ({ ...old, [key]: { ...correction, subject: event.target.value } }))} style={{ minHeight: 38, padding: 8, border: "1px solid var(--border)", borderRadius: 7, background: "var(--surface)", color: "var(--text)" }} /></label>
                <label style={{ display: "grid", gap: 4, fontSize: 12 }}>Corrected interpretation<textarea value={correction.observation} maxLength={500} rows={2} onChange={(event) => setCorrections((old) => ({ ...old, [key]: { ...correction, observation: event.target.value } }))} style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 7, background: "var(--surface)", color: "var(--text)", resize: "vertical" }} /></label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <button type="button" disabled={busy !== null} onClick={() => void decide(analysis, index, "accept")} style={{ minHeight: 38, padding: "7px 11px", border: "1px solid #8eae8a", borderRadius: 8, background: "#b9d5b5", color: "#17251c", fontWeight: 700 }}>Accept into LCR</button>
                  <button type="button" disabled={busy !== null} onClick={() => void decide(analysis, index, "correct")} style={{ minHeight: 38, padding: "7px 11px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--text)" }}>Save correction for approval</button>
                  <button type="button" disabled={busy !== null} onClick={() => void decide(analysis, index, "reject")} style={{ minHeight: 38, padding: "7px 11px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--text)" }}>Reject</button>
                </div>
              </>}
              {candidate.review_status === "accepted_by_caregiver" && <p style={{ margin: 0, fontSize: 12 }}>Caregiver accepted. A source-linked, attributed assertion was saved to the LCR; it is not independently verified clinical fact.</p>}
              {candidate.review_status === "rejected_by_caregiver" && <p style={{ margin: 0, fontSize: 12 }}>Rejected. No LCR assertion was created.</p>}
            </div>;
          })}
          {(analysis.open_questions || []).length > 0 && <div><strong style={{ fontSize: 12 }}>Questions that remain open</strong><ul style={{ margin: "5px 0 0", paddingLeft: 20, fontSize: 13 }}>{analysis.open_questions?.map((question, i) => <li key={i}>{question}</li>)}</ul></div>}
        </article>
      ))}
    </section>
  );
}
