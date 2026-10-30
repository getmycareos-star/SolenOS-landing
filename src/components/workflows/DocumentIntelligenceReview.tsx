"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, FileSearch, LoaderCircle, ShieldCheck } from "lucide-react";
import { ensureAnonymousSession, getJSON, postJSON } from "@/api/client";

type SavedDocument = { id: string; title: string; extractedText: string };
type Candidate = {
  subject: string;
  observation: string;
  source_quote: string;
  review_status: string;
  accepted_assertion_id?: string;
};
type Analysis = {
  analysis_id: string;
  source_evidence_id: string;
  review_required: boolean;
  written_to_lcr: boolean;
  document_intelligence: {
    document_name?: string;
    observations?: Candidate[];
    open_questions?: string[];
  };
};
type Props = { documents: SavedDocument[]; refreshKey?: number };
type Edit = { subject: string; observation: string };

export default function DocumentIntelligenceReview({ documents, refreshKey = 0 }: Props) {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workingKey, setWorkingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      await ensureAnonymousSession();
      const response = await getJSON("/documents/intelligence?limit=50") as { items?: Analysis[] };
      if (!Array.isArray(response.items)) throw new Error("The document-intelligence response was not in the expected format.");
      setAnalyses(response.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Saved document intelligence could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const analysedIds = useMemo(() => new Set(analyses.map(item => item.source_evidence_id)), [analyses]);
  const awaitingAnalysis = documents.filter(doc => doc.extractedText.trim() && !analysedIds.has(doc.id));

  const analyze = async (document: SavedDocument) => {
    setWorkingKey(document.id);
    setError(null);
    setMessage(null);
    try {
      const result = await postJSON(`/documents/${encodeURIComponent(document.id)}/intelligence`, {}) as Analysis;
      if (!result.analysis_id || result.source_evidence_id !== document.id) throw new Error("The server did not confirm document analysis for this saved source.");
      await load(true);
      setMessage(`Document intelligence completed for ${document.title}. Review each extracted statement below before it enters the Living Care Record.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Document intelligence could not process ${document.title}. The original file remains saved.`);
    } finally {
      setWorkingKey(null);
    }
  };

  const review = async (analysis: Analysis, index: number, decision: "accept" | "correct" | "reject") => {
    const key = `${analysis.analysis_id}:${index}`;
    const candidate = analysis.document_intelligence.observations?.[index];
    if (!candidate) return;
    setWorkingKey(key);
    setError(null);
    setMessage(null);
    const edit = edits[key] || { subject: candidate.subject, observation: candidate.observation };
    try {
      const result = await postJSON(`/documents/intelligence/${encodeURIComponent(analysis.analysis_id)}/review`, {
        candidate_index: index,
        decision,
        ...(decision === "correct" ? { corrected_subject: edit.subject, corrected_observation: edit.observation } : {}),
      }) as { written_to_lcr?: boolean; candidate?: Candidate; message?: string };
      if (decision === "accept" && result.written_to_lcr !== true) throw new Error("The server did not confirm that the accepted statement was saved to the Living Care Record.");
      await load(true);
      if (decision === "accept" && result.written_to_lcr === true) {
        window.dispatchEvent(new Event("solenos:lcr-updated"));
      }
      setMessage(result.message || (result.written_to_lcr ? "Source-linked statement saved to the Living Care Record." : "Review decision saved."));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The document review decision could not be saved.");
    } finally {
      setWorkingKey(null);
    }
  };

  return (
    <section aria-labelledby="document-intelligence-title" style={{ marginTop: 14, padding: 14, border: "1px solid #dce7da", borderRadius: 12, background: "#f7faf6" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div>
          <h3 id="document-intelligence-title" style={{ display: "flex", alignItems: "center", gap: 7, margin: 0, color: "#294631", fontSize: 16 }}><FileSearch size={18} /> Document intelligence</h3>
          <p style={{ margin: "4px 0 0", color: "#718073", fontSize: 12, lineHeight: 1.5 }}>Extracts source-grounded statements. Only caregiver-accepted statements are added to the Living Care Record.</p>
        </div>
        <button type="button" onClick={() => void load(true)} disabled={refreshing || loading} style={{ minHeight: 38, padding: "7px 10px", border: "1px solid #d7e2d5", borderRadius: 8, background: "#fff", color: "#426047", fontSize: 12 }}>Refresh</button>
      </header>

      {loading && <p role="status" style={{ margin: "12px 0 0", color: "#68796a", fontSize: 13 }}><LoaderCircle size={15} className="animate-spin" style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />Loading saved document analyses…</p>}
      {error && <p role="alert" style={{ margin: "12px 0 0", padding: 10, border: "1px solid #ead9d0", borderRadius: 8, background: "#fff9f6", color: "#7b4e3e", fontSize: 12, lineHeight: 1.5 }}><AlertCircle size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 5 }} />{error}</p>}
      {message && <p role="status" style={{ margin: "12px 0 0", color: "#426047", fontSize: 12, lineHeight: 1.5 }}><CheckCircle2 size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 5 }} />{message}</p>}

      {!loading && awaitingAnalysis.length > 0 && (
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          <strong style={{ color: "#405745", fontSize: 12 }}>Saved documents awaiting analysis</strong>
          {awaitingAnalysis.map(document => (
            <div key={document.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: 10, border: "1px solid #e3eae1", borderRadius: 9, background: "#fff" }}>
              <span style={{ minWidth: 0, color: "#405745", fontSize: 12, overflowWrap: "anywhere" }}>{document.title}</span>
              <button type="button" onClick={() => void analyze(document)} disabled={workingKey !== null} style={{ flexShrink: 0, minHeight: 38, padding: "7px 10px", border: "1px solid #cbdcc9", borderRadius: 8, background: "#e7f0e5", color: "#294631", fontSize: 12, fontWeight: 750 }}>{workingKey === document.id ? "Analysing…" : "Analyse"}</button>
            </div>
          ))}
        </div>
      )}

      {!loading && analyses.length === 0 && awaitingAnalysis.length === 0 && !error && (
        <p style={{ margin: "12px 0 0", color: "#788579", fontSize: 12 }}>No readable saved document text is awaiting review. Original files remain in the document library.</p>
      )}

      <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
        {analyses.map(analysis => (
          <article key={analysis.analysis_id} style={{ padding: 12, border: "1px solid #dfe8dc", borderRadius: 10, background: "#fff" }}>
            <strong style={{ display: "block", color: "#344b38", fontSize: 13 }}>{analysis.document_intelligence.document_name || "Saved document"}</strong>
            <p style={{ margin: "4px 0 9px", color: "#718073", fontSize: 11 }}>Original source preserved · {analysis.document_intelligence.observations?.length ?? 0} extracted candidate(s)</p>
            {(analysis.document_intelligence.observations || []).length === 0 && <p style={{ margin: 0, color: "#788579", fontSize: 12 }}>No source-grounded observation candidates were extracted. No facts were invented or added to the Living Care Record.</p>}
            {(analysis.document_intelligence.observations || []).map((candidate, index) => {
              const key = `${analysis.analysis_id}:${index}`;
              const status = candidate.review_status;
              const edit = edits[key] || { subject: candidate.subject, observation: candidate.observation };
              const pending = status === "pending_review" || status === "corrected_pending_approval";
              return (
                <section key={key} style={{ paddingTop: 10, marginTop: 10, borderTop: "1px solid #edf1eb" }}>
                  <label style={{ display: "grid", gap: 4, color: "#455b49", fontSize: 11, fontWeight: 700 }}>Subject
                    <input value={edit.subject} disabled={!pending || workingKey === key} onChange={event => setEdits(current => ({ ...current, [key]: { ...edit, subject: event.target.value } }))} style={{ minHeight: 38, padding: 8, border: "1px solid #dfe8dc", borderRadius: 7, background: "#fff", color: "#2e4132" }} />
                  </label>
                  <label style={{ display: "grid", gap: 4, marginTop: 7, color: "#455b49", fontSize: 11, fontWeight: 700 }}>Extracted statement
                    <textarea value={edit.observation} disabled={!pending || workingKey === key} rows={3} onChange={event => setEdits(current => ({ ...current, [key]: { ...edit, observation: event.target.value } }))} style={{ width: "100%", boxSizing: "border-box", padding: 8, border: "1px solid #dfe8dc", borderRadius: 7, background: "#fff", color: "#2e4132", font: "inherit", fontSize: 13, lineHeight: 1.5 }} />
                  </label>
                  <p style={{ margin: "7px 0 0", padding: 9, borderRadius: 7, background: "#f7faf6", color: "#657567", fontSize: 11, lineHeight: 1.5 }}><strong>Original source passage:</strong> “{candidate.source_quote}”</p>
                  {status === "accepted_by_caregiver" ? (
                    <p role="status" style={{ margin: "8px 0 0", color: "#3f7048", fontSize: 12 }}><ShieldCheck size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 5 }} />Added to the Living Care Record as a source-linked caregiver-reviewed assertion.</p>
                  ) : status === "rejected_by_caregiver" ? (
                    <p style={{ margin: "8px 0 0", color: "#788579", fontSize: 12 }}>Rejected. No care assertion was created.</p>
                  ) : pending ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 9 }}>
                      <button type="button" onClick={() => void review(analysis, index, "accept")} disabled={workingKey !== null} style={{ minHeight: 38, padding: "7px 10px", border: "1px solid #cbdcc9", borderRadius: 8, background: "#e7f0e5", color: "#294631", fontSize: 12, fontWeight: 750 }}>{workingKey === key ? "Saving…" : "Accept into Living Care Record"}</button>
                      <button type="button" onClick={() => void review(analysis, index, "correct")} disabled={workingKey !== null} style={{ minHeight: 38, padding: "7px 10px", border: "1px solid #d7e2d5", borderRadius: 8, background: "#fff", color: "#426047", fontSize: 12 }}>Save correction</button>
                      <button type="button" onClick={() => void review(analysis, index, "reject")} disabled={workingKey !== null} style={{ minHeight: 38, padding: "7px 10px", border: "1px solid #ead9d0", borderRadius: 8, background: "#fff", color: "#80523b", fontSize: 12 }}>Reject</button>
                    </div>
                  ) : (
                    <p style={{ margin: "8px 0 0", color: "#788579", fontSize: 12 }}>Review status: {status.replaceAll("_", " ")}</p>
                  )}
                </section>
              );
            })}
            {(analysis.document_intelligence.open_questions || []).length > 0 && (
              <div style={{ marginTop: 10, padding: 9, borderRadius: 8, background: "#f7faf6" }}>
                <strong style={{ color: "#455b49", fontSize: 11 }}>Questions raised by the source extraction</strong>
                <ul style={{ margin: "5px 0 0", paddingLeft: 18, color: "#657567", fontSize: 11, lineHeight: 1.5 }}>
                  {analysis.document_intelligence.open_questions?.map((question, index) => <li key={index}>{question}</li>)}
                </ul>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
