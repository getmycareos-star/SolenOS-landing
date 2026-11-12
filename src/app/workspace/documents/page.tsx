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
type CropInsets = { top: number; right: number; bottom: number; left: number };
type ReviewPage = { ingestionKey: string; captureTimestamp: string; file: File; text: string; note: string | null; reviewed: boolean; uncertain: boolean; rotation: number; crop: CropInsets; prepared: boolean; previewUrl: string | null };

type ScanDraft = { key: string; file: File; extractedText: string; extractionNote: string | null; reviewed: boolean; uncertain: boolean; rotation: number; previewUrl: string | null };

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

async function createProcessedImage(file: File, rotationDegrees: number, crop: CropInsets): Promise<File> {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = sourceUrl;
    await image.decode();

    // Crop coordinates are defined against the rotated page preview, so rotate first.
    const radians = rotationDegrees * Math.PI / 180;
    const sin = Math.abs(Math.sin(radians));
    const cos = Math.abs(Math.cos(radians));
    const rotatedWidth = Math.max(1, Math.ceil(image.width * cos + image.height * sin));
    const rotatedHeight = Math.max(1, Math.ceil(image.width * sin + image.height * cos));
    const rotated = document.createElement("canvas");
    rotated.width = rotatedWidth;
    rotated.height = rotatedHeight;
    const rotatedContext = rotated.getContext("2d");
    if (!rotatedContext) throw new Error("Image rotation is unavailable.");
    rotatedContext.fillStyle = "#fff";
    rotatedContext.fillRect(0, 0, rotatedWidth, rotatedHeight);
    rotatedContext.translate(rotatedWidth / 2, rotatedHeight / 2);
    rotatedContext.rotate(radians);
    rotatedContext.drawImage(image, -image.width / 2, -image.height / 2);

    const left = Math.round(rotatedWidth * crop.left / 100);
    const top = Math.round(rotatedHeight * crop.top / 100);
    const width = Math.max(1, Math.round(rotatedWidth * (100 - crop.left - crop.right) / 100));
    const height = Math.max(1, Math.round(rotatedHeight * (100 - crop.top - crop.bottom) / 100));
    const cropped = document.createElement("canvas");
    cropped.width = width;
    cropped.height = height;
    const cropContext = cropped.getContext("2d");
    if (!cropContext) throw new Error("Canvas crop is unavailable.");
    cropContext.drawImage(rotated, left, top, width, height, 0, 0, width, height);

    const scale = Math.min(1, 2200 / Math.max(width, height));
    const output = document.createElement("canvas");
    output.width = Math.max(1, Math.round(width * scale));
    output.height = Math.max(1, Math.round(height * scale));
    const outputContext = output.getContext("2d");
    if (!outputContext) throw new Error("Processed image output is unavailable.");
    outputContext.fillStyle = "#fff";
    outputContext.fillRect(0, 0, output.width, output.height);
    outputContext.drawImage(cropped, 0, 0, output.width, output.height);

    const blob = await new Promise<Blob>((resolve, reject) => output.toBlob((value) => value ? resolve(value) : reject(new Error("Image encoding failed.")), "image/jpeg", 0.86));
    const baseName = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName || "scan"}-processed.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function joinBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

