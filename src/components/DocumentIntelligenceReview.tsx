"use client";

import { useCallback, useEffect, useState } from "react";
import { ensureAnonymousSession, getJSON, postJSON } from "@/api/client";

type Candidate = {
  subject: string;
  observation: string;
  source_quote: string;
  review_status: string;
  review_decision?: string;
  page_number?: number | null;
  field_type?: string;
  event_date?: string | null;
  recorded_date?: string | null;
  extracted_at?: string;
  confidence?: number | null;
  warnings?: string[];
  canonical_candidate?: {
    candidate_id: string;
    document_id: string;
    page_number: number | null;
    source_excerpt: string;
    field_type: string;
    extracted_value: string | null;
    event_date: string | null;
    recorded_date: string | null;
    extracted_at: string;
    confidence: number | null;
    review_status: string;
    warnings: string[];
    medication_details?: { strength: string | null; dosage_instructions: string | null } | null;
  };
};
type ReviewEvent = {
  id: string;
  candidate_index: number;
  decision_version: number;
  decision: "accept" | "correct" | "reject";
  rationale?: string | null;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  resulting_assertion_id?: string | null;
  created_at?: string | null;
};
type Analysis = {
  analysis_id: string;
  source_evidence_id: string;
  document_name: string;
  document_type?: string;
  page_count?: number;
  observations: Candidate[];
  intelligence_status?: string;
  processed_page_count?: number | null;
  total_page_count?: number | null;
  processed_page_numbers?: number[];
  unprocessed_page_numbers?: number[];
  unreadable_page_numbers?: number[];
  ocr_quality_by_page?: Array<{
    page_number: number;
    mean_token_confidence: number | null;
    low_confidence_token_count: number;
    token_count: number;
    method: string;
    is_probability: false;
    handwriting_warning: string;
  }>;
  extraction_status?: string;
  open_questions?: string[];
  review_required: boolean;
  extractedText?: string;
  extractionMethod?: string;
  reviewEvents?: ReviewEvent[];
  reviewHistoryUnavailable?: boolean;
};
type ProcessingJob = { evidence_id: string; job_id: string; status: "queued" | "processing" | "failed"; attempt_count: number; error_code?: string | null };
type ListResponse = { items?: Analysis[]; processing_jobs?: ProcessingJob[] };
type LibraryDocument = { id: string; title: string };

