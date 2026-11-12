"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Download,
  FileImage,
  FileText,
  LoaderCircle,
  RefreshCw,
  Search,
  ScanLine,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";

import { ensureAnonymousSession, getBlob, getJSON, postFormData } from "@/api/client";
import { apiUrl, safeJson } from "@/lib/api-url";
import DocumentIntelligenceReview from "@/components/DocumentIntelligenceReview";
import { LivingArchiveMark } from "@/components/brand";

type EvidenceRecord = {
  id: string;
  type?: string;
  source_text?: string | null;
  source_type?: string | null;
  evidence_status?: string | null;
  uploaded_at?: string | null;
  created_at?: string | null;
  extra_metadata?: string | Record<string, unknown> | null;
};

type DocumentItem = {
  id: string;
  title: string;
  mimeType: string;
  sizeBytes: number | null;
  sha256: string | null;
  uploadedAt: string | null;
  status: string;
  extractedText: string;
  evidence: EvidenceRecord;
};

type UploadMessage = { kind: "success" | "error"; text: string } | null;
type ReviewPage = { ingestionKey: string; captureTimestamp: string; file: File };

const MAX_FILE_BYTES = 10 * 1024 * 1024;
function metadataOf(value: EvidenceRecord["extra_metadata"]): Record<string, unknown> {
  if (value && typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toDocument(item: EvidenceRecord): DocumentItem {
  const meta = metadataOf(item.extra_metadata);
  const title = asString(meta.filename) || "Untitled document";
  return {
    id: item.id,
    title,
    mimeType: asString(meta.mime_type) || "application/octet-stream",
    sizeBytes: asNumber(meta.size_bytes),
    sha256: asString(meta.sha256) || null,
    uploadedAt: item.uploaded_at || item.created_at || null,
    status: item.evidence_status || "recorded",
    extractedText: item.source_text || "",
    evidence: item,
  };
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "Size unavailable";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatDate(value: string | null): string {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString();
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

function isPdf(mimeType: string): boolean {
  return mimeType === "application/pdf";
}

export default function DocumentsPage() {
  const [intakeMode, setIntakeMode] = useState<"upload" | "capture" | "scan" | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const snapInputRef = useRef<HTMLInputElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPages, setCapturedPages] = useState<File[]>([]);
  const [reviewPages, setReviewPages] = useState<ReviewPage[]>([]);
  const [scanDrafts, setScanDrafts] = useState<ScanDraft[]>([]);
  const [scanPreparing, setScanPreparing] = useState(false);
  const [scanSaving, setScanSaving] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanSuccess, setScanSuccess] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<UploadMessage>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [documentIntelligenceRefresh, setDocumentIntelligenceRefresh] = useState(0);

  const loadDocuments = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setListError(null);
    try {
      const session = await ensureAnonymousSession();
      const result = await getJSON("/evidence/" + encodeURIComponent(session.person.id));
      if (!Array.isArray(result)) throw new Error("The document list returned an unexpected response.");
      const next = (result as EvidenceRecord[])
        .filter((item) => item && item.type === "document" && item.id)
        .map(toDocument)
        .sort((a, b) => (b.uploadedAt || "").localeCompare(a.uploadedAt || ""));
      setDocuments(next);
    } catch {
      setListError("SolenOS could not load saved documents. Your saved files have not been deleted. Check the connection and try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void loadDocuments(); }, [loadDocuments]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const selected = useMemo(
    () => documents.find((doc) => doc.id === selectedId) || null,
    [documents, selectedId],
  );

  const visibleDocuments = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return documents;
    return documents.filter((doc) =>
      [doc.title, doc.mimeType, doc.status, doc.extractedText].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [documents, query]);

  const handleFiles = async (fileList: FileList | File[] | null) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploadMessage(null);
    const invalid = files.find((file) => file.size <= 0 || file.size > MAX_FILE_BYTES);
    if (invalid) {
      setUploadMessage({ kind: "error", text: invalid.size <= 0 ? `${invalid.name} is empty.` : `${invalid.name} is larger than 10 MiB. Choose a smaller file.` });
      return;
    }
    const pages: ReviewPage[] = files.map((file) => ({
      ingestionKey: crypto.randomUUID(),
      captureTimestamp: new Date().toISOString(),
      file,
    }));
    setReviewPages((current) => [...current, ...pages]);
    setUploadMessage({ kind: "success", text: `${files.length} original file(s) ready. SolenOS will extract and interpret them after upload; no text review is required before saving.` });
  };

  useEffect(() => {
    if (!cameraOpen) return;
    let cancelled = false;
    setCameraStarting(true);
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access is not available in this browser. Use Snap a photo instead.");
      setCameraStarting(false);
      return;
    }
    void navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        cameraStreamRef.current = stream;
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream;
          void cameraVideoRef.current.play().catch(() => setCameraError("The camera could not start. Check camera permission and try again."));
        }
        setCameraStarting(false);
      })
      .catch(() => {
        if (!cancelled) {
          setCameraStarting(false);
          setCameraError("SolenOS could not access the camera. Allow camera permission in your browser settings, then try again.");
        }
      });
    return () => {
      cancelled = true;
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    };
  }, [cameraOpen]);

  const closeCameraScanner = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setCameraOpen(false);
    setCapturedPages([]);
    setCameraError(null);
  };

  const captureCameraPage = () => {
    const video = cameraVideoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError("The camera is not ready yet. Wait a moment and try again.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("This device could not capture the camera image. Use Snap a photo instead.");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setCameraError("The photo could not be created. Please try again.");
        return;
      }
      const page = new File([blob], `solenos-scan-${Date.now()}-${capturedPages.length + 1}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
      setCapturedPages((current) => [...current, page]);
      setCameraError(null);
    }, "image/jpeg", 0.92);
  };

  const finishCameraScan = () => {
    if (!capturedPages.length) {
      setCameraError("Capture at least one page before continuing.");
      return;
    }
    const pages = [...capturedPages];
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setCameraOpen(false);
    setCapturedPages([]);
    setIntakeMode("scan");
    void handleFiles(pages);
  };


  const saveReviewedPages = async () => {
    if (!reviewPages.length) {
      setUploadMessage({ kind: "error", text: "Choose a file or scan page before saving." });
      return;
    }
    setUploading(true);
    setUploadMessage(null);
    let saved = 0;
    let backgroundProcessingQueued = 0;
    let backgroundQueueUnavailable = 0;
    try {
      const session = await ensureAnonymousSession();
      let scanPageNumber = 0;
      for (let pageIndex = 0; pageIndex < reviewPages.length; pageIndex += 1) {
        const page = reviewPages[pageIndex];
        if (intakeMode === "scan" && page.file.type.startsWith("image/")) scanPageNumber += 1;
        const form = new FormData();
        form.append("file", page.file);
        form.append("ingestion_key", page.ingestionKey);
        form.append("person_id", session.person.id);
        form.append("caregiver_id", session.caregiver.id);
        form.append("evidence_type", "document");
        form.append("capture_method", intakeMode === "scan" ? "scan" : intakeMode === "capture" ? "snap" : "upload");
        form.append("capture_timestamp", page.captureTimestamp);
        if (intakeMode === "scan" && page.file.type.startsWith("image/")) form.append("capture_page_number", String(scanPageNumber));
        const stored = await postFormData("/upload", form) as {
          evidence_id?: string;
          persisted?: boolean;
          document_processing_job_id?: string | null;
          processing_status?: string;
        };
        if (!stored.persisted || !stored.evidence_id) throw new Error("The server did not confirm that the original file was saved.");
        saved += 1;
        if (stored.document_processing_job_id && ["queued", "processing", "completed"].includes(stored.processing_status || "")) {
          backgroundProcessingQueued += 1;
        } else {
          backgroundQueueUnavailable += 1;
        }
      }
      setReviewPages([]);
      setIntakeMode(null);
      setUploadMessage({
        kind: "success",
        text: `Saved ${saved} original file(s). Background extraction and document understanding are queued, running or already complete for ${backgroundProcessingQueued}; ${backgroundQueueUnavailable} file(s) need a manual retry from the review list. You can leave this page. Extracted statements remain review-only until you accept them into the Living Care Record.`,
      });
      await loadDocuments(true);
      setDocumentIntelligenceRefresh((value) => value + 1);
    } catch {
      setUploadMessage({ kind: "error", text: `Saved ${saved} of ${reviewPages.length} file(s) before saving stopped. Retry the same batch; the server reuses each saved upload ID.` });
      await loadDocuments(true);
    } finally { setUploading(false); }
  };

  const openOriginal = async (doc: DocumentItem) => {
    setSelectedId(doc.id);
    setPreviewError(null);
    setPreviewLoading(true);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    try {
      const blob = await getBlob("/upload/" + encodeURIComponent(doc.id));
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch {
      setPreviewError("The saved document record is available, but the original file could not be retrieved. Retry or refresh the list.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setSelectedId(null);
    setPreviewError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  const downloadOriginal = () => {
    if (!previewUrl || !selected) return;
    const link = document.createElement("a");
    link.href = previewUrl;
    link.download = selected.title;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="mobile-screen" style={{ gap: 18, paddingBottom: 28 }}>
      <header className="mobile-page-head" style={{ marginBottom: 0 }}>
        <h1>Documents</h1>
        <p>One reliable place for care letters, discharge papers, prescriptions, appointment notes and other important files.</p>
      </header>
      <section aria-label="Add care documents" style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))" }}>
        <input ref={uploadInputRef} type="file" multiple accept="image/*,application/pdf,text/*,.doc,.docx,.rtf,.odt,.csv,.json,.xml,.eml,.msg" style={{ display: "none" }} onChange={(event) => { const files = event.currentTarget.files; event.currentTarget.value = ""; setIntakeMode("upload"); void handleFiles(files); }} />
        <input ref={snapInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(event) => { const files = event.currentTarget.files; event.currentTarget.value = ""; setIntakeMode("capture"); void handleFiles(files); }} />
        <button type="button" onClick={() => uploadInputRef.current?.click()} disabled={uploading} style={{ minHeight: 46, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, border: "1px solid #8eae8a", borderRadius: 9, background: "#b9d5b5", color: "#17251c", fontWeight: 700, padding: "10px 12px" }}><Upload size={17} />Upload files</button>
        <button type="button" onClick={() => snapInputRef.current?.click()} disabled={uploading || preparingScan} style={{ minHeight: 46, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, border: "1px solid #8eae8a", borderRadius: 9, background: "#b9d5b5", color: "#17251c", fontWeight: 700, padding: "10px 12px" }}><Camera size={17} />Snap a photo</button>
        <button type="button" onClick={() => { setCapturedPages([]); setCameraError(null); setCameraOpen(true); }} disabled={uploading || preparingScan} style={{ minHeight: 46, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, border: "1px solid #8eae8a", borderRadius: 9, background: "#b9d5b5", color: "#17251c", fontWeight: 700, padding: "10px 12px" }}><ScanLine size={17} />Scan pages</button>
      </section>

      <DocumentIntelligenceReview refreshToken={documentIntelligenceRefresh} documents={documents.map(({ id, title }) => ({ id, title }))} />

      <section aria-label="Document library" style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 16, background: "var(--surface)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>Your document library</h2>
            <p style={{ margin: "5px 0 0", color: "var(--text-secondary)", fontSize: 13 }}>Original files are stored separately from AI interpretation.</p>
          </div>
          <button type="button" onClick={() => void loadDocuments(true)} disabled={refreshing || loading} style={{ minHeight: 42, display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 9, background: "var(--surface)", color: "var(--text)", fontWeight: 650 }} aria-label="Refresh documents">
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        {reviewPages.length > 0 && <section aria-label="Files ready to upload" style={{ marginTop: 16, padding: 14, border: "1px solid var(--border)", borderRadius: 12, background: "var(--bg)" }}>
          <h3 style={{ margin: 0, fontSize: 17 }}>Ready to save</h3>
          <p style={{ margin: "6px 0 12px", fontSize: 13, lineHeight: 1.5, color: "var(--text-secondary)" }}>SolenOS keeps each original file and handles text extraction and document understanding after upload. You do not need to read or correct extracted text first.</p>
          <div style={{ display: "grid", gap: 8 }}>
            {reviewPages.map((page, index) => <div key={page.ingestionKey} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 10, border: "1px solid var(--border)", borderRadius: 9, background: "var(--surface)" }}>
              <div style={{ minWidth: 0 }}>
                <strong style={{ display: "block", overflowWrap: "anywhere" }}>{page.file.name}</strong>
                <span style={{ display: "block", marginTop: 3, fontSize: 12, color: "var(--text-secondary)" }}>{formatBytes(page.file.size)} · Original file will be preserved</span>
              </div>
              <button type="button" onClick={() => setReviewPages((current) => current.filter((_, i) => i !== index))} disabled={uploading} aria-label={`Remove ${page.file.name}`} style={{ flex: "0 0 auto", minHeight: 38, border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", background: "var(--surface)", color: "var(--text)" }}>Remove</button>
            </div>)}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <button type="button" onClick={() => void saveReviewedPages()} disabled={uploading || reviewPages.length === 0} style={{ minHeight: 44, display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid #8eae8a", borderRadius: 9, background: "#b9d5b5", color: "#17251c", fontWeight: 750, padding: "10px 13px" }}>{uploading ? <LoaderCircle size={17} className="animate-spin" /> : <Upload size={17} />}Save original files</button>
            <button type="button" onClick={() => setReviewPages([])} disabled={uploading} style={{ minHeight: 44, border: "1px solid var(--border)", borderRadius: 9, background: "var(--surface)", color: "var(--text)", padding: "10px 13px" }}>Discard selection</button>
          </div>
        </section>}
        {uploading && <div style={{ margin: "12px 0 0" }}><LivingArchiveMark size="sm" label="Saving the original document…" /><p style={{ margin: "6px 0 0", fontSize: 13 }}>Keep this page open only until the original upload is confirmed. After that, server processing continues even if you leave.</p></div>}
        {uploadMessage && <p role={uploadMessage.kind === "error" ? "alert" : "status"} style={{ margin: "12px 0 0", padding: 12, borderRadius: 9, border: "1px solid var(--border)", fontSize: 14, lineHeight: 1.5 }}>{uploadMessage.kind === "success" ? <CheckCircle2 size={17} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} /> : <AlertCircle size={17} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />}{uploadMessage.text}</p>}
        {listError && <div role="alert" style={{ marginTop: 14, padding: 12, borderRadius: 9, border: "1px solid var(--border)", fontSize: 14 }}><p style={{ margin: "0 0 10px" }}>{listError}</p><button type="button" onClick={() => void loadDocuments()} style={{ minHeight: 40, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontWeight: 650 }}>Try again</button></div>}

        <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--border)", borderRadius: 9, padding: "0 12px", minHeight: 44 }}>
          <Search size={17} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search document names and available text" aria-label="Search documents" style={{ width: "100%", minWidth: 0, border: 0, outline: 0, background: "transparent", color: "var(--text)", fontSize: 15, minHeight: 42 }} />
        </div>

        {loading ? <div role="status" style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)" }}><LivingArchiveMark size="sm" label="Loading saved documents…" /></div> : visibleDocuments.length === 0 ? (
          <div style={{ padding: "26px 12px", textAlign: "center" }}>
            <FileText size={34} style={{ margin: "0 auto 10px", color: "var(--text-secondary)" }} />
            <h3 style={{ margin: 0, fontSize: 16 }}>{documents.length === 0 ? "No saved documents yet" : "No matching documents"}</h3>
            <p style={{ margin: "8px 0 0", color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.5 }}>{documents.length === 0 ? "Upload a care document to keep its original file and make available text searchable." : "Try another filename or word from the document."}</p>
          </div>
        ) : (
          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            {visibleDocuments.map((doc) => (
              <button key={doc.id} type="button" onClick={() => void openOriginal(doc)} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 12, padding: 12, border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text)", minWidth: 0 }}>
                <span style={{ width: 42, height: 42, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: 9, background: "var(--bg)" }}>{isImage(doc.mimeType) ? <FileImage size={21} /> : <FileText size={21} />}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 700, overflowWrap: "anywhere", fontSize: 14 }}>{doc.title}</span>
                  <span style={{ display: "block", marginTop: 4, fontSize: 12, color: "var(--text-secondary)" }}>{formatBytes(doc.sizeBytes)} · {formatDate(doc.uploadedAt)}</span>
                  <span style={{ display: "block", marginTop: 4, fontSize: 12, color: "var(--text-secondary)" }}>{doc.extractedText.trim() ? "Text available for document understanding" : "Original saved · text not available"}</span>
                </span>
                <span aria-hidden="true" style={{ flexShrink: 0, fontSize: 12, color: "var(--text-secondary)" }}>Open</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {cameraOpen && <div role="dialog" aria-modal="true" aria-label="Scan care document pages" style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(0,0,0,.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
        <section style={{ width: "min(720px, 100%)", maxHeight: "92dvh", display: "grid", gap: 12, padding: 14, background: "var(--surface)", color: "var(--text)", borderRadius: 14, overflow: "auto" }}>
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div><h2 style={{ margin: 0, fontSize: 18 }}>Scan pages</h2><p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>Capture each page. Review, rotate and crop them before saving.</p></div>
            <button type="button" onClick={closeCameraScanner} aria-label="Close scanner" style={{ width: 40, height: 40, border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--text)" }}><X size={18} /></button>
          </header>
          <video ref={cameraVideoRef} autoPlay playsInline muted aria-label="Live document camera preview" style={{ width: "100%", maxHeight: "55dvh", background: "#111", borderRadius: 10, objectFit: "contain" }} />
          {cameraStarting && <p role="status" style={{ margin: 0 }}>Starting camera…</p>}
          {cameraError && <p role="alert" style={{ margin: 0, color: "var(--danger, #a22)" }}>{cameraError}</p>}
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>{capturedPages.length} page(s) captured</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={captureCameraPage} disabled={cameraStarting} style={{ minHeight: 44, border: "1px solid #8eae8a", borderRadius: 9, background: "#b9d5b5", color: "#17251c", fontWeight: 700, padding: "9px 13px" }}>Take photo</button>
            <button type="button" onClick={finishCameraScan} disabled={!capturedPages.length || cameraStarting} style={{ minHeight: 44, border: "1px solid #8eae8a", borderRadius: 9, background: "#b9d5b5", color: "#17251c", fontWeight: 700, padding: "9px 13px" }}>Review {capturedPages.length || ""} page(s)</button>
            <button type="button" onClick={closeCameraScanner} style={{ minHeight: 44, border: "1px solid var(--border)", borderRadius: 9, background: "var(--surface)", color: "var(--text)", padding: "9px 13px" }}>Cancel</button>
          </div>
        </section>
      </div>}
      {selected && <div role="dialog" aria-modal="true" aria-label={selected.title} onClick={(event) => { if (event.target === event.currentTarget) closePreview(); }} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
        <section style={{ width: "min(900px, 100%)", maxHeight: "92dvh", display: "flex", flexDirection: "column", background: "var(--surface)", color: "var(--text)", borderRadius: 14, overflow: "hidden", border: "1px solid var(--border)" }}>
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: 14, borderBottom: "1px solid var(--border)" }}>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: 16, overflowWrap: "anywhere" }}>{selected.title}</h2>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>{formatBytes(selected.sizeBytes)} · {formatDate(selected.uploadedAt)}</p>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button type="button" onClick={downloadOriginal} disabled={!previewUrl} aria-label="Download original document" style={{ minHeight: 42, padding: "8px 10px", display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--text)" }}><Download size={16} /> Download</button>
              <button type="button" onClick={closePreview} aria-label="Close document preview" style={{ width: 42, minHeight: 42, display: "grid", placeItems: "center", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--text)" }}><X size={19} /></button>
            </div>
          </header>
          <div style={{ padding: 14, overflow: "auto", minHeight: 180 }}>
            {previewLoading ? <p role="status"><LoaderCircle size={18} className="animate-spin" style={{ display: "inline", verticalAlign: "middle", marginRight: 8 }} />Retrieving original file…</p> : previewError ? <div role="alert"><p>{previewError}</p><button type="button" onClick={() => void openOriginal(selected)} style={{ minHeight: 42, padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--text)" }}>Retry</button></div> : previewUrl && isPdf(selected.mimeType) ? <iframe title={selected.title} src={previewUrl} style={{ width: "100%", height: "65dvh", border: 0 }} /> : previewUrl && isImage(selected.mimeType) ? <img src={previewUrl} alt={selected.title} style={{ display: "block", maxWidth: "100%", maxHeight: "65dvh", margin: "0 auto", objectFit: "contain" }} /> : previewUrl ? <div><p style={{ fontSize: 13, color: "var(--text-secondary)" }}>The original file was retrieved successfully. Download it to open it in a compatible app.</p>{selected.extractedText.trim() && <><h3 style={{ fontSize: 15 }}>Text saved with this document</h3><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 14, lineHeight: 1.6 }}>{selected.extractedText}</pre></>}</div> : <p>Original file preview is not available yet.</p>}
            {selected.sha256 && <p style={{ marginTop: 14, fontSize: 11, overflowWrap: "anywhere", color: "var(--text-secondary)" }}>Original file SHA-256: {selected.sha256}</p>}
          </div>
        </section>
      </div>}
    </div>
  );
}