async function createMultiPagePdf(pages: ReviewPage[]): Promise<File> {
  if (pages.length < 2) throw new Error("Select at least two image pages to create a multi-page PDF.");
  const encoder = new TextEncoder();
  const imagePages: { bytes: Uint8Array; width: number; height: number }[] = [];
  for (const page of pages) {
    const processed = await createProcessedImage(page.file, page.rotation, page.crop);
    const bitmap = await createImageBitmap(processed);
    imagePages.push({ bytes: new Uint8Array(await processed.arrayBuffer()), width: bitmap.width, height: bitmap.height });
    bitmap.close();
  }

  const objects: Uint8Array[] = [];
  const offsets: number[] = [0];
  let byteOffset = 0;
  const pushObject = (id: number, chunks: Uint8Array[]) => {
    const objectBytes = joinBytes([encoder.encode(`${id} 0 obj\n`), ...chunks, encoder.encode("\nendobj\n")]);
    offsets[id] = byteOffset;
    objects.push(objectBytes);
    byteOffset += objectBytes.length;
  };
  const maxObjectId = 2 + imagePages.length * 3;
  pushObject(1, [encoder.encode("<< /Type /Catalog /Pages 2 0 R >>")]);
  const pageIds = imagePages.map((_, index) => 3 + index * 3);
  pushObject(2, [encoder.encode(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${imagePages.length} >>`)]);

  imagePages.forEach((page, index) => {
    const pageId = 3 + index * 3;
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    const content = encoder.encode(`q\n${page.width} 0 0 ${page.height} 0 0 cm\n/Im0 Do\nQ\n`);
    pushObject(pageId, [encoder.encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`)]);
    pushObject(contentId, [encoder.encode(`<< /Length ${content.length} >>\nstream\n`), content, encoder.encode("endstream")]);
    pushObject(imageId, [
      encoder.encode(`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`),
      page.bytes,
      encoder.encode("\nendstream"),
    ]);
  });

  const header = encoder.encode("%PDF-1.4\n%âãÏÓ\n");
  const allObjects = joinBytes(objects);
  const finalOffset = header.length + allObjects.length;
  const xrefRows = ["0000000000 65535 f ", ...Array.from({ length: maxObjectId }, (_, index) => `${String(offsets[index + 1] + header.length).padStart(10, "0")} 00000 n `)];
  const xref = encoder.encode(`xref\n0 ${maxObjectId + 1}\n${xrefRows.join("\n")}\ntrailer\n<< /Size ${maxObjectId + 1} /Root 1 0 R >>\nstartxref\n${finalOffset}\n%%EOF`);
  return new File([joinBytes([header, allObjects, xref])], `SolenOS-scan-${new Date().toISOString().slice(0, 10)}.pdf`, { type: "application/pdf", lastModified: Date.now() });
}

