"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiResponseError, ensureAnonymousSession, getJSON, postJSON } from "@/api/client";
import { caregiverFieldLabel, caregiverInformationAreaLabel, caregiverSourceText, caregiverSafeAssistantText, caregiverSafeGeneratedText } from "@/lib/caregiver-language";

type Candidate = {
  candidate_index?: number;
  subject: string;
  observation: string;
  source_quote: string;
  review_status: string;
  review_decision?: string;
  longitudinal_retrieval_status?: "verified" | "unavailable" | "not_applicable";
  page_number?: number | null;
  field_type?: string;
  professional_confirmation_question_id?: string | null;
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
    source_attribution?: "patient_reported" | "caregiver_reported" | "professional_observed" | "not_stated";
    negation_status?: "explicitly_negated" | "not_explicitly_marked";
    modality?: "tentative" | "not_explicitly_marked";
    conditionality?: "conditional" | "not_explicitly_marked";
    temporal_context?: "historical" | "not_established";
    statement_kind?: "recommendation" | "not_detected";
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
  page_states?: Array<{
    source_page_number: number;
    status: "processed" | "unprocessed" | "retryable" | "retry_exhausted" | "unreadable" | "blocked";
    attempt_count: number;
  }>;
  extraction_status?: string;
  ocr_quality_by_page?: Array<{
    page_number: number;
    mean_token_confidence: number | null;
    low_confidence_token_count: number;
    token_count: number;
    method: string;
    is_probability: false;
    handwriting_warning: string;
  }>;
  model_provenance?: {
    provider?: string | null;
    model_tag?: string | null;
    processing_version?: string;
    prompt_version?: string;
    extraction_source?: string;
    source_evidence_id?: string;
    source_text_sha256?: string;
    model_authority?: string;
  } | null;
  observations: Candidate[];
  intelligence_status?: string;
  processed_page_count?: number | null;
  total_page_count?: number | null;
  processed_page_numbers?: number[];
  unprocessed_page_numbers?: number[];
  extraction_processed_page_count?: number | null;
  extraction_processed_page_numbers?: number[];
  extraction_unprocessed_page_numbers?: number[];
  retryable_page_numbers?: number[];
  retry_exhausted_page_numbers?: number[];
  blocked_page_numbers?: number[];
  unreadable_page_numbers?: number[];
  open_questions?: string[];
  review_required: boolean;
  interpretation_blocked?: boolean;
  has_more_candidates?: boolean;
  remaining_candidate_count?: number;
  extractedText?: string;
  extractionMethod?: string;
  reviewEvents?: ReviewEvent[];
  reviewHistoryUnavailable?: boolean;
};
type ProcessingJob = { evidence_id: string; job_id: string; status: "queued" | "processing" | "failed"; attempt_count: number; error_code?: string | null };
type ListResponse = { items?: Analysis[]; processing_jobs?: ProcessingJob[] };

export function documentExtractionIsComplete(analysis: Analysis): boolean {
  // Qwen's remaining page window is pending interpretation, not a failed OCR page.
  // Keep it separate so the UI can offer a continue-reading action instead of
  // falsely telling caregivers that readable source pages could not be read.
  const unresolvedPageGroups = [
    analysis.extraction_unprocessed_page_numbers,
    analysis.retryable_page_numbers,
    analysis.retry_exhausted_page_numbers,
    analysis.blocked_page_numbers,
    analysis.unreadable_page_numbers,
  ];
  const processedPageCount = analysis.extraction_processed_page_count ?? analysis.processed_page_count;
  const totalPageCount = analysis.total_page_count ?? analysis.page_count;
  const pageCountIsComplete = totalPageCount === undefined
    || (typeof processedPageCount === "number" && processedPageCount >= totalPageCount);

  return analysis.interpretation_blocked !== true
    && analysis.extraction_status === "available"
    && pageCountIsComplete
    && unresolvedPageGroups.every((pages) => (pages?.length ?? 0) === 0);
}
type LibraryDocument = { id: string; title: string };