export default function DocumentIntelligenceReview({ refreshToken = 0, documents = [], onOpenOriginal }: { refreshToken?: number; documents?: LibraryDocument[]; onOpenOriginal?: (evidenceId: string, pageNumber?: number) => void }) {
  const [items, setItems] = useState<Analysis[]>([]);
  const [processingJobs, setProcessingJobs] = useState<ProcessingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [corrections, setCorrections] = useState<Record<string, { subject: string; observation: string }>>({});
  const [textLoading, setTextLoading] = useState<Record<string, boolean>>({});
  const [textErrors, setTextErrors] = useState<Record<string, string>>({});
  const [historyLoading, setHistoryLoading] = useState<Record<string, boolean>>({});
  const [historyErrors, setHistoryErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await ensureAnonymousSession();
      const result = await getJSON("/documents/intelligence") as ListResponse;
      const summaries = Array.isArray(result.items) ? result.items : [];
      setItems(summaries);
      setProcessingJobs(Array.isArray(result.processing_jobs) ? result.processing_jobs : []);
    } catch {
      setError("Saved document reviews could not be loaded. Retry without re-uploading the original.");
    } finally {
      setLoading(false);
    }
  }, []);


  const loadReviewHistory = useCallback(async (analysisId: string) => {
    const existing = items.find((item) => item.analysis_id === analysisId);
    if (existing?.reviewEvents !== undefined || historyLoading[analysisId]) return;
    setHistoryLoading((current) => ({ ...current, [analysisId]: true }));
    setHistoryErrors((current) => ({ ...current, [analysisId]: "" }));
    try {
      const history = await getJSON("/documents/intelligence/" + encodeURIComponent(analysisId) + "/review-history") as { items?: ReviewEvent[] };
      setItems((current) => current.map((item) => item.analysis_id === analysisId
        ? { ...item, reviewEvents: Array.isArray(history.items) ? history.items : [], reviewHistoryUnavailable: false }
        : item));
    } catch {
      setHistoryErrors((current) => ({ ...current, [analysisId]: "The immutable decision history could not be retrieved. Do not interpret a missing history as no earlier decision." }));
    } finally {
      setHistoryLoading((current) => ({ ...current, [analysisId]: false }));
    }
  }, [items, historyLoading]);

  const documentKey = documents.map((document) => document.id).join("|");

  useEffect(() => { void load(); }, [load, refreshToken, documentKey]);
  useEffect(() => {
    if (!processingJobs.some((job) => job.status === "queued" || job.status === "processing")) return;
    const timer = window.setTimeout(() => { void load(); }, 3000);
    return () => window.clearTimeout(timer);
  }, [processingJobs, load]);


  const loadExtractedText = useCallback(async (analysisId: string) => {
    const existing = items.find((item) => item.analysis_id === analysisId);
    if (existing?.extractedText !== undefined || textLoading[analysisId]) return;
    setTextLoading((current) => ({ ...current, [analysisId]: true }));
    setTextErrors((current) => ({ ...current, [analysisId]: "" }));
    try {
      const detail = await getJSON("/documents/analyses/" + encodeURIComponent(analysisId)) as { extracted_text?: string; extraction_method?: string };
      setItems((current) => current.map((item) => item.analysis_id === analysisId
        ? { ...item, extractedText: typeof detail.extracted_text === "string" ? detail.extracted_text : "", extractionMethod: typeof detail.extraction_method === "string" ? detail.extraction_method : undefined }
        : item));
    } catch {
      setTextErrors((current) => ({ ...current, [analysisId]: "The persisted source text could not be retrieved. Retry without re-uploading the original." }));
    } finally {
      setTextLoading((current) => ({ ...current, [analysisId]: false }));
    }
  }, [items, textLoading]);



  const queueProcessing = async (evidenceId: string) => {
    const result = await postJSON("/documents/" + encodeURIComponent(evidenceId) + "/queue", {}) as {
      job_id?: string;
      status?: string;
    };
    if (!result.job_id || !["queued", "processing"].includes(result.status || "")) {
      throw new Error("The server did not confirm that document processing was queued.");
    }
    await load();
    window.dispatchEvent(new Event("careRecordUpdated"));
  };

  const extractAndAnalyze = async (document: LibraryDocument) => {
    const key = "extract:" + document.id;
    setBusy(key);
    setError(null);
    try {
      await queueProcessing(document.id);
    } catch {
      setError("Background processing could not be queued. The original file is still saved; retry without uploading it again.");
    } finally {
      setBusy(null);
    }
  };

  const analyze = async (analysis: Analysis) => {
    const key = analysis.analysis_id + ":analyze";
    setBusy(key);
    setError(null);
    try {
      await queueProcessing(analysis.source_evidence_id);
    } catch {
      setError("Background document understanding could not be resumed. The original and saved extraction are unchanged.");
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
      const reviewResult = await postJSON("/documents/intelligence/" + encodeURIComponent(analysis.analysis_id) + "/review", {
        candidate_index: index,
        decision,
        ...(decision === "correct" ? {
          corrected_subject: correction?.subject ?? analysis.observations[index].subject,
          corrected_observation: correction?.observation ?? analysis.observations[index].observation,
        } : {}),
      }) as { written_to_lcr?: boolean; source_record_ref?: { record_id?: string } | null };
      if (decision === "accept") {
        if (reviewResult.written_to_lcr !== true || !reviewResult.source_record_ref?.record_id) {
          throw new Error("The backend did not confirm a persistent Living Care Record assertion.");
        }
        window.dispatchEvent(new Event("careRecordUpdated"));
      }
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
        <div><h2 style={{ margin: 0, fontSize: 17 }}>Document understanding</h2><p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>The original document and extracted text are available here for review. Accept a statement before it becomes a caregiver-reviewed Living Care Record entry.</p></div>
        <button type="button" onClick={() => void load()} disabled={loading || busy !== null} style={{ minHeight: 38, padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--text)" }}>Refresh</button>
      </div>
      {error && <p role="alert" style={{ margin: 0, fontSize: 13 }}>{error}</p>}
      {items.some((item) => item.open_questions?.length) && <div role="note" style={{ padding: 10, border: "1px solid var(--border)", borderRadius: 8, display: "grid", gap: 5 }}>
        <strong style={{ fontSize: 12 }}>Document extraction notes</strong>
        {items.flatMap((item) => item.open_questions || []).map((question, index) => <p key={index} style={{ margin: 0, fontSize: 12 }}>{question}</p>)}
      </div>}
      {documents.filter((document) => !items.some((item) => item.source_evidence_id === document.id)).length > 0 && <div style={{ display: "grid", gap: 8 }}><strong style={{ fontSize: 13 }}>Saved documents</strong>{documents.filter((document) => !items.some((item) => item.source_evidence_id === document.id)).map((document) => {
        const job = processingJobs.find((item) => item.evidence_id === document.id);
        const active = job?.status === "queued" || job?.status === "processing";
        return <div key={document.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", padding: 9, border: "1px solid var(--border)", borderRadius: 8 }}>
          <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
            <span style={{ fontSize: 13, overflowWrap: "anywhere" }}>{document.title}</span>
            <span role="status" style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {active ? "Processing in the background. You can leave this page." : job?.status === "failed" ? "Background processing could not finish. The original is still saved." : "Saved original · waiting for server extraction"}
            </span>
          </div>
          {!active && <button type="button" disabled={busy !== null} onClick={() => void extractAndAnalyze(document)} style={{ minHeight: 36, padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 7, background: "var(--surface)", color: "var(--text)" }}>{job?.status === "failed" ? "Retry extraction" : "Extract and understand"}</button>}
        </div>;
      })}</div>}
      {!items.length && documents.length === 0 ? <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 14 }}>No saved document analyses yet. Upload a supported document or scan; server extraction and OCR prepare readable source text for caregiver review.</p> : items.map((analysis) => (
        <article key={analysis.analysis_id} style={{ display: "grid", gap: 10, padding: 12, border: "1px solid var(--border)", borderRadius: 10 }}>
          <div><strong style={{ overflowWrap: "anywhere" }}>{analysis.document_name || "Uploaded document"}</strong><p style={{ margin: "3px 0 0", color: "var(--text-secondary)", fontSize: 12 }}>Source document · {analysis.document_type?.replaceAll("_", " ") || "care document"} · {analysis.page_count ?? "?"} page(s) · {analysis.observations.length} candidate statement(s)</p>
            {analysis.extraction_status === "partial" && <p role="status" style={{ margin: "5px 0 0", fontSize: 12, color: "#8a5a12" }}>Original saved. Some pages could not be read; inspect the original pages before relying on extracted text.</p>}
            <p role="status" style={{ margin: "5px 0 0", fontSize: 12, color: analysis.intelligence_status === "partial" ? "#8a5a12" : "var(--text-secondary)" }}>
              {analysis.intelligence_status === "partial"
                ? `Partial document understanding · processed ${analysis.processed_page_count ?? "?"} of ${analysis.total_page_count ?? analysis.page_count ?? "?"} pages${processingJobs.some((job) => job.evidence_id === analysis.source_evidence_id && ["queued", "processing"].includes(job.status)) ? " · remaining pages are processing in the background" : ""}`
                : analysis.intelligence_status === "available" ? "Document understanding completed" : processingJobs.some((job) => job.evidence_id === analysis.source_evidence_id && ["queued", "processing"].includes(job.status)) ? "Document understanding is processing in the background" : "Document understanding not yet completed"}
              {analysis.unprocessed_page_numbers?.length ? ` · not processed: ${analysis.unprocessed_page_numbers.join(", ")}` : ""}{analysis.unreadable_page_numbers?.length ? ` · unreadable pages: ${analysis.unreadable_page_numbers.join(", ")}` : ""}
            </p>
            {!!analysis.ocr_quality_by_page?.length && <p role="note" style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
              OCR engine confidence (0–100 heuristic, not a probability): {analysis.ocr_quality_by_page.map((page) => `Page ${page.page_number}: ${page.mean_token_confidence === null ? "unavailable" : page.mean_token_confidence + "/100"}; ${page.low_confidence_token_count} low-confidence word(s) of ${page.token_count}`).join(" · ")}. Handwriting may still be misread, even when engine confidence is high.
            </p>}
            {!!analysis.open_questions?.length && <div role="note" style={{ marginTop: 7, padding: 8, border: "1px solid var(--border)", borderRadius: 7, display: "grid", gap: 4 }}>
              {analysis.open_questions.map((question, questionIndex) => <p key={questionIndex} style={{ margin: 0, fontSize: 12 }}>{question}</p>)}
            </div>}
          </div>
          <details onToggle={(event) => { if (event.currentTarget.open) void loadExtractedText(analysis.analysis_id); }} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 9 }}>
            <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 650 }}>Persisted server-extracted text</summary>
            {analysis.extractionMethod && <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>Extraction provenance: {analysis.extractionMethod.replaceAll("_", " ")}</p>}
            {analysis.extractionMethod?.includes("tesseract") && <p style={{ fontSize: 12 }}>OCR can misread names, dates and numbers. Compare each candidate quotation with the original document before accepting it.</p>}
            {textLoading[analysis.analysis_id] ? <p role="status" style={{ fontSize: 12 }}>Retrieving and verifying the saved extraction…</p>
              : textErrors[analysis.analysis_id] ? <div><p role="alert" style={{ fontSize: 12 }}>{textErrors[analysis.analysis_id]}</p><button type="button" onClick={() => void loadExtractedText(analysis.analysis_id)} style={{ minHeight: 34, padding: "5px 9px", border: "1px solid var(--border)", borderRadius: 7, background: "var(--surface)", color: "var(--text)" }}>Retry source text</button></div>
              : analysis.extractedText === undefined ? <p style={{ fontSize: 12 }}>Open to retrieve the persisted text from the server.</p>
                : analysis.extractedText ? <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 12, lineHeight: 1.5, maxHeight: 260, overflow: "auto" }}>{analysis.extractedText}</pre>
                  : <p style={{ fontSize: 12 }}>No readable server-extracted text is stored for this document.</p>}
          </details>
          {analysis.intelligence_status !== "available" && (analysis.intelligence_status !== "partial" || !!analysis.unprocessed_page_numbers?.length) && !processingJobs.some((job) => job.evidence_id === analysis.source_evidence_id && ["queued", "processing"].includes(job.status)) && <div style={{ display: "grid", gap: 7 }}><p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>Document understanding has not completed. The original file and server-extracted text remain saved; no LCR facts were created.</p><button type="button" disabled={busy !== null} onClick={() => void analyze(analysis)} style={{ justifySelf: "start", minHeight: 38, padding: "7px 11px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--text)" }}>{analysis.intelligence_status === "partial" ? "Resume remaining pages" : "Retry background processing"}</button></div>}
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
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 12, color: "var(--text-secondary)" }}>
                <span>Field: {candidate.field_type || "observation"}</span>
                <span>Source page: {candidate.page_number ? candidate.page_number : "Unresolved"}</span>
                <span>Event date: {candidate.event_date || "Not stated"}</span>
                <span>Source recorded: {candidate.recorded_date ? new Date(candidate.recorded_date).toLocaleDateString() : "Not stated in document"}</span>
                {candidate.extracted_at && <span>Extracted: {new Date(candidate.extracted_at).toLocaleString()}</span>}
              </div>
              {candidate.canonical_candidate?.medication_details && <div style={{ padding: 9, border: "1px solid var(--border)", borderRadius: 8, display: "grid", gap: 4, fontSize: 12 }}>
                <strong>Medication details — kept separate</strong>
                <span>Strength: {candidate.canonical_candidate.medication_details.strength || "Not stated"}</span>
                <span>Dosage instructions: {candidate.canonical_candidate.medication_details.dosage_instructions || "Not stated"}</span>
              </div>}
              {!!candidate.warnings?.length && <div role="note" style={{ padding: 9, border: "1px solid #b99a62", borderRadius: 8, background: "var(--surface)", display: "grid", gap: 4 }}>
                <strong style={{ fontSize: 12 }}>Needs clarification</strong>
                {candidate.warnings.map((warning, warningIndex) => <p key={warningIndex} style={{ margin: 0, fontSize: 12 }}>{warning}</p>)}
              </div>}
              <div style={{ padding: 10, borderRadius: 8, background: "var(--bg)", border: "1px solid var(--border)" }}><span style={{ display: "block", marginBottom: 4, fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>EXACT SOURCE QUOTATION</span><p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{candidate.source_quote}</p></div>
              {typeof candidate.page_number === "number" && <button type="button" onClick={() => onOpenOriginal?.(analysis.source_evidence_id, candidate.page_number ?? undefined)} disabled={!onOpenOriginal} style={{ justifySelf: "start", minHeight: 36, padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 7, background: "var(--surface)", color: "var(--text)" }}>View source page {candidate.page_number}</button>}
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
          <details onToggle={(event) => { if (event.currentTarget.open) void loadReviewHistory(analysis.analysis_id); }} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
            <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 650 }}>Caregiver review history{analysis.reviewEvents ? " · " + analysis.reviewEvents.length + " immutable event(s)" : ""}</summary>
            {historyLoading[analysis.analysis_id] ? <p role="status" style={{ fontSize: 12 }}>Retrieving saved review events…</p>
              : historyErrors[analysis.analysis_id] ? <div><p role="alert" style={{ fontSize: 12 }}>{historyErrors[analysis.analysis_id]}</p><button type="button" onClick={() => void loadReviewHistory(analysis.analysis_id)} style={{ minHeight: 34, padding: "5px 9px", border: "1px solid var(--border)", borderRadius: 7, background: "var(--surface)", color: "var(--text)" }}>Retry history</button></div>
                : analysis.reviewEvents === undefined ? <p style={{ fontSize: 12 }}>Open to retrieve the append-only caregiver decision history.</p>
                  : analysis.reviewEvents.length === 0 ? <p style={{ fontSize: 12 }}>No caregiver review decisions are recorded for this analysis.</p>
                    : <ol style={{ display: "grid", gap: 9, margin: "10px 0 0", paddingLeft: 20 }}>
                      {analysis.reviewEvents.map((event) => {
                        const after = event.after || {};
                        const subject = typeof after.subject === "string" ? after.subject : "Candidate";
                        const observation = typeof after.observation === "string" ? after.observation : "";
                        return <li key={event.id} style={{ fontSize: 12, lineHeight: 1.5 }}>
                          <strong>Candidate {event.candidate_index + 1} · version {event.decision_version} · {event.decision}</strong>
                          {event.created_at ? <span> · {new Date(event.created_at).toLocaleString()}</span> : null}
                          {observation ? <p style={{ margin: "3px 0" }}>{subject}: {observation}</p> : null}
                          {event.rationale ? <p style={{ margin: "3px 0", color: "var(--text-secondary)" }}>Caregiver note: {event.rationale}</p> : null}
                          {event.resulting_assertion_id ? <p style={{ margin: "3px 0" }}>This decision created a source-linked LCR report.</p> : null}
                        </li>;
                      })}
                    </ol>}
          </details>
          {(analysis.open_questions || []).length > 0 && <div><strong style={{ fontSize: 12 }}>Questions that remain open</strong><ul style={{ margin: "5px 0 0", paddingLeft: 20, fontSize: 13 }}>{analysis.open_questions?.map((question, i) => <li key={i}>{question}</li>)}</ul></div>}
        </article>
      ))}
    </section>
  );
}
