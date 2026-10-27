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
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";

import QwenAssistPanel from "@/components/qwen/QwenAssistPanel";
import { ensureAnonymousSession, getBlob, getJSON, postFormData } from "@/api/client";
import { apiUrl, safeJson } from "@/lib/api-url";

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
type CropInsets = { top: number; right: number; bottom: number; left: number };
type ReviewPage = { file: File; text: string; note: string | null; reviewed: boolean; uncertain: boolean; rotation: number; crop: CropInsets; prepared: boolean; previewUrl: string | null };

type ScanDraft = { key: string; file: File; extractedText: string; extractionNote: string | null; reviewed: boolean; uncertain: boolean; rotation: number; previewUrl: string | null };

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_FILES = ".pdf,.doc,.docx,.rtf,.txt,.md,.csv,.json,.xml,.yaml,.yml,.eml,.msg,.jpg,.jpeg,.png,.webp,.gif";

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

async function extractText(file: File): Promise<{ text: string; note: string | null }> {
  if (file.type.startsWith("text/") || /\.(txt|md|csv|json|xml|ya?ml)$/i.test(file.name)) {
    try {
      return { text: (await file.text()).slice(0, 100_000), note: null };
    } catch {
      return { text: "", note: "The original file can still be saved, but its text could not be read in this browser." };
    }
  }

  try {
    const form = new FormData();
    form.append("file", file);
    const session = await ensureAnonymousSession();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 40_000);
    let response: Response;
    try {
      response = await fetch(apiUrl("/api/extract"), {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    const data = await safeJson(response) as {
      ok?: boolean;
      document?: { extracted_text?: string };
      note?: string;
      detail?: string;
      error?: string;
    };
    const text = typeof data.document?.extracted_text === "string" ? data.document.extracted_text.slice(0, 100_000) : "";
    if (response.ok && data.ok && text.trim()) return { text, note: null };
    return {
      text: "",
      note: data.note || data.detail || data.error || "The original will be saved, but text extraction is not available for this file in the current deployment.",
    };
  } catch {
    return { text: "", note: "The original will be saved, but text extraction could not be reached. You can retry document understanding later." };
  }
}


async function createProcessedImage(file: File, rotationDegrees: number, crop: CropInsets): Promise<File> {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = sourceUrl;
    await image.decode();
    const radians = rotationDegrees * Math.PI / 180;
    const sin = Math.abs(Math.sin(radians));
    const cos = Math.abs(Math.cos(radians));
    const rotatedWidth = Math.max(1, Math.ceil(image.width * cos + image.height * sin));
    const rotatedHeight = Math.max(1, Math.ceil(image.width * sin + image.height * cos));
    const rotated = document.createElement("canvas");
    rotated.width = rotatedWidth;
    rotated.height = rotatedHeight;
    const rotatedContext = rotated.getContext("2d");
    if (!rotatedContext) throw new Error("Canvas processing is unavailable.");
    rotatedContext.fillStyle = "#fff";
    rotatedContext.fillRect(0, 0, rotatedWidth, rotatedHeight);
    rotatedContext.translate(rotatedWidth / 2, rotatedHeight / 2);
    rotatedContext.rotate(radians);
    rotatedContext.drawImage(image, -image.width / 2, -image.height / 2);

    const left = Math.round(rotatedWidth * crop.left / 100);
    const top = Math.round(rotatedHeight * crop.top / 100);
    const width = Math.max(1, Math.round(rotatedWidth * (100 - crop.left - crop.right) / 100));
    const height = Math.max(1, Math.round(rotatedHeight * (100 - crop.top - crop.bottom) / 100));
    const output = document.createElement("canvas");
    output.width = width;
    output.height = height;
    const outputContext = output.getContext("2d");
    if (!outputContext) throw new Error("Canvas crop is unavailable.");
    outputContext.drawImage(rotated, left, top, width, height, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => output.toBlob((value) => value ? resolve(value) : reject(new Error("Image encoding failed.")), "image/png"));
    const baseName = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName || "scan"}-ocr.png`, { type: "image/png", lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export default function DocumentsPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [reviewPages, setReviewPages] = useState<ReviewPage[]>([]);
  const [preparingScan, setPreparingScan] = useState(false);
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

  const handleFiles = async (fileList: FileList | null) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploadMessage(null);
    const invalid = files.find((file) => file.size <= 0 || file.size > MAX_FILE_BYTES);
    if (invalid) {
      setUploadMessage({ kind: "error", text: invalid.size <= 0 ? `${invalid.name} is empty.` : `${invalid.name} is larger than 10 MiB. Choose a smaller file.` });
      return;
    }
    setPreparingScan(true);
    try {
      const pages: ReviewPage[] = [];
      for (const file of files) {
        const isScannedImage = file.type.startsWith("image/");
        const extracted = isScannedImage
          ? { text: "", note: "Set page rotation/crop if needed, then apply the image adjustments before extracting text." }
          : await extractText(file);
        pages.push({ file, text: extracted.text, note: extracted.note, reviewed: false, uncertain: false, rotation: 0, crop: { top: 0, right: 0, bottom: 0, left: 0 }, prepared: !isScannedImage, previewUrl: isScannedImage ? URL.createObjectURL(file) : null });
      }
      setReviewPages((current) => [...current, ...pages]);
      setUploadMessage({ kind: "success", text: `${files.length} page/file(s) prepared. Review extracted text before saving the originals.` });
    } finally {
      setPreparingScan(false);
      if (fileInput.current) fileInput.current.value = "";
      if (cameraInput.current) cameraInput.current.value = "";
    }
  };

  const prepareImagePage = async (index: number) => {
    const page = reviewPages[index];
    if (!page || !page.file.type.startsWith("image/")) return;
    if (page.crop.left + page.crop.right >= 80 || page.crop.top + page.crop.bottom >= 80) {
      setUploadMessage({ kind: "error", text: "The crop area is too small. Leave at least 20% of the page in each direction." });
      return;
    }
    setPreparingScan(true);
    setUploadMessage(null);
    try {
      const processed = await createProcessedImage(page.file, page.rotation, page.crop);
      const extracted = await extractText(processed);
      setReviewPages((current) => current.map((item, i) => i === index ? { ...item, text: extracted.text, note: extracted.note, prepared: true, reviewed: false } : item));
    } catch {
      setReviewPages((current) => current.map((item, i) => i === index ? { ...item, text: "", note: "Image processing failed. The original scan is still available; retry or transcribe the text manually.", prepared: false, reviewed: false } : item));
    } finally {
      setPreparingScan(false);
    }
  };

  const saveReviewedPages = async () => {
    if (!reviewPages.length || reviewPages.some((page) => !page.reviewed)) {
      setUploadMessage({ kind: "error", text: "Review every page and confirm it against the original before saving." });
      return;
    }
    setUploading(true);
    setUploadMessage(null);
    let saved = 0;
    try {
      const session = await ensureAnonymousSession();
      for (const page of reviewPages) {
        const form = new FormData();
        form.append("file", page.file);
        form.append("person_id", session.person.id);
        form.append("caregiver_id", session.caregiver.id);
        form.append("evidence_type", "document");
        form.append("extracted_text", page.uncertain ? "[UNCERTAIN EXTRACTION — verify against original scan before relying on this text.]\\n" + page.text.trim() : page.text.trim());
        form.append("scan_review_status", page.reviewed ? "caregiver_reviewed" : "not_reviewed");
        form.append("scan_rotation_degrees", String(page.rotation));
        form.append("scan_crop_json", JSON.stringify(page.crop));
        form.append("scan_text_prepared", String(page.prepared));
        const stored = await postFormData("/upload", form) as { evidence_id?: string; persisted?: boolean };
        if (!stored.persisted || !stored.evidence_id) throw new Error("The server did not confirm that the original file was saved.");
        saved += 1;
      }
      reviewPages.forEach((page) => { if (page.previewUrl) URL.revokeObjectURL(page.previewUrl); });
      setReviewPages([]);
      setUploadMessage({ kind: "success", text: `Saved ${saved} original file(s) with reviewed extracted text. Scanned statements remain source evidence, not verified LCR facts.` });
      await loadDocuments(true);
    } catch {
      setUploadMessage({ kind: "error", text: `Saved ${saved} of ${reviewPages.length} file(s) before saving stopped. Refresh the library before retrying to avoid duplicates.` });
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

  const aiDocuments = useMemo(() => {
    const selected = documents.find((doc) => doc.id === selectedId);
    return [
      ...(selected ? [selected] : []),
      ...documents.filter((doc) => doc.id !== selectedId),
    ].slice(0, 10);
  }, [documents, selectedId]);

  const aiContext = useMemo(() => aiDocuments.map((doc) =>
    [
      "Document ID: " + doc.id,
      "Filename: " + doc.title,
      "MIME type: " + doc.mimeType,
      "Saved at: " + (doc.uploadedAt || "unknown"),
      "Storage status: " + doc.status,
      "Available extracted text: " + (doc.extractedText.trim() || "No extracted text is stored for this document."),
    ].join("\n"),
  ).join("\n\n").slice(0, 3000), [aiDocuments]);

  const aiEvidenceIds = useMemo(() => aiDocuments.map((doc) => doc.id), [aiDocuments]);

  return (
    <div className="mobile-screen" style={{ gap: 18, paddingBottom: 28 }}>
      <header className="mobile-page-head" style={{ marginBottom: 0 }}>
        <h1>Documents</h1>
        <p>One reliable place for care letters, discharge papers, prescriptions, appointment notes and other important files.</p>
      </header>

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

        <input ref={fileInput} type="file" accept={ACCEPTED_FILES} multiple hidden onChange={(event) => void handleFiles(event.target.files)} />
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" multiple hidden onChange={(event) => void handleFiles(event.target.files)} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 210px), 1fr))", gap: 10, marginTop: 16 }}>
          <button type="button" onClick={() => cameraInput.current?.click()} disabled={uploading || preparingScan} style={{ width: "100%", minHeight: 54, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10, border: "1px solid #8eae8a", borderRadius: 10, background: "#b9d5b5", color: "#17251c", fontWeight: 750, fontSize: 15, padding: "12px 16px" }}><Camera size={19} />Snap &amp; scan with camera</button>
          <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading || preparingScan} style={{ minHeight: 54, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10, border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text)", fontWeight: 750, fontSize: 15, padding: "12px 16px" }}><Upload size={19} />Upload files / pages</button>
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.5, color: "var(--text-secondary)" }}>Use your phone camera or select multiple files/pages. Maximum 10 MiB per file.</p>
        {preparingScan && <p role="status" style={{ margin: "12px 0 0", fontSize: 14 }}><LoaderCircle size={17} className="animate-spin" style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />Extracting readable text…</p>}
        {reviewPages.length > 0 && <section aria-label="Review extracted text before saving" style={{ marginTop: 16, padding: 14, border: "2px solid #8eae8a", borderRadius: 12, background: "var(--bg)" }}>
          <h3 style={{ margin: 0, fontSize: 17 }}>Review scan and extracted text</h3>
          <p style={{ margin: "6px 0 12px", fontSize: 13, lineHeight: 1.5, color: "var(--text-secondary)" }}>Check names, dates, numbers and instructions. Extraction can be wrong. Mark unclear wording as [uncertain] instead of guessing. The original scan is preserved unchanged.</p>
          <div style={{ display: "grid", gap: 12 }}>{reviewPages.map((page, index) => <article key={index + "-" + page.file.name + "-" + page.file.lastModified} style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)" }}>
            <strong style={{ overflowWrap: "anywhere" }}>{page.file.name}</strong><p style={{ margin: "4px 0 8px", fontSize: 12, color: "var(--text-secondary)" }}>{formatBytes(page.file.size)} · {page.text.trim() ? "Text extracted — review required" : "No readable text extracted"}</p>
            {page.previewUrl && <div style={{ display: "grid", gap: 8, margin: "10px 0" }}>
              <img src={page.previewUrl} alt={`Original scan preview: ${page.file.name}`} style={{ display: "block", maxWidth: "100%", maxHeight: 300, margin: "0 auto", objectFit: "contain", transform: `rotate(${page.rotation}deg)` }} />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" onClick={() => setReviewPages((current) => current.map((item, i) => i === index ? { ...item, rotation: item.rotation - 0.5, prepared: false, reviewed: false, text: "", note: "Page angle changed. Apply adjustments and re-extract text." } : item))} style={{ minHeight: 38, border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", background: "var(--surface)", color: "var(--text)" }}>Straighten left 0.5°</button>
                <button type="button" onClick={() => setReviewPages((current) => current.map((item, i) => i === index ? { ...item, rotation: item.rotation + 0.5, prepared: false, reviewed: false, text: "", note: "Page angle changed. Apply adjustments and re-extract text." } : item))} style={{ minHeight: 38, border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", background: "var(--surface)", color: "var(--text)" }}>Straighten right 0.5°</button>
                <button type="button" onClick={() => setReviewPages((current) => current.map((item, i) => i === index ? { ...item, rotation: item.rotation - 90, prepared: false, reviewed: false, text: "", note: "Page orientation changed. Apply adjustments and re-extract text." } : item))} style={{ minHeight: 38, border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", background: "var(--surface)", color: "var(--text)" }}>Rotate left 90°</button>
                <button type="button" onClick={() => setReviewPages((current) => current.map((item, i) => i === index ? { ...item, rotation: item.rotation + 90, prepared: false, reviewed: false, text: "", note: "Page orientation changed. Apply adjustments and re-extract text." } : item))} style={{ minHeight: 38, border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", background: "var(--surface)", color: "var(--text)" }}>Rotate right 90°</button>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)" }}>Straightening: {page.rotation.toFixed(1)}°. Crop margins are percentages of the rotated page.</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8 }}>
                {(["top", "right", "bottom", "left"] as const).map((edge) => <label key={edge} style={{ display: "grid", gap: 4, fontSize: 12, textTransform: "capitalize" }}>{edge} crop (%)<input type="number" min={0} max={35} step={1} value={page.crop[edge]} onChange={(event) => { const value = Math.max(0, Math.min(35, Number(event.target.value) || 0)); setReviewPages((current) => current.map((item, i) => i === index ? { ...item, crop: { ...item.crop, [edge]: value }, prepared: false, reviewed: false, text: "", note: "Crop changed. Apply adjustments and re-extract text." } : item)); }} style={{ width: "100%", boxSizing: "border-box", minHeight: 38, border: "1px solid var(--border)", borderRadius: 7, padding: 8, background: "var(--surface)", color: "var(--text)" }} /></label>)}
              </div>
              <button type="button" onClick={() => void prepareImagePage(index)} disabled={preparingScan || uploading} style={{ justifySelf: "start", minHeight: 42, border: "1px solid #8eae8a", borderRadius: 8, padding: "8px 12px", background: "#b9d5b5", color: "#17251c", fontWeight: 700 }}>Apply crop / straighten and extract text</button>
            </div>}
            {page.note && <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text-secondary)" }}>{page.note}</p>}
            <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 650 }}>Extracted text — review and correct before saving<textarea value={page.text} onChange={(event) => setReviewPages((current) => current.map((item, i) => i === index ? { ...item, text: event.target.value } : item))} rows={4} maxLength={100000} placeholder="No readable text extracted. Type a transcription or save the original without text." style={{ width: "100%", boxSizing: "border-box", border: "1px solid var(--border)", borderRadius: 8, padding: 10, background: "var(--surface)", color: "var(--text)", fontSize: 15, lineHeight: 1.6 }} /></label>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}><label style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 13, lineHeight: 1.5 }}><input type="checkbox" checked={page.uncertain} onChange={(event) => setReviewPages((current) => current.map((item, i) => i === index ? { ...item, uncertain: event.target.checked } : item))} />Some extracted text is uncertain or could not be read reliably.</label><label style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 13, lineHeight: 1.5 }}><input type="checkbox" checked={page.reviewed} onChange={(event) => setReviewPages((current) => current.map((item, i) => i === index ? { ...item, reviewed: event.target.checked } : item))} />I reviewed this text against the original scan.</label><button type="button" onClick={() => { if (page.previewUrl) URL.revokeObjectURL(page.previewUrl); setReviewPages((current) => current.filter((_, i) => i !== index)); }} disabled={uploading} style={{ justifySelf: "start", minHeight: 38, border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", background: "var(--surface)", color: "var(--text)" }}>Remove</button></div>
          </article>)}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}><button type="button" onClick={() => void saveReviewedPages()} disabled={uploading || preparingScan || reviewPages.length === 0 || reviewPages.some((page) => !page.reviewed || !page.prepared)} style={{ minHeight: 44, display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid #8eae8a", borderRadius: 9, background: "#b9d5b5", color: "#17251c", fontWeight: 750, padding: "10px 13px" }}>{uploading ? <LoaderCircle size={17} className="animate-spin" /> : <ShieldCheck size={17} />}Save reviewed documents</button><button type="button" onClick={() => setReviewPages([])} disabled={uploading} style={{ minHeight: 44, border: "1px solid var(--border)", borderRadius: 9, background: "var(--surface)", color: "var(--text)", padding: "10px 13px" }}>Discard review</button></div>
        </section>}
        {uploading && <p role="status" style={{ margin: "12px 0 0", fontSize: 14 }}>Reading available text and saving the original file. Please keep this page open.</p>}
        {uploadMessage && <p role={uploadMessage.kind === "error" ? "alert" : "status"} style={{ margin: "12px 0 0", padding: 12, borderRadius: 9, border: "1px solid var(--border)", fontSize: 14, lineHeight: 1.5 }}>{uploadMessage.kind === "success" ? <CheckCircle2 size={17} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} /> : <AlertCircle size={17} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />}{uploadMessage.text}</p>}
        {listError && <div role="alert" style={{ marginTop: 14, padding: 12, borderRadius: 9, border: "1px solid var(--border)", fontSize: 14 }}><p style={{ margin: "0 0 10px" }}>{listError}</p><button type="button" onClick={() => void loadDocuments()} style={{ minHeight: 40, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontWeight: 650 }}>Try again</button></div>}

        <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--border)", borderRadius: 9, padding: "0 12px", minHeight: 44 }}>
          <Search size={17} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search document names and available text" aria-label="Search documents" style={{ width: "100%", minWidth: 0, border: 0, outline: 0, background: "transparent", color: "var(--text)", fontSize: 15, minHeight: 42 }} />
        </div>

        {loading ? <div role="status" style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)" }}><LoaderCircle size={20} className="animate-spin" style={{ display: "inline", verticalAlign: "middle", marginRight: 8 }} />Loading saved documents…</div> : visibleDocuments.length === 0 ? (
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

      <section aria-label="Document intelligence" style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 16, background: "var(--surface)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ width: 38, height: 38, display: "grid", placeItems: "center", borderRadius: 9, background: "var(--bg)", flexShrink: 0 }}><ShieldCheck size={20} /></span>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>Document intelligence</h2>
            <p style={{ margin: "5px 0 0", color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.5 }}>Review saved documents, compare available wording, dates and instructions, and surface changes or contradictions for caregiver review. Relevant saved document evidence can also support the AI Companion. Suggestions remain reviewable and do not silently rewrite the Living Care Record.</p>
          </div>
        </div>
        {documents.length === 0 ? <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>Save a document first so the document specialist can use its saved evidence rather than guessing.</p> : (
          <QwenAssistPanel
            title="Ask about your documents"
            description="Ask in your own words. Qwen answers from available saved document evidence, can compare wording and flag possible contradictions, and cannot silently turn scanned statements into verified LCR facts."
            defaultWorkflow="document"
            compact
            contextText={aiContext}
            evidenceIds={aiEvidenceIds}
          />
        )}
      </section>

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
