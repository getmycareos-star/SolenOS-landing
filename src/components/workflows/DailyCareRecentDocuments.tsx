"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ensureAnonymousSession, getJSON } from "@/api/client";

type EvidenceRecord = {
  id: string;
  type?: string;
  uploaded_at?: string | null;
  created_at?: string | null;
  extra_metadata?: string | Record<string, unknown> | null;
};

type DocumentAnalysis = {
  source_evidence_id: string;
  document_name?: string;
  extraction_status?: string;
  intelligence_status?: string;
  review_required?: boolean;
  observations?: Array<{ review_status?: string }>;
  unreadable_page_numbers?: number[];
  blocked_page_numbers?: number[];
};

type ProcessingJob = {
  evidence_id: string;
  status: "queued" | "processing" | "failed";
};

type IntelligenceResponse = {
  items?: DocumentAnalysis[];
  processing_jobs?: ProcessingJob[];
};

type RecentDocument = {
  id: string;
  name: string;
  uploadedAt: string | null;
};

function metadataOf(value: EvidenceRecord["extra_metadata"]): Record<string, unknown> {
  if (value && typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed && typeof parsed === "object" && parsed !== null
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function documentName(item: EvidenceRecord): string {
  const metadata = metadataOf(item.extra_metadata);
  return typeof metadata.filename === "string" && metadata.filename.trim()
    ? metadata.filename.trim()
    : "Saved document";
}

function documentStatus(
  id: string,
  analyses: Map<string, DocumentAnalysis>,
  jobs: Map<string, ProcessingJob>,
): string {
  const job = jobs.get(id);
  if (job?.status === "queued" || job?.status === "processing") {
    return "SolenOS is reading this document in the background. You do not need to stay on this screen.";
  }
  if (job?.status === "failed") {
    return "SolenOS could not finish reading this document. The original file is still saved. Open Documents to try again.";
  }
  const analysis = analyses.get(id);
  if (!analysis) return "The original document is saved. Its reading status is not available yet.";
  if (
    analysis.extraction_status === "partial"
    || (analysis.unreadable_page_numbers?.length ?? 0) > 0
    || (analysis.blocked_page_numbers?.length ?? 0) > 0
  ) {
    return "Some pages could not be read. Check the original document before relying on the text.";
  }
  const needsReview = analysis.review_required === true
    || analysis.observations?.some((item) =>
      item.review_status === "pending_review" || item.review_status === "corrected_pending_approval",
    );
  if (needsReview) {
    return "Suggested details are waiting for your review. Nothing is added to your Care Record until you approve it.";
  }
  if (analysis.intelligence_status === "available" && (analysis.observations?.length ?? 0) === 0) {
    return "No care-related details were found. Nothing was added to your Care Record.";
  }
  if (analysis.intelligence_status === "available") {
    return "Document reading is complete. Open Documents to review the saved details.";
  }
  return "The original document is saved. Reading or review is not complete yet.";
}

export default function DailyCareRecentDocuments() {
  const [documents, setDocuments] = useState<RecentDocument[]>([]);
  const [analyses, setAnalyses] = useState<DocumentAnalysis[]>([]);
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestSequence = useRef(0);

  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError("");
    try {
      const session = await ensureAnonymousSession();
      const [evidenceResponse, intelligenceResponse] = await Promise.all([
        getJSON("/evidence/" + encodeURIComponent(session.person.id)),
        getJSON("/documents/intelligence?limit=10"),
      ]);
      if (sequence !== requestSequence.current) return;
      if (!Array.isArray(evidenceResponse)) throw new Error("Unexpected document list response");
      const recent = (evidenceResponse as EvidenceRecord[])
        .filter((item) => item && item.type === "document" && typeof item.id === "string")
        .map((item) => ({
          id: item.id,
          name: documentName(item),
          uploadedAt: item.uploaded_at || item.created_at || null,
        }))
        .sort((a, b) => (b.uploadedAt || "").localeCompare(a.uploadedAt || ""))
        .slice(0, 5);
      const intelligence = intelligenceResponse as IntelligenceResponse;
      setDocuments(recent);
      setAnalyses(Array.isArray(intelligence.items) ? intelligence.items : []);
      setJobs(Array.isArray(intelligence.processing_jobs) ? intelligence.processing_jobs : []);
    } catch {
      if (sequence === requestSequence.current) {
        setError("Recent document activity isn't available right now. Try again. Your saved documents have not been changed.");
      }
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const refreshForPersonChange = () => void load();
    window.addEventListener("personIdChanged", refreshForPersonChange);
    return () => {
      requestSequence.current += 1;
      window.removeEventListener("personIdChanged", refreshForPersonChange);
    };
  }, [load]);

  useEffect(() => {
    if (!jobs.some((job) => job.status === "queued" || job.status === "processing")) return;
    const timer = window.setTimeout(() => void load(), 5000);
    return () => window.clearTimeout(timer);
  }, [jobs, load]);

  const analysisByEvidence = new Map(analyses.map((item) => [item.source_evidence_id, item]));
  const jobByEvidence = new Map(jobs.map((item) => [item.evidence_id, item]));

  return (
    <section className="daily-care-recent-documents" aria-labelledby="daily-care-recent-documents-title">
      <div className="daily-care-recent-documents__heading">
        <div>
          <h2 id="daily-care-recent-documents-title">Recent documents</h2>
          <p>Check whether saved documents have finished being read or still need your review.</p>
        </div>
        <Link href="/workspace/documents">Open Documents</Link>
      </div>
      {loading && documents.length === 0 ? (
        <p role="status">Loading recent documents…</p>
      ) : error ? (
        <div role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => void load()}>Try again</button>
        </div>
      ) : documents.length === 0 ? (
        <p>No documents saved yet. Upload a medical document when you need to keep one with your care information.</p>
      ) : (
        <ul>
          {documents.map((document) => (
            <li key={document.id}>
              <strong>{document.name}</strong>
              <p>{documentStatus(document.id, analysisByEvidence, jobByEvidence)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
