"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FileImage, FileText, LoaderCircle, RefreshCw, ShieldCheck, X } from "lucide-react";
import { ensureAnonymousSession, getBlob, getJSON } from "@/api/client";

type EvidenceRecord = {
  id: string;
  type?: string;
  source_text?: string | null;
  evidence_status?: string | null;
  uploaded_at?: string | null;
  created_at?: string | null;
  extra_metadata?: string | Record<string, unknown> | null;
};

type SavedDocument = {
  id: string;
  title: string;
  mimeType: string;
  sizeBytes: number | null;
  savedAt: string | null;
  status: string;
  extractedText: string;
};

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

function toDocument(item: EvidenceRecord): SavedDocument {
  const metadata = metadataOf(item.extra_metadata);
  const size = metadata.size_bytes;
  return {
    id: item.id,
    title: typeof metadata.filename === "string" && metadata.filename.trim() ? metadata.filename : "Untitled document",
    mimeType: typeof metadata.mime_type === "string" ? metadata.mime_type : "application/octet-stream",
    sizeBytes: typeof size === "number" && Number.isFinite(size) ? size : null,
    savedAt: item.uploaded_at || item.created_at || null,
    status: item.evidence_status || "recorded",
    extractedText: item.source_text || "",
  };
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "File size unavailable";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatDate(value: string | null): string {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString();
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<SavedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SavedDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const loadDocuments = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const session = await ensureAnonymousSession();
      const result = await getJSON("/evidence/" + encodeURIComponent(session.person.id));
      if (!Array.isArray(result)) throw new Error("Unexpected document response");
      const saved = (result as EvidenceRecord[])
        .filter((item) => item && item.type === "document" && item.id)
        .map(toDocument)
        .sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || ""));
      setDocuments(saved);
    } catch {
      setError("Saved documents could not be loaded. Your stored files have not been changed. Check your connection and try again.");
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

  const openDocument = async (doc: SavedDocument) => {
    setSelected(doc);
    setPreviewError(null);
    setPreviewLoading(true);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    try {
      const blob = await getBlob("/upload/" + encodeURIComponent(doc.id));
      setPreviewUrl(URL.createObjectURL(blob));
    } catch {
      setPreviewError("The saved file could not be retrieved. Your document record remains saved. Retry when the connection is available.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setSelected(null);
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

  const isPdf = selected?.mimeType === "application/pdf";
  const isImage = Boolean(selected?.mimeType.startsWith("image/"));

  return (
    <main className="mobile-screen" style={{ width: "100%", maxWidth: 920, margin: "0 auto", padding: "clamp(16px, 3vw, 30px)", display: "grid", alignContent: "start", gap: 18 }}>
      <header style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div aria-hidden="true" style={{ width: 46, height: 46, flex: "0 0 46px", display: "grid", placeItems: "center", borderRadius: 14, background: "#eaf2e8", color: "#466b4a" }}><FileText size={22} /></div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: "0 0 4px", color: "#648067", fontSize: 11, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase" }}>Saved care information</p>
          <h1 style={{ margin: 0, color: "#24372a", fontSize: "clamp(24px, 4vw, 32px)", lineHeight: 1.2, letterSpacing: "-.035em" }}>Documents</h1>
          <p style={{ margin: "8px 0 0", color: "#657468", fontSize: 15, lineHeight: 1.65 }}>View documents already saved to the care record. To talk through new information or correct a detail, use AI Companion.</p>
        </div>
      </header>

      <section aria-label="Saved document library" style={{ border: "1px solid #e0e8de", borderRadius: 18, padding: "clamp(14px, 2.5vw, 20px)", background: "#fff", boxShadow: "0 4px 18px rgba(34,54,38,.035)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, color: "#2b4030", fontSize: 18 }}>Saved documents</h2>
            <p style={{ margin: "4px 0 0", color: "#7a887b", fontSize: 13 }}>Original files remain separate from AI interpretation.</p>
          </div>
          <button type="button" onClick={() => void loadDocuments(true)} disabled={refreshing || loading} style={{ minHeight: 44, display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 13px", border: "1px solid #dce6da", borderRadius: 11, background: "#f8fbf7", color: "#39533d", fontWeight: 700 }}>
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        {error && <div role="alert" style={{ marginTop: 14, padding: 13, border: "1px solid #ead6c4", borderRadius: 12, background: "#fffaf4", color: "#76543b", fontSize: 14, lineHeight: 1.55 }}>{error}</div>}
        {loading ? <p role="status" style={{ display: "flex", alignItems: "center", gap: 9, color: "#657468", margin: "20px 0 4px" }}><LoaderCircle size={18} className="animate-spin" />Loading saved documents…</p> : documents.length === 0 ? (
          <div style={{ marginTop: 18, padding: "26px 16px", border: "1px dashed #d7e2d5", borderRadius: 14, background: "#fbfdfb", textAlign: "center" }}>
            <ShieldCheck size={23} color="#78947a" />
            <h3 style={{ margin: "9px 0 5px", color: "#344a38", fontSize: 16 }}>No saved documents yet</h3>
            <p style={{ margin: 0, color: "#78867a", fontSize: 13, lineHeight: 1.6 }}>Nothing has been added to this library. You can still use AI Companion to talk through what is happening.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 9, marginTop: 16 }}>
            {documents.map((doc) => (
              <button key={doc.id} type="button" onClick={() => void openDocument(doc)} style={{ width: "100%", minWidth: 0, minHeight: 72, display: "flex", alignItems: "center", gap: 12, padding: 12, border: "1px solid #e5ece3", borderRadius: 13, background: "#fff", color: "#2c4031", textAlign: "left" }}>
                <span aria-hidden="true" style={{ width: 42, height: 42, flex: "0 0 42px", display: "grid", placeItems: "center", borderRadius: 11, background: "#f0f5ee", color: "#56775a" }}>{doc.mimeType.startsWith("image/") ? <FileImage size={20} /> : <FileText size={20} />}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", overflowWrap: "anywhere", fontSize: 14, fontWeight: 750 }}>{doc.title}</span>
                  <span style={{ display: "block", marginTop: 4, color: "#7a887b", fontSize: 12 }}>{formatBytes(doc.sizeBytes)} · {formatDate(doc.savedAt)}</span>
                  <span style={{ display: "block", marginTop: 3, color: "#829084", fontSize: 11 }}>{doc.extractedText.trim() ? "Text available for care review" : "Original file saved"}</span>
                </span>
                <span style={{ flex: "0 0 auto", color: "#718574", fontSize: 12, fontWeight: 700 }}>View</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {selected && <div role="dialog" aria-modal="true" aria-label={selected.title} onClick={(event) => { if (event.target === event.currentTarget) closePreview(); }} style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 12, background: "rgba(20,35,25,.58)" }}>
        <section style={{ width: "min(900px, 100%)", maxHeight: "92dvh", display: "flex", flexDirection: "column", overflow: "hidden", border: "1px solid #dce6da", borderRadius: 17, background: "#fff", color: "#24372a" }}>
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 14, borderBottom: "1px solid #e7eee5" }}>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, overflowWrap: "anywhere", fontSize: 16 }}>{selected.title}</h2>
              <p style={{ margin: "4px 0 0", color: "#78867a", fontSize: 12 }}>{formatBytes(selected.sizeBytes)} · {formatDate(selected.savedAt)}</p>
            </div>
            <div style={{ display: "flex", gap: 8, flex: "0 0 auto" }}>
              <button type="button" onClick={downloadOriginal} disabled={!previewUrl} aria-label="Download original document" style={{ minHeight: 42, display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 11px", border: "1px solid #dce6da", borderRadius: 10, background: "#f8fbf7", color: "#39533d", fontWeight: 700 }}><Download size={16} /> Download</button>
              <button type="button" onClick={closePreview} aria-label="Close document preview" style={{ width: 42, minHeight: 42, display: "grid", placeItems: "center", border: "1px solid #dce6da", borderRadius: 10, background: "#fff", color: "#526657" }}><X size={18} /></button>
            </div>
          </header>
          <div style={{ padding: 14, overflow: "auto", minHeight: 180 }}>
            {previewLoading ? <p role="status" style={{ display: "flex", alignItems: "center", gap: 8 }}><LoaderCircle size={18} className="animate-spin" />Retrieving original file…</p> : previewError ? <div role="alert"><p>{previewError}</p><button type="button" onClick={() => void openDocument(selected)} style={{ minHeight: 42, padding: "8px 12px", border: "1px solid #dce6da", borderRadius: 9, background: "#f8fbf7", color: "#39533d" }}>Retry</button></div> : previewUrl && isPdf ? <iframe title={selected.title} src={previewUrl} style={{ width: "100%", height: "65dvh", border: 0 }} /> : previewUrl && isImage ? <img src={previewUrl} alt={selected.title} style={{ display: "block", maxWidth: "100%", maxHeight: "65dvh", margin: "0 auto", objectFit: "contain" }} /> : previewUrl ? <div><p style={{ color: "#657468", fontSize: 13 }}>The original file is ready to download and open in a compatible app.</p>{selected.extractedText.trim() && <><h3 style={{ fontSize: 15 }}>Text saved with this document</h3><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 14, lineHeight: 1.6 }}>{selected.extractedText}</pre></>}</div> : <p>Original file preview is not available.</p>}
          </div>
        </section>
      </div>}
    </main>
  );
}