export default function DocumentIntelligenceReview({ refreshToken = 0, documents = [], onAddClearerPages }: { refreshToken?: number; documents?: LibraryDocument[]; onAddClearerPages?: (evidenceId: string, pages: number[]) => void }) {
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
  const loadSequence = useRef(0);
  const historyRequestSequence = useRef<Record<string, number>>({});
  const textRequestSequence = useRef<Record<string, number>>({});

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    // A refreshed analysis list invalidates review-history requests based on
    // the previous snapshot. They must not overwrite the refreshed list.
    for (const analysisId of Object.keys(historyRequestSequence.current)) {
      historyRequestSequence.current[analysisId] += 1;
    }
    for (const analysisId of Object.keys(textRequestSequence.current)) {
      textRequestSequence.current[analysisId] += 1;
    }
    setHistoryLoading({});
    setTextLoading({});
    setLoading(true);
    setError(null);
    try {
      await ensureAnonymousSession();
      const result = await getJSON("/documents/intelligence") as ListResponse;
      if (sequence !== loadSequence.current) return;
      const summaries = Array.isArray(result.items) ? result.items : [];
      setItems(summaries);
      setProcessingJobs(Array.isArray(result.processing_jobs) ? result.processing_jobs : []);
    } catch {
      if (sequence !== loadSequence.current) return;
      setError("We couldn't refresh saved document reviews. The list may be out of date. Retry without re-uploading the original.");
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => () => {
    // Invalidate in-flight requests when this review panel unmounts.
    loadSequence.current += 1;
    for (const analysisId of Object.keys(historyRequestSequence.current)) {
      historyRequestSequence.current[analysisId] += 1;
    }
    for (const analysisId of Object.keys(textRequestSequence.current)) {
      textRequestSequence.current[analysisId] += 1;
    }
  }, []);

  const loadReviewHistory = useCallback(async (analysisId: string) => {
    const existing = items.find((item) => item.analysis_id === analysisId);
    if (existing?.reviewEvents !== undefined || historyLoading[analysisId]) return;
    const requestSequence = (historyRequestSequence.current[analysisId] ?? 0) + 1;
    historyRequestSequence.current[analysisId] = requestSequence;
    setHistoryLoading((current) => ({ ...current, [analysisId]: true }));
    setHistoryErrors((current) => ({ ...current, [analysisId]: "" }));
    try {
      const history = await getJSON("/documents/intelligence/" + encodeURIComponent(analysisId) + "/review-history") as { items?: ReviewEvent[] };
      if (historyRequestSequence.current[analysisId] !== requestSequence) return;
      setItems((current) => current.map((item) => item.analysis_id === analysisId
        ? { ...item, reviewEvents: Array.isArray(history.items) ? history.items : [], reviewHistoryUnavailable: false }
        : item));
    } catch {
      if (historyRequestSequence.current[analysisId] !== requestSequence) return;
      setHistoryErrors((current) => ({ ...current, [analysisId]: "The saved review history could not be loaded. A missing history does not mean no earlier decision was made." }));
    } finally {
      if (historyRequestSequence.current[analysisId] === requestSequence) {
        setHistoryLoading((current) => ({ ...current, [analysisId]: false }));
      }
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
    const requestSequence = (textRequestSequence.current[analysisId] ?? 0) + 1;
    textRequestSequence.current[analysisId] = requestSequence;
    setTextLoading((current) => ({ ...current, [analysisId]: true }));
    setTextErrors((current) => ({ ...current, [analysisId]: "" }));
    try {
      const detail = await getJSON("/documents/analyses/" + encodeURIComponent(analysisId)) as { extracted_text?: string; extraction_method?: string };
      if (textRequestSequence.current[analysisId] !== requestSequence) return;
      setItems((current) => current.map((item) => item.analysis_id === analysisId
        ? { ...item, extractedText: typeof detail.extracted_text === "string" ? detail.extracted_text : "", extractionMethod: typeof detail.extraction_method === "string" ? detail.extraction_method : undefined }
        : item));
    } catch {
      if (textRequestSequence.current[analysisId] !== requestSequence) return;
      setTextErrors((current) => ({ ...current, [analysisId]: "The saved text could not be loaded. Try again without uploading the original again." }));
    } finally {
      if (textRequestSequence.current[analysisId] === requestSequence) {
        setTextLoading((current) => ({ ...current, [analysisId]: false }));
      }
    }
  }, [items, textLoading]);



  const queueProcessing = async (evidenceId: string) => {
    const result = await postJSON("/documents/" + encodeURIComponent(evidenceId) + "/queue", {}) as {
      job_id?: string;
      status?: string;
    };
    if (!result.job_id || !["queued", "processing"].includes(result.status || "")) {
      throw new Error("SolenOS could not start reading this document. The original file is still saved.");
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
      setError("SolenOS could not start reading this document. The original file is still saved. Try again without uploading it again.");
    } finally {
      setBusy(null);
    }
  };

  const decide = async (analysis: Analysis, candidate: Candidate, candidateIndex: number, decision: "accept" | "reject" | "correct") => {
    const key = analysis.analysis_id + ":" + candidateIndex;
    setBusy(key);
    setError(null);
    try {
      const correction = corrections[key];
      const sourceQuote = typeof candidate.source_quote === "string" ? candidate.source_quote : "";
      const correctedSubject = correction?.subject ?? candidate.subject;
      if (decision === "correct" && (!correctedSubject.trim() || !sourceQuote)) {
        setError("Enter a short, clear label. The text SolenOS read will stay unchanged.");
        return;
      }
      const reviewResult = await postJSON("/documents/intelligence/" + encodeURIComponent(analysis.analysis_id) + "/review", {
        candidate_index: candidateIndex,
        decision,
        expected_source_quote: sourceQuote,
        expected_subject: candidate.subject,
        expected_observation: candidate.observation,
        expected_candidate_id: candidate.canonical_candidate?.candidate_id,
        expected_review_status: candidate.review_status,
        ...(decision === "correct" ? {
          corrected_subject: correctedSubject,
          corrected_observation: sourceQuote,
        } : {}),
      }) as {
        written_to_lcr?: boolean;
        source_record_ref?: { record_id?: string } | null;
        longitudinal_retrieval_status?: "verified" | "unavailable" | "not_applicable";
      };
      if (decision === "accept") {
        if (reviewResult.written_to_lcr !== true || !reviewResult.source_record_ref?.record_id) {
          throw new Error("SolenOS could not confirm that this detail was saved to your Care Record.");
        }
        window.dispatchEvent(new Event("careRecordUpdated"));
      }
      await load();
      if (decision === "accept" && reviewResult.longitudinal_retrieval_status !== "verified") {
        setError("Your choice was saved, but SolenOS could not confirm that it appears in your Care Record. Refresh your Care Record before relying on it.");
      }
    } catch (error) {
      if (error instanceof ApiResponseError && error.status === 409) {
        await load();
        setError("This document suggestion changed after it was displayed. The latest review is loaded; check the updated wording before deciding.");
      } else {
        setError("We couldn't confirm whether your review was saved. Refresh the review history before trying again. The original document is unchanged.");
      }
    } finally {
      setBusy(null);
    }
  };

  const showNextCandidateGroup = async (analysis: Analysis) => {
    const key = analysis.analysis_id + ":next-group";
    setBusy(key);
    setError(null);
    try {
      await postJSON("/documents/" + encodeURIComponent(analysis.source_evidence_id) + "/intelligence", {});
      await load();
    } catch {
      setError("More details from this document could not be loaded. Your saved choices are unchanged.");
    } finally {
      setBusy(null);
    }
  };

  if (loading && items.length === 0) {
    return <section aria-label="Document review" style={{ marginTop: 18, padding: 14, border: "1px solid var(--border)", borderRadius: 12, background: "var(--surface)" }}><p role="status">Loading saved document details…</p></section>;
  }

  return (
    <section aria-label="Document review" style={{ marginTop: 18, padding: 14, border: "1px solid var(--border)", borderRadius: 12, background: "var(--surface)", display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div><h2 style={{ margin: 0, fontSize: "calc(17px * var(--solenos-text-scale, 1))" }}>Review document details</h2><p style={{ margin: "4px 0 0", fontSize: "calc(13px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>You can check the original document and the text SolenOS read. Review each suggested detail before adding it to your Care Record.</p></div>
        <button type="button" onClick={() => void load()} disabled={loading || busy !== null} style={{ minHeight: 38, padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--text)" }}>Refresh</button>
      </div>
      {error && <p role="alert" style={{ margin: 0, fontSize: "calc(13px * var(--solenos-text-scale, 1))" }}>{error}</p>}
      {items.some((item) => item.open_questions?.length) && <div role="note" style={{ padding: 10, border: "1px solid var(--border)", borderRadius: 8, display: "grid", gap: 5 }}>
        <strong style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>Notes about the text we read</strong>
        {items.flatMap((item) => item.open_questions || []).map((question, index) => <p key={index} style={{ margin: 0, fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>{caregiverSafeGeneratedText(question) || "More information may be needed."}</p>)}
      </div>}
      {documents.filter((document) => !items.some((item) => item.source_evidence_id === document.id)).length > 0 && <div style={{ display: "grid", gap: 8 }}><strong style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))" }}>Saved documents</strong>{documents.filter((document) => !items.some((item) => item.source_evidence_id === document.id)).map((document) => {
        const job = processingJobs.find((item) => item.evidence_id === document.id);
        const active = job?.status === "queued" || job?.status === "processing";
        return <div key={document.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", padding: 9, border: "1px solid var(--border)", borderRadius: 8 }}>
          <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
            <span style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))", overflowWrap: "anywhere" }}>{document.title}</span>
            <span role="status" style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>
              {active ? "SolenOS is reading this document in the background. You can leave this page." : job?.status === "failed" ? "SolenOS could not finish reading this document. The original file is still saved." : "Saved original · waiting for SolenOS to read it"}
            </span>
          </div>
          {!active && <button type="button" disabled={busy !== null} onClick={() => void extractAndAnalyze(document)} style={{ minHeight: 36, padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 7, background: "var(--surface)", color: "var(--text)" }}>{job?.status === "failed" ? "Try reading again" : "Read document"}</button>}
        </div>;
      })}</div>}
      {!items.length && documents.length === 0 ? <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "calc(14px * var(--solenos-text-scale, 1))" }}>No documents are ready to review yet. Upload or scan a document. SolenOS will read the text so you can check the suggested details.</p> : items.map((analysis) => (
        <article key={analysis.analysis_id} style={{ display: "grid", gap: 10, padding: 12, border: "1px solid var(--border)", borderRadius: 10 }}>
          <div><strong style={{ overflowWrap: "anywhere" }}>{analysis.document_name || "Uploaded document"}</strong><p style={{ margin: "3px 0 0", color: "var(--text-secondary)", fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>{caregiverInformationAreaLabel(analysis.document_type) || caregiverFieldLabel(analysis.document_type) || "Care document"} · {analysis.page_count ?? "?"} {analysis.page_count === 1 ? "page" : "pages"} · {analysis.observations.length} {analysis.observations.length === 1 ? "suggested detail" : "suggested details"}</p>
            <p role="status" style={{ margin: "5px 0 0", fontSize: "calc(12px * var(--solenos-text-scale, 1))", color: analysis.intelligence_status === "partial" ? "#8a5a12" : "var(--text-secondary)" }}>
              {!documentExtractionIsComplete(analysis)
                ? `Some pages have not been fully read · ${analysis.extraction_processed_page_count ?? "?"} of ${analysis.page_count ?? analysis.total_page_count ?? "?"} pages${processingJobs.some((job) => job.evidence_id === analysis.source_evidence_id && job.status === "processing") ? " · SolenOS is reading the remaining pages in the background" : processingJobs.some((job) => job.evidence_id === analysis.source_evidence_id && job.status === "queued") ? " · SolenOS will continue when background processing starts" : ""}`
                : analysis.unprocessed_page_numbers?.length
                  ? `SolenOS has read ${analysis.processed_page_count ?? 0} of ${analysis.total_page_count ?? analysis.page_count ?? "?"} pages.${processingJobs.some((job) => job.evidence_id === analysis.source_evidence_id && job.status === "processing") ? " It is reading the remaining pages in the background." : processingJobs.some((job) => job.evidence_id === analysis.source_evidence_id && job.status === "queued") ? " It is waiting to read the remaining pages." : " The remaining pages are ready to read."}`
                  : analysis.intelligence_status === "partial"
                  ? analysis.has_more_candidates && !(analysis.retryable_page_numbers?.length) && !(analysis.unprocessed_page_numbers?.length)
                    ? `More details are ready · ${analysis.remaining_candidate_count ?? "additional"} remaining. Finish this group before continuing.`
                    : "SolenOS has read the document but has not finished reviewing all details."
                  : analysis.intelligence_status === "available" ? "All pages have been read" : processingJobs.some((job) => job.evidence_id === analysis.source_evidence_id && ["queued", "processing"].includes(job.status)) ? "SolenOS is reading the document in the background" : "SolenOS has not finished reading this document"}
              {analysis.extraction_unprocessed_page_numbers?.length ? ` · not read yet: pages ${analysis.extraction_unprocessed_page_numbers.join(", ")}` : ""}{analysis.unprocessed_page_numbers?.length ? ` · waiting to be read: pages ${analysis.unprocessed_page_numbers.join(", ")}` : ""}{analysis.retryable_page_numbers?.length ? ` · ready to try again: pages ${analysis.retryable_page_numbers.join(", ")}` : ""}{analysis.blocked_page_numbers?.length ? ` · could not be read because the file is too large: pages ${analysis.blocked_page_numbers.join(", ")}` : ""}{analysis.unreadable_page_numbers?.length ? ` · could not be read: pages ${analysis.unreadable_page_numbers.join(", ")}` : ""}{analysis.retry_exhausted_page_numbers?.length ? ` · could not be read after retries: pages ${analysis.retry_exhausted_page_numbers.join(", ")}` : ""}
            </p>
            {!documentExtractionIsComplete(analysis) && <p role="alert" style={{ margin: "5px 0 0", fontSize: "calc(12px * var(--solenos-text-scale, 1))", color: "#8a5a12" }}>Some pages could not be read. The original file is saved; check the listed pages before relying on the text we read.</p>}
            {!!analysis.page_states?.length && <details style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 9 }}>
              <summary style={{ cursor: "pointer", fontSize: "calc(12px * var(--solenos-text-scale, 1))", fontWeight: 650 }}>Page-by-page status</summary>
              <ol aria-label="Document page reading status" style={{ margin: "8px 0 0", paddingLeft: 22, display: "grid", gap: 5, fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>
                {analysis.page_states.map((page) => {
                  const label = page.status === "processed" ? "read"
                    : page.status === "unprocessed" ? "not read yet"
                    : page.status === "retryable" ? "needs another try"
                    : page.status === "retry_exhausted" ? "could not be read after several tries"
                    : page.status === "blocked" ? "could not be read because the file is too large"
                    : "could not be read clearly";
                  return <li key={page.source_page_number}>Page {page.source_page_number}: {label}{page.attempt_count > 1 ? ` · ${page.attempt_count} attempts` : ""}</li>;
                })}
              </ol>
            </details>}
            {!!analysis.unprocessed_page_numbers?.length && documentExtractionIsComplete(analysis) && !processingJobs.some((job) => job.evidence_id === analysis.source_evidence_id && ["queued", "processing"].includes(job.status)) && <button type="button" disabled={busy !== null} onClick={() => void showNextCandidateGroup(analysis)} style={{ justifySelf: "start", minHeight: 40, padding: "8px 11px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--text)", fontWeight: 650 }}>Continue reading remaining pages</button>}
            {!!(analysis.unreadable_page_numbers?.length || analysis.retry_exhausted_page_numbers?.length || analysis.blocked_page_numbers?.length || analysis.extraction_unprocessed_page_numbers?.length) && onAddClearerPages && !processingJobs.some((job) => job.evidence_id === analysis.source_evidence_id && job.status === "processing") && <div role="group" aria-label="Recover pages SolenOS could not read" style={{ display: "grid", gap: 7, padding: 10, border: "1px solid var(--border)", borderRadius: 8 }}>
              <strong style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))" }}>Some pages need another copy</strong>
              <p style={{ margin: 0, fontSize: "calc(12px * var(--solenos-text-scale, 1))", lineHeight: 1.5, color: "var(--text-secondary)" }}>SolenOS could not finish reading pages {Array.from(new Set([...(analysis.extraction_unprocessed_page_numbers || []), ...(analysis.unreadable_page_numbers || []), ...(analysis.retry_exhausted_page_numbers || []), ...(analysis.blocked_page_numbers || [])])).join(", ")}. Scan or photograph those pages again and save the copies as a separate document. This original stays unchanged, and the Care Record will not change unless you review and accept new details.</p>
              <button type="button" onClick={() => onAddClearerPages(analysis.source_evidence_id, Array.from(new Set([...(analysis.extraction_unprocessed_page_numbers || []), ...(analysis.unreadable_page_numbers || []), ...(analysis.retry_exhausted_page_numbers || []), ...(analysis.blocked_page_numbers || [])])))} disabled={busy !== null} style={{ justifySelf: "start", minHeight: 40, padding: "8px 11px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--text)", fontWeight: 650 }}>Scan these pages again</button>
            </div>}
            {!!analysis.ocr_quality_by_page?.length && <p role="note" style={{ margin: "5px 0 0", fontSize: "calc(12px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>
              Some words may be misread, especially handwriting. Check the original document before accepting suggested details. This only tells us how clearly SolenOS could read the words. It does not tell us whether the words or suggested care details are correct.
            </p>}
            {!!analysis.open_questions?.length && <div role="note" style={{ marginTop: 7, padding: 8, border: "1px solid var(--border)", borderRadius: 7, display: "grid", gap: 4 }}>
              {analysis.open_questions.map((question, questionIndex) => <p key={questionIndex} style={{ margin: 0, fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>{caregiverSafeGeneratedText(question) || "More information may be needed."}</p>)}
            </div>}
          </div>
          <details onToggle={(event) => { if (event.currentTarget.open) void loadExtractedText(analysis.analysis_id); }} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 9 }}>
            <summary style={{ cursor: "pointer", fontSize: "calc(13px * var(--solenos-text-scale, 1))", fontWeight: 650 }}>Text read from your document</summary>
            {analysis.extractionMethod?.includes("tesseract") && <p style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>SolenOS may misread names, dates and numbers, especially in handwriting. Compare each suggested detail with the original document before accepting it.</p>}
            {textLoading[analysis.analysis_id] ? <p role="status" style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>Loading the saved text…</p>
              : textErrors[analysis.analysis_id] ? <div><p role="alert" style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>{textErrors[analysis.analysis_id]}</p><button type="button" onClick={() => void loadExtractedText(analysis.analysis_id)} style={{ minHeight: 34, padding: "5px 9px", border: "1px solid var(--border)", borderRadius: 7, background: "var(--surface)", color: "var(--text)" }}>Try loading text again</button></div>
              : analysis.extractedText === undefined ? <p style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>Open to see the saved text.</p>
                : analysis.extractedText ? <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: "calc(12px * var(--solenos-text-scale, 1))", lineHeight: 1.5, maxHeight: 260, overflow: "auto" }}>{caregiverSourceText(analysis.extractedText) || "The saved text cannot be displayed in a readable form here. You can still open the original document."}</p>
                  : <p style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>No readable text was saved from this document.</p>}
          </details>
          {analysis.extraction_status === "partial" && <p role="status" style={{ margin: 0, fontSize: "calc(13px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>SolenOS could not read every page. Do not treat the suggested details as a complete account of this document.</p>}
          {processingJobs.some((job) => job.evidence_id === analysis.source_evidence_id && ["queued", "processing"].includes(job.status)) && <p role="status" style={{ margin: 0, fontSize: "calc(13px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>SolenOS is reading this document in the background. You do not need to stay on this screen.</p>}
          {(analysis.retryable_page_numbers?.length ?? 0) > 0 && <p role="status" style={{ margin: 0, fontSize: "calc(13px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>SolenOS is trying to read those pages again. The original document is still saved.</p>}
          {(analysis.retry_exhausted_page_numbers?.length ?? 0) > 0 && <p role="alert" style={{ margin: 0, fontSize: "calc(13px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>SolenOS tried several times but could not read page{analysis.retry_exhausted_page_numbers!.length === 1 ? "" : "s"} {analysis.retry_exhausted_page_numbers!.join(", ")}. No care details were added from those pages.</p>}
          {(analysis.unreadable_page_numbers?.length ?? 0) > 0 && <p role="status" style={{ margin: 0, fontSize: "calc(13px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>Page{analysis.unreadable_page_numbers!.length === 1 ? "" : "s"} {analysis.unreadable_page_numbers!.join(", ")} could not be read clearly. No care details were added from those pages.</p>}
          {(analysis.blocked_page_numbers?.length ?? 0) > 0 && <p role="status" style={{ margin: 0, fontSize: "calc(13px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>Page{analysis.blocked_page_numbers!.length === 1 ? "" : "s"} {analysis.blocked_page_numbers!.join(", ")} could not be read because the file is too large or there was a reading problem. The original document is still saved.</p>}
          {analysis.intelligence_status !== "available" && analysis.extraction_status === "available" && !processingJobs.some((job) => job.evidence_id === analysis.source_evidence_id && ["queued", "processing"].includes(job.status)) && <p style={{ margin: 0, fontSize: "calc(13px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>SolenOS has not finished reviewing this document. The original file and saved text are still available.</p>}
          {analysis.intelligence_status === "available" && analysis.observations.length === 0 && <p style={{ margin: 0, fontSize: "calc(13px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>No care-related details were found in this document. Nothing was added to your Care Record.</p>}
          {documentExtractionIsComplete(analysis) ? analysis.observations.map((candidate, index) => {
            const candidateIndex = typeof candidate.candidate_index === "number" ? candidate.candidate_index : index;
            const key = analysis.analysis_id + ":" + candidateIndex;
            const pending = candidate.review_status === "pending_review" || candidate.review_status === "corrected_pending_approval";
            const caregiverCorrected = candidate.review_status === "corrected_pending_approval";
            const safeSubject = caregiverCorrected ? candidate.subject : caregiverSafeGeneratedText(candidate.subject);
            const safeObservation = caregiverCorrected ? candidate.observation : caregiverSafeGeneratedText(candidate.observation);
            const candidateNeedsRewrite = !safeSubject || !safeObservation;
            const displaySubject = safeSubject || caregiverFieldLabel(candidate.field_type) || "Care detail";
            const correction = corrections[key] || {
              subject: safeSubject || "",
              observation: candidate.source_quote || "",
            };
            const sourceQuote = typeof candidate.source_quote === "string" ? candidate.source_quote : "";
            const hasCorrectionSubject = Boolean(correction.subject.trim());
            const statusPresentation = pending
              ? { label: candidate.review_status === "corrected_pending_approval" ? "Correction saved — waiting for approval" : "Waiting for your review", border: "#8c8067", background: "#f3f0e7", color: "#4d4437" }
              : candidate.review_status === "accepted_by_caregiver" && candidate.professional_confirmation_question_id
                ? { label: "Saved as a report — not confirmed by a healthcare professional", border: "#8c8067", background: "#f3f0e7", color: "#4d4437" }
                : candidate.review_status === "accepted_by_caregiver" && candidate.longitudinal_retrieval_status !== "verified"
                  ? { label: "Saved — Care Record display not confirmed", border: "#8c8067", background: "#f3f0e7", color: "#4d4437" }
                  : candidate.review_status === "accepted_by_caregiver"
                    ? { label: "Added to Care Record", border: "#8eae8a", background: "#e4eee1", color: "#243b27" }
                  : candidate.review_status === "rejected_by_caregiver"
                  ? { label: "Not added", border: "#999999", background: "#eeeeee", color: "#444444" }
                  : { label: "Status unavailable", border: "var(--border)", background: "var(--surface)", color: "var(--text)" };
            return <div key={key} data-testid={`document-candidate-${candidateIndex}`} style={{ display: "grid", gap: 8, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}><strong style={{ fontSize: "calc(14px * var(--solenos-text-scale, 1))" }}>{displaySubject}</strong><span aria-label={statusPresentation.label} style={{ fontSize: "calc(11px * var(--solenos-text-scale, 1))", fontWeight: 800, letterSpacing: "0.02em", padding: "4px 8px", borderRadius: 999, border: "1px solid " + statusPresentation.border, background: statusPresentation.background, color: statusPresentation.color }}>{statusPresentation.label}</span></div>
              {safeObservation
                ? <p style={{ margin: 0, fontSize: "calc(14px * var(--solenos-text-scale, 1))", lineHeight: 1.5 }}>{safeObservation}</p>
                : <p role="status" style={{ margin: 0, fontSize: "calc(13px * var(--solenos-text-scale, 1))", lineHeight: 1.5 }}>We could not show this suggested detail clearly. Check the original document and add a short label in plain words. The text SolenOS read will stay unchanged.</p>}
              {candidateNeedsRewrite && !pending && <p role="status" style={{ margin: 0, fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>This saved detail needs clearer wording. Check the original document before relying on it.</p>}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: "calc(12px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>
                <span>About: {caregiverFieldLabel(candidate.field_type) || caregiverInformationAreaLabel(candidate.field_type) || "Care details"}</span>
                <span>Page in document: {candidate.page_number ? candidate.page_number : "Not identified"}</span>
                <span>When it happened: {candidate.event_date || "Not stated"}</span>
                <span>Date shown on document: {candidate.recorded_date ? new Date(candidate.recorded_date).toLocaleDateString() : "Not stated in document"}</span>
                {candidate.extracted_at && <span>Text read on: {new Date(candidate.extracted_at).toLocaleString()}</span>}
              </div>
              {!!candidate.canonical_candidate && <div role="note" aria-label="How this statement is worded" style={{ display: "flex", flexWrap: "wrap", gap: 6, fontSize: "calc(11px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>
                {candidate.canonical_candidate.source_attribution === "patient_reported" && <span>Reported by the patient</span>}
                {candidate.canonical_candidate.source_attribution === "caregiver_reported" && <span>Reported by a family caregiver</span>}
                {candidate.canonical_candidate.source_attribution === "professional_observed" && <span>Documented or observed by a care professional</span>}
                {candidate.canonical_candidate.negation_status === "explicitly_negated" && <span>Says this did not happen</span>}
                {candidate.canonical_candidate.modality === "tentative" && <span>Not certain</span>}
                {candidate.canonical_candidate.conditionality === "conditional" && <span>Only applies in some situations</span>}
                {candidate.canonical_candidate.temporal_context === "historical" && <span>Historical information</span>}
                {candidate.canonical_candidate.statement_kind === "recommendation" && <span>A recommendation; no result has been recorded yet.</span>}
              </div>}
              {candidate.canonical_candidate?.medication_details && <div style={{ padding: 9, border: "1px solid var(--border)", borderRadius: 8, display: "grid", gap: 4, fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>
                <strong>Medicine details — not changed</strong>
                <span>Strength: {candidate.canonical_candidate.medication_details.strength || "Not stated"}</span>
                <span>How to take it: {candidate.canonical_candidate.medication_details.dosage_instructions || "Not stated"}</span>
              </div>}
              {!!candidate.warnings?.length && <div role="note" style={{ padding: 9, border: "1px solid #b99a62", borderRadius: 8, background: "var(--surface)", display: "grid", gap: 4 }}>
                <strong style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>Needs clarification</strong>
                {candidate.warnings.map((warning, warningIndex) => <p key={warningIndex} style={{ margin: 0, fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>{caregiverSafeGeneratedText(warning) || "This detail may need another look."}</p>)}
              </div>}
              <div style={{ padding: 10, borderRadius: 8, background: "var(--bg)", border: "1px solid var(--border)" }}><span style={{ display: "block", marginBottom: 4, fontSize: "calc(11px * var(--solenos-text-scale, 1))", fontWeight: 700, color: "var(--text-secondary)" }}>Text SolenOS read from the document</span><p style={{ margin: 0, fontSize: "calc(13px * var(--solenos-text-scale, 1))", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{candidate.source_quote || "The document text is available to review."}</p></div>
              {pending && <>
                <label style={{ display: "grid", gap: 4, fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>Short label for this detail<input value={correction.subject} placeholder="For example, mobility, sleep or medicine." maxLength={120} onChange={(event) => setCorrections((old) => ({ ...old, [key]: { ...correction, subject: event.target.value } }))} style={{ minHeight: 38, padding: 8, border: "1px solid var(--border)", borderRadius: 7, background: "var(--surface)", color: "var(--text)" }} /></label>
                <label style={{ display: "grid", gap: 4, fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>Text SolenOS read from the document<textarea value={sourceQuote} readOnly rows={3} style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 7, background: "var(--surface)", color: "var(--text)", resize: "vertical" }} /></label>
                <p style={{ margin: 0, fontSize: "calc(11px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>This text stays unchanged in this review. Check the original document before adding anything to your Care Record.</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <button type="button" disabled={busy !== null || candidateNeedsRewrite} onClick={() => void decide(analysis, candidate, candidateIndex, "accept")} style={{ minHeight: 38, padding: "7px 11px", border: "1px solid #8eae8a", borderRadius: 8, background: "#b9d5b5", color: "#17251c", fontWeight: 700 }} data-testid={`accept-document-candidate-${candidateIndex}`}>Add to Care Record</button>
                  <button type="button" disabled={busy !== null || !hasCorrectionSubject} onClick={() => void decide(analysis, candidate, candidateIndex, "correct")} style={{ minHeight: 38, padding: "7px 11px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--text)" }} data-testid={`correct-document-candidate-${candidateIndex}`}>Suggest a correction</button>
                  <button type="button" disabled={busy !== null} onClick={() => void decide(analysis, candidate, candidateIndex, "reject")} style={{ minHeight: 38, padding: "7px 11px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--text)" }} data-testid={`reject-document-candidate-${candidateIndex}`}>Do not add</button>
                </div>
              </>}
              {candidate.review_status === "accepted_by_caregiver" && candidate.professional_confirmation_question_id && <p style={{ margin: 0, fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>This was saved as a report, but your medicine list was not changed. A healthcare professional or pharmacist must confirm the current instructions.</p>}
              {candidate.review_status === "accepted_by_caregiver" && !candidate.professional_confirmation_question_id && candidate.longitudinal_retrieval_status === "verified" && <p style={{ margin: 0, fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>You approved this detail. It is visible in your Care Record with a link to the original document. This does not mean a healthcare professional has confirmed it.</p>}
              {candidate.review_status === "accepted_by_caregiver" && !candidate.professional_confirmation_question_id && candidate.longitudinal_retrieval_status !== "verified" && <p role="status" style={{ margin: 0, fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>Your choice was saved, but SolenOS could not confirm that this detail is visible in your Care Record yet. Refresh your Care Record before relying on it.</p>}
              {candidate.review_status === "rejected_by_caregiver" && <p style={{ margin: 0, fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>You chose not to add this detail to your Care Record.</p>}
            </div>;
          }) : !documentExtractionIsComplete(analysis) ? <p role="alert" style={{ margin: 0, fontSize: "calc(13px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>We couldn't read every page, so there are no details to review yet. Try those pages again or upload a clearer copy.</p> : null}
          {analysis.has_more_candidates && !(analysis.retryable_page_numbers?.length) && !(analysis.unprocessed_page_numbers?.length) && !processingJobs.some((job) => job.evidence_id === analysis.source_evidence_id && ["queued", "processing"].includes(job.status)) && analysis.observations.length > 0 && analysis.observations.every((candidate) => ["accepted_by_caregiver", "rejected_by_caregiver"].includes(candidate.review_status)) && <button type="button" disabled={busy !== null} onClick={() => void showNextCandidateGroup(analysis)} style={{ justifySelf: "start", minHeight: 38, padding: "7px 11px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--text)" }}>Show the next {Math.min(60, analysis.remaining_candidate_count ?? 0)} details</button>}
          <details onToggle={(event) => { if (event.currentTarget.open) void loadReviewHistory(analysis.analysis_id); }} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
            <summary style={{ cursor: "pointer", fontSize: "calc(13px * var(--solenos-text-scale, 1))", fontWeight: 650 }}>Review history{analysis.reviewEvents ? " · " + analysis.reviewEvents.length + " updates" : ""}</summary>
            {historyLoading[analysis.analysis_id] ? <p role="status" style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>Loading saved review history…</p>
              : historyErrors[analysis.analysis_id] ? <div><p role="alert" style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>{historyErrors[analysis.analysis_id]}</p><button type="button" onClick={() => void loadReviewHistory(analysis.analysis_id)} style={{ minHeight: 34, padding: "5px 9px", border: "1px solid var(--border)", borderRadius: 7, background: "var(--surface)", color: "var(--text)" }}>Retry history</button></div>
                : analysis.reviewEvents === undefined ? <p style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>Open to see the saved review history.</p>
                  : analysis.reviewEvents.length === 0 ? <p style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>No review choices are saved for this document.</p>
                    : <ol style={{ display: "grid", gap: 9, margin: "10px 0 0", paddingLeft: 20 }}>
                      {analysis.reviewEvents.map((event) => {
                        const after = event.after || {};
                        const subject = typeof after.subject === "string" ? after.subject : "Care detail";
                        const observation = typeof after.observation === "string" ? after.observation : "";
                        return <li key={event.id} style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))", lineHeight: 1.5 }}>
                          <strong>Detail {event.candidate_index + 1} · {event.decision === "accept" ? "Added to Care Record" : event.decision === "correct" ? "Correction saved" : "Not added"}</strong>
                          {event.created_at ? <span> · {new Date(event.created_at).toLocaleString()}</span> : null}
                          {observation ? <p style={{ margin: "3px 0" }}>{subject}: {observation}</p> : null}
                          {event.rationale ? <p style={{ margin: "3px 0", color: "var(--text-secondary)" }}>Caregiver note: {caregiverSourceText(event.rationale) || "No further note was recorded."}</p> : null}
                          {event.resulting_assertion_id ? <p style={{ margin: "3px 0" }}>This choice added a report and kept a link to the original document.</p> : null}
                        </li>;
                      })}
                    </ol>}
          </details>
          {(analysis.open_questions || []).length > 0 && <div><strong style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>Questions that still need answers</strong><ul style={{ margin: "5px 0 0", paddingLeft: 20, fontSize: "calc(13px * var(--solenos-text-scale, 1))" }}>{analysis.open_questions?.map((question, i) => <li key={i}>{caregiverSafeGeneratedText(question) || "More information may be needed."}</li>)}</ul></div>}
        </article>
      ))}
    </section>
  );
}