export default function DocumentsPage() {
  const [intakeMode, setIntakeMode] = useState<"upload" | "capture" | "scan" | null>(null);
  const cropDrag = useRef<{ index: number; startX: number; startY: number; width: number; height: number; crop: CropInsets } | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const snapInputRef = useRef<HTMLInputElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPages, setCapturedPages] = useState<File[]>([]);
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
    const pages: ReviewPage[] = files.map((file) => {
      const isScannedImage = file.type.startsWith("image/");
      return {
        ingestionKey: crypto.randomUUID(),
        captureTimestamp: new Date().toISOString(),
        file,
        text: "",
        note: "Original file is ready. SolenOS will extract and process it after the upload is saved.",
        reviewed: false,
        uncertain: false,
        rotation: 0,
        crop: { top: 0, right: 0, bottom: 0, left: 0 },
        prepared: true,
        previewUrl: isScannedImage ? URL.createObjectURL(file) : file.type === "application/pdf" ? URL.createObjectURL(file) : null,
      };
    });
    setReviewPages((current) => [...current, ...pages]);
    setUploadMessage({ kind: "success", text: `${files.length} original file(s) ready to save. Text extraction and document understanding will run after upload.` });
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


  const prepareImagePage = async (index: number) => {
    const page = reviewPages[index];
    if (!page || !page.file.type.startsWith("image/")) return;
    if (page.crop.left + page.crop.right >= 80 || page.crop.top + page.crop.bottom >= 80) {
      setUploadMessage({ kind: "error", text: "The crop area is too small. Leave at least 20% of the page in each direction." });
      return;
    }
    setUploadMessage(null);
    setReviewPages((current) => current.map((item, i) => i === index
      ? { ...item, prepared: true, reviewed: false, note: "Page adjustments saved. SolenOS will apply the saved crop and rotation during server-side extraction after upload." }
      : item));
  };

  const combineImagePagesIntoPdf = async () => {
    const imagePages = reviewPages.filter((page) => page.file.type.startsWith("image/"));
    if (imagePages.length < 2) {
      setUploadMessage({ kind: "error", text: "Add at least two image pages before creating a combined PDF." });
      return;
    }
    if (imagePages.some((page) => !page.prepared)) {
      setUploadMessage({ kind: "error", text: "Save crop/straighten settings for each image page before combining them." });
      return;
    }
    setPreparingScan(true);
    setUploadMessage(null);
    try {
      const pdfFile = await createMultiPagePdf(imagePages);
      if (pdfFile.size > MAX_FILE_BYTES) throw new Error("The combined PDF exceeds the 10 MiB upload limit. Combine fewer pages or split this document into smaller PDFs.");
      const combinedText = imagePages.map((page, index) => `[Page ${index + 1}]\n${page.uncertain ? "[UNCERTAIN EXTRACTION] " : ""}${page.text.trim() || "[No readable text extracted; consult original page.]"}`).join("\n\n");
      const existingPdf = reviewPages.some((page) => page.file.type === "application/pdf" && page.file.name === pdfFile.name);
      if (existingPdf) {
        setUploadMessage({ kind: "error", text: "A combined PDF with this name is already in the review list. Save or discard this batch before creating another." });
        return;
      }
      setReviewPages((current) => [...current, {
        ingestionKey: crypto.randomUUID(),
        captureTimestamp: new Date().toISOString(),
        file: pdfFile,
        text: combinedText,
        note: "Combined multi-page PDF generated from the reviewed scan pages below. Original uploaded page files remain separate and unchanged.",
        reviewed: true,
        uncertain: imagePages.some((page) => page.uncertain),
        rotation: 0,
        crop: { top: 0, right: 0, bottom: 0, left: 0 },
        prepared: true,
        previewUrl: URL.createObjectURL(pdfFile),
      }]);
      setUploadMessage({ kind: "success", text: `Created a ${imagePages.length}-page PDF. The individual original scans will also be preserved when you save this batch.` });
    } catch (error) {
      setUploadMessage({ kind: "error", text: error instanceof Error ? error.message : "Could not create the combined PDF. The individual original scans are still in the review list." });
    } finally {
      setPreparingScan(false);
    }
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
        // The server extracts from the preserved original. Browser text is not authoritative.
        form.append("scan_review_status", "not_reviewed");
        form.append("scan_rotation_degrees", String(page.rotation));
        form.append("scan_crop_json", JSON.stringify(page.crop));
        form.append("scan_text_prepared", "false");
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
      reviewPages.forEach((page) => { if (page.previewUrl) URL.revokeObjectURL(page.previewUrl); });
      setReviewPages([]);
      setIntakeMode(null);
      setUploadMessage({
        kind: "success",
        text: `Saved ${saved} original file(s). Background extraction and document understanding are queued, running or already complete for ${backgroundProcessingQueued}; ${backgroundQueueUnavailable} file(s) need processing attention. You can leave this page. SolenOS will not add extracted statements to the Living Care Record without the required evidence review.`,
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
        <input ref={uploadInputRef} type="file" multiple accept="image/*,application/pdf,text/*,.doc,.docx,.rtf,.odt,.csv,.json,.xml" style={{ display: "none" }} onChange={(event) => { const files = event.currentTarget.files; event.currentTarget.value = ""; setIntakeMode("upload"); void handleFiles(files); }} />
        <input ref={snapInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(event) => { const files = event.currentTarget.files; event.currentTarget.value = ""; setIntakeMode("capture"); void handleFiles(files); }} />
        <button type="button" onClick={() => uploadInputRef.current?.click()} disabled={uploading || preparingScan} style={{ minHeight: 46, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, border: "1px solid #8eae8a", borderRadius: 9, background: "#b9d5b5", color: "#17251c", fontWeight: 700, padding: "10px 12px" }}><Upload size={17} />Upload files</button>
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


        {reviewPages.length > 0 && <section aria-label="Save original documents" style={{ marginTop: 16, padding: 14, border: "2px solid #8eae8a", borderRadius: 12, background: "var(--bg)" }}>
          <h3 style={{ margin: 0, fontSize: 17 }}>Save your files</h3>
          <p style={{ margin: "6px 0 12px", fontSize: 13, lineHeight: 1.5, color: "var(--text-secondary)" }}>{intakeMode === "scan" ? "Save your captured pages now. SolenOS will process them after upload." : "Save the original file now. SolenOS will process it after upload."} Original files are preserved.</p>
          <button type="button" onClick={() => void combineImagePagesIntoPdf()} disabled={preparingScan || uploading || reviewPages.filter((page) => page.file.type.startsWith("image/")).length < 2} style={{ minHeight: 42, marginBottom: 12, border: "1px solid #8eae8a", borderRadius: 8, padding: "8px 12px", background: "#b9d5b5", color: "#17251c", fontWeight: 700 }}>Combine image pages into one PDF</button>
          <p style={{ margin: "6px 0 12px", fontSize: 13, lineHeight: 1.5, color: "var(--text-secondary)" }}>You do not need to read or correct extracted text before saving. SolenOS preserves the original and processes it in the background. Unclear results remain marked as uncertain.</p>
          <p style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.5, color: "var(--text-secondary)" }}><strong>About scanned text:</strong> The original page is preserved. Server OCR uses your saved crop and rotation settings when available. You can review statements later; no extracted statement becomes an LCR fact until you accept it.</p>
          <div style={{ display: "grid", gap: 12 }}>{reviewPages.map((page, index) => <article key={index + "-" + page.file.name + "-" + page.file.lastModified} style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)" }}>
            <strong style={{ overflowWrap: "anywhere" }}>{page.file.name}</strong><p style={{ margin: "4px 0 8px", fontSize: 12, color: "var(--text-secondary)" }}>{formatBytes(page.file.size)} · Original file · Server processing after upload</p>
            {page.file.type === "application/pdf" && page.previewUrl && <iframe title={page.file.name + " preview"} src={page.previewUrl} style={{ width: "100%", height: 320, border: "1px solid var(--border)", borderRadius: 8 }} />}
            {page.previewUrl && page.file.type.startsWith("image/") && <div style={{ display: "grid", gap: 8, margin: "10px 0" }}>
              <div data-scan-crop-stage style={{ position: "relative", width: "fit-content", maxWidth: "100%", margin: "0 auto", touchAction: "none", transform: `rotate(${page.rotation}deg)`, transformOrigin: "center center" }}>
                <img src={page.previewUrl} alt={`Original scan preview: ${page.file.name}`} style={{ display: "block", maxWidth: "100%", maxHeight: 300, objectFit: "contain", pointerEvents: "none" }} />
                <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: `${page.crop.top}%`, background: "rgba(12,18,14,.48)" }} />
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${page.crop.bottom}%`, background: "rgba(12,18,14,.48)" }} />
                  <div style={{ position: "absolute", top: `${page.crop.top}%`, bottom: `${page.crop.bottom}%`, left: 0, width: `${page.crop.left}%`, background: "rgba(12,18,14,.48)" }} />
                  <div style={{ position: "absolute", top: `${page.crop.top}%`, bottom: `${page.crop.bottom}%`, right: 0, width: `${page.crop.right}%`, background: "rgba(12,18,14,.48)" }} />
                </div>
                <div role="slider" aria-label={`Move crop area for ${page.file.name}`} aria-valuetext={`Left ${page.crop.left}%, top ${page.crop.top}%, right ${page.crop.right}%, bottom ${page.crop.bottom}%`} tabIndex={0}
                  onPointerDown={(event) => {
                    const stageElement = event.currentTarget.closest("[data-scan-crop-stage]");
                    if (!stageElement) return;
                    const bounds = stageElement.getBoundingClientRect();
                    cropDrag.current = { index, startX: event.clientX, startY: event.clientY, width: bounds.width, height: bounds.height, crop: page.crop };
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  onPointerMove={(event) => {
                    const drag = cropDrag.current;
                    if (!drag || drag.index !== index || drag.width <= 0 || drag.height <= 0) return;
                    const dx = (event.clientX - drag.startX) / drag.width * 100;
                    const dy = (event.clientY - drag.startY) / drag.height * 100;
                    const left = Math.max(0, Math.min(80 - drag.crop.right, drag.crop.left + dx));
                    const top = Math.max(0, Math.min(80 - drag.crop.bottom, drag.crop.top + dy));
                    setReviewPages((current) => current.map((item, i) => i === index ? { ...item, crop: { ...item.crop, left, top }, prepared: false, reviewed: false, text: "", note: "Crop area moved. Apply adjustments and re-extract text." } : item));
                  }}
                  onPointerUp={() => { cropDrag.current = null; }}
                  onPointerCancel={() => { cropDrag.current = null; }}
                  onKeyDown={(event) => {
                    const step = event.shiftKey ? 5 : 1;
                    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
                    event.preventDefault();
                    setReviewPages((current) => current.map((item, i) => {
                      if (i !== index) return item;
                      const crop = { ...item.crop };
                      if (event.key === "ArrowLeft") crop.left = Math.max(0, crop.left - step);
                      if (event.key === "ArrowRight") crop.left = Math.min(80 - crop.right, crop.left + step);
                      if (event.key === "ArrowUp") crop.top = Math.max(0, crop.top - step);
                      if (event.key === "ArrowDown") crop.top = Math.min(80 - crop.bottom, crop.top + step);
                      return { ...item, crop, prepared: false, reviewed: false, text: "", note: "Crop area moved. Apply adjustments and re-extract text." };
                    }));
                  }}
                  style={{ position: "absolute", left: `${page.crop.left}%`, top: `${page.crop.top}%`, width: `${100 - page.crop.left - page.crop.right}%`, height: `${100 - page.crop.top - page.crop.bottom}%`, border: "2px solid #fff", boxShadow: "0 0 0 1px #17251c", cursor: "move", touchAction: "none", boxSizing: "border-box", background: "transparent" }} />
              </div>
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
              <button type="button" onClick={() => void prepareImagePage(index)} disabled={preparingScan || uploading} style={{ justifySelf: "start", minHeight: 42, border: "1px solid #8eae8a", borderRadius: 8, padding: "8px 12px", background: "#b9d5b5", color: "#17251c", fontWeight: 700 }}>Save crop / straighten settings</button>
            </div>}
            {page.note && <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text-secondary)" }}>{page.note}</p>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}><button type="button" onClick={() => { if (page.previewUrl) URL.revokeObjectURL(page.previewUrl); setReviewPages((current) => current.filter((_, i) => i !== index)); }} disabled={uploading} style={{ justifySelf: "start", minHeight: 38, border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", background: "var(--surface)", color: "var(--text)" }}>Remove</button></div>
          </article>)}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}><button type="button" onClick={() => void saveReviewedPages()} disabled={uploading || preparingScan || reviewPages.length === 0} style={{ minHeight: 44, display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid #8eae8a", borderRadius: 9, background: "#b9d5b5", color: "#17251c", fontWeight: 750, padding: "10px 13px" }}>{uploading ? <LoaderCircle size={17} className="animate-spin" /> : <ShieldCheck size={17} />}Save files</button><button type="button" onClick={() => setReviewPages([])} disabled={uploading} style={{ minHeight: 44, border: "1px solid var(--border)", borderRadius: 9, background: "var(--surface)", color: "var(--text)", padding: "10px 13px" }}>Discard review</button></div>
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
