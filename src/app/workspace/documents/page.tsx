"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
  Trash2,
  Upload,
  X,
} from "lucide-react";

import {
  ApiResponseError,
  deleteJSON,
  ensureAnonymousSession,
  getBlob,
  getCaregiverId,
  getJSON,
  getPersonId,
  postFormData,
  postJSON,
} from "@/api/client";
import DocumentIntelligenceReview from "@/components/DocumentIntelligenceReview";
import { LivingArchiveMark } from "@/components/brand";
import { caregiverSourceText, caregiverSafeAssistantText, caregiverSafeGeneratedText } from "@/lib/caregiver-language";
import { RecordState } from "@/components/ui/RecordState";
import { sendQueuedCareWrite } from "@/lib/offline-sync/send-queued-care-write";
import {
  deliverDurableWrite,
  discardBlockedDurableWrites,
  enqueueDurableWrite,
  getDurableWriteSummary,
  retryBlockedDurableWrites,
  syncDurableWrites,
} from "@/lib/offline-sync/durable-write-queue";

type EvidenceRecord = {
  id: string;
  type?: string;
  source_text?: string | null;
  source_type?: string | null;
  evidence_status?: string | null;
  parent_evidence_id?: string | null;
  uploaded_at?: string | null;
  created_at?: string | null;
  occurred_at?: string | null;
  time_provenance?: string | null;
  extra_metadata?: string | Record<string, unknown> | null;
};

type DocumentItem = {
  id: string;
  title: string;
  mimeType: string;
  sizeBytes: number | null;
  sha256: string | null;
  uploadedAt: string | null;
  careDate: string | null;
  careDateLabel: string;
  rotationDegrees: number;
  status: string;
  extractedText: string;
  possibleVersionOfEvidenceId?: string | null;
  duplicateOfEvidenceId?: string | null;
  recoverySourceEvidenceId?: string | null;
  recoverySourcePageNumber?: number | null;
  evidence: EvidenceRecord;
};

type UploadMessage = { kind: "success" | "error"; text: string } | null;
type VersionComparison = {
  comparison_status: "available" | "pending";
  added?: Array<{ field_type?: string; subject?: string; statement?: string; page_number?: number | null }>;
  removed?: Array<{ field_type?: string; subject?: string; statement?: string; page_number?: number | null }>;
  changed?: Array<{ field_type?: string; subject?: string; previous_statements?: Array<{ statement?: string; page_number?: number | null }>; replacement_statements?: Array<{ statement?: string; page_number?: number | null }> }>;
  reason?: string;
};
type CropInsets = { top: number; right: number; bottom: number; left: number };
type ReviewPage = { ingestionKey: string; captureTimestamp: string; file: File; note: string | null; rotation: number; crop: CropInsets; previewUrl: string | null; sourcePageNumber?: number; sourceEvidenceId?: string };

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
  const capture = meta.capture && typeof meta.capture === "object" ? meta.capture as Record<string, unknown> : {};
  const title = caregiverSourceText(asString(meta.filename)) || "Untitled document";
  return {
    id: item.id,
    title,
    mimeType: asString(meta.mime_type) || "application/octet-stream",
    sizeBytes: asNumber(meta.size_bytes),
    sha256: asString(meta.sha256) || null,
    uploadedAt: item.uploaded_at || item.created_at || null,
    careDate: item.occurred_at || null,
    careDateLabel: item.time_provenance === "document_date" ? "Date on document" : "Care date",
    rotationDegrees: asNumber(capture.photo_rotation_degrees) ?? 0,
    status: item.evidence_status || "recorded",
    extractedText: item.source_text || "",
    possibleVersionOfEvidenceId: asString(meta.possible_version_of_evidence_id) || null,
    duplicateOfEvidenceId: asString(meta.duplicate_of_evidence_id) || null,
    recoverySourceEvidenceId: asString(capture.source_evidence_id) || null,
    recoverySourcePageNumber: asNumber(capture.source_page_number),
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

const MAX_OFFLINE_DOCUMENT_BYTES = 8 * 1024 * 1024;

async function encodeDocumentForOfflineQueue(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return window.btoa(binary);
}

export default function DocumentsPage() {
  const [intakeMode, setIntakeMode] = useState<"upload" | "capture" | "scan" | null>(null);
  const cropDrag = useRef<{ index: number; startX: number; startY: number; width: number; height: number; crop: CropInsets } | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const snapInputRef = useRef<HTMLInputElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<"environment" | "user">("environment");
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPages, setCapturedPages] = useState<File[]>([]);
  const [recoveryPageNumbers, setRecoveryPageNumbers] = useState<number[]>([]);
  const [recoverySourceEvidenceId, setRecoverySourceEvidenceId] = useState<string | null>(null);
  const [reviewPages, setReviewPages] = useState<ReviewPage[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const documentLoadSequenceRef = useRef(0);
  const loadedDocumentScopeRef = useRef<{ personId: string; caregiverId: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<UploadMessage>(null);
  const [pendingUploads, setPendingUploads] = useState(0);
  const [attentionUploads, setAttentionUploads] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [historyReturnTo, setHistoryReturnTo] = useState<string | null>(null);
  const requestedEvidenceIdRef = useRef<string | null>(null);
  const previewRequestSequenceRef = useRef(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [deletingDocument, setDeletingDocument] = useState(false);
  const [versionPredecessorId, setVersionPredecessorId] = useState("");
  const [linkingVersion, setLinkingVersion] = useState(false);
  const [versionComparison, setVersionComparison] = useState<VersionComparison | null>(null);
  const [versionComparisonError, setVersionComparisonError] = useState<string | null>(null);
  const [versionComparisonLoading, setVersionComparisonLoading] = useState(false);
  const versionComparisonRequestSequenceRef = useRef(0);
  const [listError, setListError] = useState<string | null>(null);
  const [documentIntelligenceRefresh, setDocumentIntelligenceRefresh] = useState(0);

  const loadDocuments = useCallback(async (quiet = false) => {
    const requestSequence = ++documentLoadSequenceRef.current;
    let requestPersonId: string | null = null;
    let requestCaregiverId: string | null = null;
    const isCurrentRequest = () =>
      documentLoadSequenceRef.current === requestSequence
      && (!requestPersonId || requestPersonId === getPersonId())
      && (!requestCaregiverId || requestCaregiverId === getCaregiverId());
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setListError(null);
    try {
      const session = await ensureAnonymousSession();
      // A session lookup can resolve after a newer refresh or person switch.
      // Stop before mutating the loaded scope or clearing the newer view.
      if (!isCurrentRequest()) return;
      const personId = session.person.id;
      const caregiverId = session.caregiver.id;
      requestPersonId = personId;
      requestCaregiverId = caregiverId;
      if (loadedDocumentScopeRef.current && (
        loadedDocumentScopeRef.current.personId !== personId
        || loadedDocumentScopeRef.current.caregiverId !== caregiverId
      )) {
        setDocuments([]);
        previewRequestSequenceRef.current += 1;
        setSelectedId(null);
        setPreviewUrl(null);
        setPreviewError(null);
        setVersionComparison(null);
        setVersionPredecessorId("");
        setQuery("");
        setCapturedPages([]);
        setReviewPages([]);
        setIntakeMode(null);
        setUploadMessage(null);
        setPendingUploads(0);
        setAttentionUploads(0);
        setCameraOpen(false);
        cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
      loadedDocumentScopeRef.current = { personId, caregiverId };
      const result = await getJSON("/evidence/" + encodeURIComponent(personId));
      if (!Array.isArray(result)) throw new Error("The document list returned an unexpected response.");
      const next = (result as EvidenceRecord[])
        .filter((item): item is EvidenceRecord & { type: string } => Boolean(item && typeof item.type === "string" && ["document", "care_photo", "medication_photo"].includes(item.type) && typeof item.id === "string" && item.id.length > 0))
        .map(toDocument)
        .sort((a, b) => (b.uploadedAt || "").localeCompare(a.uploadedAt || ""));
      if (isCurrentRequest()) setDocuments(next);
    } catch (cause) {
      if (isCurrentRequest()) {
        const accessDenied = cause instanceof ApiResponseError
          && (cause.status === 401 || cause.status === 403);
        if (!requestPersonId || !requestCaregiverId || accessDenied) {
          // A confirmed session with denied access is not a transient network
          // failure. Do not leave private document names, extracted text, or
          // previews visible after the backend rejects this identity.
          setDocuments([]);
          setSelectedId(null);
          setPreviewUrl(null);
          setPreviewError(null);
          setVersionComparison(null);
          setVersionPredecessorId("");
          setQuery("");
          setCapturedPages([]);
          setReviewPages([]);
          setIntakeMode(null);
          setUploadMessage(null);
          setPendingUploads(0);
          setAttentionUploads(0);
          setCameraOpen(false);
          cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
          cameraStreamRef.current = null;
          loadedDocumentScopeRef.current = null;
        }
        setListError("SolenOS could not load saved files and photos. Your saved items have not been deleted. Check the connection and try again.");
      }
    } finally {
      if (isCurrentRequest()) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const refreshForSessionChange = () => void loadDocuments();
    window.addEventListener("personIdChanged", refreshForSessionChange);
    void loadDocuments();
    return () => window.removeEventListener("personIdChanged", refreshForSessionChange);
  }, [loadDocuments]);

  useEffect(() => {
    let active = true;
    let syncSequence = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const sync = async () => {
      const requestSequence = ++syncSequence;
      const personId = getPersonId();
      const caregiverId = getCaregiverId();
      const isCurrent = () =>
        active &&
        requestSequence === syncSequence &&
        personId === getPersonId() &&
        caregiverId === getCaregiverId();
      if (!personId || !caregiverId) return;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      try {
        const summary = await getDurableWriteSummary(personId, caregiverId, ["/upload"]);
        if (!isCurrent()) return;
        setPendingUploads(summary.pending);
        setAttentionUploads(summary.blocked + summary.failed_recoverable);
        if (typeof navigator !== "undefined" && !navigator.onLine) return;
        const result = await syncDurableWrites({
          personId,
          caregiverId,
          send: sendQueuedCareWrite,
          endpoints: ["/upload"],
        });
        if (!isCurrent()) return;
        const afterSync = await getDurableWriteSummary(personId, caregiverId);
        if (!isCurrent()) return;
        setPendingUploads(afterSync.pending);
        setAttentionUploads(afterSync.blocked + afterSync.failed_recoverable);
        if (afterSync.pending > 0 && typeof navigator !== "undefined" && navigator.onLine) {
          retryTimer = setTimeout(() => {
            if (isCurrent()) void sync();
          }, 5_000);
        }
        if (result.synced > 0) {
          setUploadMessage({
            kind: "success",
            text: result.synced + " pending update" + (result.synced === 1 ? " has" : "s have") + " synced to the care record.",
          });
          await loadDocuments(true);
          if (!isCurrent()) return;
          setDocumentIntelligenceRefresh((value) => value + 1);
          window.dispatchEvent(new Event("careRecordUpdated"));
        }
      } catch {
        // The encrypted queue retains files until the backend confirms each write.
      }
    };
    void sync();
    window.addEventListener("online", sync);
    window.addEventListener("personIdChanged", sync);
    window.addEventListener("solenos:offline-queue-updated", sync);
    return () => {
      active = false;
      syncSequence += 1;
      if (retryTimer) clearTimeout(retryTimer);
      window.removeEventListener("online", sync);
      window.removeEventListener("personIdChanged", sync);
      window.removeEventListener("solenos:offline-queue-updated", sync);
    };
  }, [loadDocuments]);

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

  const handleFiles = async (fileList: FileList | File[] | null, sourcePageNumbers: number[] = [], sourceEvidenceId?: string | null) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploadMessage(null);
    const invalid = files.find((file) => file.size <= 0 || file.size > MAX_FILE_BYTES);
    if (invalid) {
      setUploadMessage({ kind: "error", text: invalid.size <= 0 ? `${invalid.name} is empty.` : `${invalid.name} is too large to upload. Choose a smaller file.` });
      return;
    }
    const pages: ReviewPage[] = files.map((file, index) => {
      const isScannedImage = file.type.startsWith("image/");
      return {
        ingestionKey: crypto.randomUUID(),
        captureTimestamp: new Date().toISOString(),
        file,
        note: "Your original file is ready. SolenOS will read it and prepare details for you to check after upload.",
        rotation: 0,
        crop: { top: 0, right: 0, bottom: 0, left: 0 },
        previewUrl: isScannedImage ? URL.createObjectURL(file) : file.type === "application/pdf" ? URL.createObjectURL(file) : null,
        ...(Number.isInteger(sourcePageNumbers[index]) && sourcePageNumbers[index] > 0 ? { sourcePageNumber: sourcePageNumbers[index] } : {}),
        ...(sourceEvidenceId ? { sourceEvidenceId } : {}),
      };
    });
    setReviewPages((current) => [...current, ...pages]);
    setUploadMessage({ kind: "success", text: `${files.length} ${files.length === 1 ? "file is" : "files are"} ready to save. SolenOS will read them and prepare details for you to check after upload.` });
  };

  const loadVersionComparison = useCallback(async (evidenceId: string) => {
    const requestSequence = ++versionComparisonRequestSequenceRef.current;
    setVersionComparison(null);
    setVersionComparisonError(null);
    setVersionComparisonLoading(true);
    try {
      const result = await getJSON("/upload/" + encodeURIComponent(evidenceId) + "/version-comparison") as VersionComparison;
      if (versionComparisonRequestSequenceRef.current === requestSequence) setVersionComparison(result);
    } catch {
      if (versionComparisonRequestSequenceRef.current === requestSequence) {
        setVersionComparisonError("We could not compare these document versions. No conclusion about what changed is available yet.");
      }
    } finally {
      if (versionComparisonRequestSequenceRef.current === requestSequence) setVersionComparisonLoading(false);
    }
  }, []);

  useEffect(() => {
    const requestSequence = ++versionComparisonRequestSequenceRef.current;
    setVersionPredecessorId(selected?.possibleVersionOfEvidenceId || "");
    const predecessorId = selected?.evidence.parent_evidence_id;
    if (!selected || !predecessorId) {
      setVersionComparison(null);
      setVersionComparisonError(null);
      setVersionComparisonLoading(false);
      return;
    }
    let active = true;
    setVersionComparison(null);
    setVersionComparisonError(null);
    setVersionComparisonLoading(true);
    void getJSON("/upload/" + encodeURIComponent(selected.id) + "/version-comparison")
      .then((result) => { if (active && versionComparisonRequestSequenceRef.current === requestSequence) setVersionComparison(result as VersionComparison); })
      .catch(() => { if (active && versionComparisonRequestSequenceRef.current === requestSequence) setVersionComparisonError("We could not compare these document versions. No conclusion about what changed is available yet."); })
      .finally(() => { if (active && versionComparisonRequestSequenceRef.current === requestSequence) setVersionComparisonLoading(false); });
    return () => {
      active = false;
      if (versionComparisonRequestSequenceRef.current === requestSequence) versionComparisonRequestSequenceRef.current += 1;
    };
  }, [selected?.id, selected?.evidence.parent_evidence_id]);

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
    void navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: cameraFacingMode } }, audio: false })
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
  }, [cameraOpen, cameraFacingMode]);

  const closeCameraScanner = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setCameraOpen(false);
    setCameraFacingMode("environment");
    setCapturedPages([]);
    setCameraError(null);
    setRecoveryPageNumbers([]);
    setRecoverySourceEvidenceId(null);
  };

  const captureCameraPage = () => {
    if (recoveryPageNumbers.length > 0 && capturedPages.length >= recoveryPageNumbers.length) return;
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
      const pageNumber = recoveryPageNumbers[capturedPages.length] || capturedPages.length + 1;
      const page = new File([blob], `solenos-scan-page-${pageNumber}-${Date.now()}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
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
    void handleFiles(pages, recoveryPageNumbers, recoverySourceEvidenceId);
  };


  const saveReviewedPages = async () => {
    if (!reviewPages.length) {
      setUploadMessage({ kind: "error", text: "Choose a file or scan page before saving." });
      return;
    }
    setUploading(true);
    setUploadProgress("Preparing " + reviewPages.length + " original " + (reviewPages.length === 1 ? "file" : "files") + " to save.");
    setUploadMessage(null);
    let saved = 0;
    let queuedLocally = 0;
    let backgroundProcessingQueued = 0;
    let backgroundProcessingCompleted = 0;
    let backgroundQueueUnavailable = 0;
    let failed = 0;
    const completedKeys = new Set<string>();
    const remainingPages: ReviewPage[] = [];

    try {
      let personId = getPersonId();
      let caregiverId = getCaregiverId();
      if (!personId || !caregiverId) {
        const session = await ensureAnonymousSession();
        personId = session.person.id;
        caregiverId = session.caregiver.id;
      }

      let scanPageNumber = 0;
      for (let pageIndex = 0; pageIndex < reviewPages.length; pageIndex += 1) {
        const page = reviewPages[pageIndex];
        setUploadProgress("Saving original " + (pageIndex + 1) + " of " + reviewPages.length + ": " + page.file.name);
        if (intakeMode === "scan" && page.file.type.startsWith("image/")) scanPageNumber += 1;

        const fields: Record<string, string> = {
          ingestion_key: page.ingestionKey,
          person_id: personId,
          caregiver_id: caregiverId,
          evidence_type: "document",
          capture_method: intakeMode === "scan" ? "scan" : intakeMode === "capture" ? "snap" : "upload",
          capture_timestamp: page.captureTimestamp,
          scan_review_status: "not_reviewed",
          scan_rotation_degrees: String(page.rotation),
          scan_crop_json: JSON.stringify(page.crop),
          scan_text_prepared: "false",
        };
        if (intakeMode === "scan" && page.file.type.startsWith("image/")) {
          fields.capture_page_number = String(page.sourcePageNumber ?? scanPageNumber);
          if (page.sourceEvidenceId) fields.capture_source_evidence_id = page.sourceEvidenceId;
        }

        let queueId: string | null = null;
        try {
          if (page.file.size <= MAX_OFFLINE_DOCUMENT_BYTES) {
            try {
              queueId = await enqueueDurableWrite({
                person_id: personId,
                caregiver_id: caregiverId,
                endpoint: "/upload",
                idempotency_key: page.ingestionKey,
                payload: {
                  offline_kind: "file_upload",
                  file_name: page.file.name,
                  mime_type: page.file.type || "application/octet-stream",
                  file_base64: await encodeDocumentForOfflineQueue(page.file),
                  fields,
                },
              });
            } catch {
              if (typeof navigator !== "undefined" && !navigator.onLine) {
                throw new Error("This device could not securely keep an offline copy.");
              }
            }
          } else if (typeof navigator !== "undefined" && !navigator.onLine) {
            throw new Error("This file is too large to keep safely on this device while offline.");
          }

          let stored: {
            evidence_id?: string;
            persisted?: boolean;
            document_processing_job_id?: string | null;
            processing_status?: string;
          };
          if (queueId) {
            stored = await deliverDurableWrite<typeof stored>(queueId, sendQueuedCareWrite);
          } else {
            const form = new FormData();
            form.append("file", page.file);
            for (const [key, value] of Object.entries(fields)) form.append(key, value);
            stored = await postFormData("/upload", form) as typeof stored;
          }

          if (!stored.persisted || !stored.evidence_id) {
            throw new Error("The server did not confirm that the original file was saved.");
          }
          saved += 1;
          completedKeys.add(page.ingestionKey);
          if (stored.document_processing_job_id && stored.processing_status === "completed") {
            backgroundProcessingCompleted += 1;
          } else if (stored.document_processing_job_id && ["queued", "processing"].includes(stored.processing_status || "")) {
            backgroundProcessingQueued += 1;
          } else {
            backgroundQueueUnavailable += 1;
          }
        } catch {
          if (queueId) {
            // The encrypted queue owns the original bytes. Do not call this a
            // care-record save; the backend has not confirmed it yet.
            queuedLocally += 1;
            completedKeys.add(page.ingestionKey);
          } else {
            failed += 1;
            remainingPages.push(page);
          }
        }
      }

      const completedPages = reviewPages.filter((page) => completedKeys.has(page.ingestionKey));
      completedPages.forEach((page) => { if (page.previewUrl) URL.revokeObjectURL(page.previewUrl); });
      setReviewPages(remainingPages);
      if (remainingPages.length === 0) { setIntakeMode(null); setRecoveryPageNumbers([]); setRecoverySourceEvidenceId(null); }

      if (saved > 0 || queuedLocally > 0) {
        const parts: string[] = [];
        if (saved > 0) {
          parts.push("SolenOS saved " + saved + " original " + (saved === 1 ? "file" : "files") + " to your care record.");
        }
        if (queuedLocally > 0) {
          parts.push(queuedLocally + " " + (queuedLocally === 1 ? "file is" : "files are") + " kept on this device for now. They have not been added to your Care Record yet. They will upload when your connection returns.");
        }
        if (backgroundProcessingQueued > 0) {
          parts.push("SolenOS has started reading " + backgroundProcessingQueued + " " + (backgroundProcessingQueued === 1 ? "file" : "files") + ". You can leave this page while it finishes.");
        }
        if (backgroundProcessingCompleted > 0) {
          parts.push("SolenOS has finished processing " + backgroundProcessingCompleted + " " + (backgroundProcessingCompleted === 1 ? "file" : "files") + ". Open each file to see what was extracted and whether anything needs your review.");
        }
        if (backgroundQueueUnavailable > 0) {
          parts.push(backgroundQueueUnavailable + " " + (backgroundQueueUnavailable === 1 ? "file needs" : "files need") + " another look after upload.");
        }
        if (failed > 0) {
          parts.push(failed + " file" + (failed === 1 ? " could" : "s could") + " not be saved. " + (failed === 1 ? "It remains" : "They remain") + " here so you can try again.");
        }
        parts.push("Suggested details will not be added to your Care Record until you check and approve them.");
        setUploadMessage({ kind: failed > 0 ? "error" : "success", text: parts.join(" ") });
        await loadDocuments(true);
        setDocumentIntelligenceRefresh((value) => value + 1);
      } else {
        setUploadMessage({
          kind: "error",
          text: "No files were saved. Your selected files are still here so you can try again.",
        });
      }
    } catch {
      setUploadMessage({
        kind: "error",
        text: "We couldn’t confirm that your files were saved. Your selected files are still here, and nothing has been marked as saved.",
      });
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const retryPendingUploads = async () => {
    const personId = getPersonId();
    const caregiverId = getCaregiverId();
    if (!personId || !caregiverId) return;
    try {
      await retryBlockedDurableWrites(personId, caregiverId, ["/upload"]);
      const result = await syncDurableWrites({
        personId,
        caregiverId,
        send: sendQueuedCareWrite,
        endpoints: ["/upload"],
      });
      const summary = await getDurableWriteSummary(personId, caregiverId, ["/upload"]);
      setPendingUploads(summary.pending);
      setAttentionUploads(summary.blocked + summary.failed_recoverable);
      if (result.synced > 0) {
        setUploadMessage({ kind: "success", text: result.synced + " pending file upload" + (result.synced === 1 ? " has" : "s have") + " synced to the care record." });
        await loadDocuments(true);
        setDocumentIntelligenceRefresh((value) => value + 1);
      }
    } catch {
      setUploadMessage({ kind: "error", text: "SolenOS could not retry the pending file uploads. The encrypted originals remain on this device." });
    }
  };

  const removeBlockedUploads = async () => {
    const personId = getPersonId();
    const caregiverId = getCaregiverId();
    if (!personId || !caregiverId) return;
    await discardBlockedDurableWrites(personId, caregiverId, ["/upload"]);
    const summary = await getDurableWriteSummary(personId, caregiverId, ["/upload"]);
    setPendingUploads(summary.pending);
    setAttentionUploads(summary.blocked + summary.failed_recoverable);
  };

  const openOriginal = useCallback(async (doc: DocumentItem) => {
    const requestSequence = ++previewRequestSequenceRef.current;
    const requestPersonId = getPersonId();
    const requestCaregiverId = getCaregiverId();
    const isCurrentRequest = () =>
      requestSequence === previewRequestSequenceRef.current
      && Boolean(requestPersonId)
      && Boolean(requestCaregiverId)
      && requestPersonId === getPersonId()
      && requestCaregiverId === getCaregiverId();

    setSelectedId(doc.id);
    setPreviewError(null);
    setPreviewLoading(true);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (!requestPersonId || !requestCaregiverId) {
      setPreviewError("Reconnect to the care record before opening this document.");
      setPreviewLoading(false);
      return;
    }
    try {
      const blob = await getBlob("/upload/" + encodeURIComponent(doc.id));
      if (!isCurrentRequest()) return;
      setPreviewUrl(URL.createObjectURL(blob));
    } catch {
      if (isCurrentRequest()) {
        setPreviewError("The document details are saved, but the original file could not be opened. Try again or refresh the list.");
      }
    } finally {
      if (isCurrentRequest()) setPreviewLoading(false);
    }
  }, [previewUrl]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedReturnTo = params.get("returnTo");
    setHistoryReturnTo(null);
    if (requestedReturnTo) {
      try {
        const parsedReturnTo = new URL(requestedReturnTo, window.location.origin);
        if (parsedReturnTo.origin === window.location.origin && parsedReturnTo.pathname === "/workspace/timeline") {
          setHistoryReturnTo(parsedReturnTo.pathname + parsedReturnTo.search);
        }
      } catch {
        setHistoryReturnTo(null);
      }
    }
    const requestedEvidenceId = params.get("evidenceId");
    if (!requestedEvidenceId || loading || listError || requestedEvidenceIdRef.current === requestedEvidenceId) return;
    const matchingDocument = documents.find((doc) => doc.id === requestedEvidenceId || doc.evidence.id === requestedEvidenceId);
    requestedEvidenceIdRef.current = requestedEvidenceId;
    if (!matchingDocument) {
      setListError("This source document is not available in the current saved document list. The care history entry remains available.");
      return;
    }
    void openOriginal(matchingDocument);
  }, [documents, loading, listError, openOriginal]);

  const closePreview = () => {
    previewRequestSequenceRef.current += 1;
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

  const linkSelectedVersion = async () => {
    if (!selected || !versionPredecessorId || linkingVersion) return;
    setLinkingVersion(true);
    setPreviewError(null);
    try {
      const result = await postJSON("/upload/" + encodeURIComponent(versionPredecessorId) + "/versions", {
        replacement_evidence_id: selected.id,
      }) as { relationship?: string };
      if (result.relationship !== "corrected_version_of") throw new Error("SolenOS did not confirm the document-version link.");
      await loadDocuments(true);
      setDocumentIntelligenceRefresh((value) => value + 1);
      setUploadMessage({ kind: "success", text: "The corrected document is linked to the earlier version. Both original files are kept, and existing Care Record details have not been replaced." });
      setVersionPredecessorId("");
    } catch (error) {
      setPreviewError("SolenOS could not link these document versions. Your original files and Care Record have not been changed. Try again.");
    } finally {
      setLinkingVersion(false);
    }
  };

  const deleteSelectedDocument = async () => {
    if (!selected || deletingDocument) return;
    if (!window.confirm("Delete this document and its unreviewed details? If it supports accepted information in your Care Record or is the source for clearer page copies, SolenOS will prevent deletion until those links are resolved. This cannot be undone.")) return;
    setDeletingDocument(true);
    setPreviewError(null);
    try {
      const result = await deleteJSON("/upload/" + encodeURIComponent(selected.id)) as { deleted?: boolean };
      if (!result.deleted) throw new Error("SolenOS could not confirm that the document was deleted.");
      closePreview();
      await loadDocuments(true);
      setDocumentIntelligenceRefresh((value) => value + 1);
      setUploadMessage({ kind: "success", text: "The original document and its unaccepted suggestions were removed. The Care Record was not changed." });
    } catch (error) {
      if (error instanceof ApiResponseError && error.status === 409) {
        setPreviewError(error.message || "This document still supports saved care information. Resolve those source links before deleting it.");
      } else if (error instanceof ApiResponseError && error.status === 403) {
        setPreviewError("You do not have permission to delete this document. The original has not been removed.");
      } else {
        setPreviewError("SolenOS could not delete this document. No deletion was confirmed. Try again.");
      }
    } finally {
      setDeletingDocument(false);
    }
  };

  return (
    <div className="mobile-screen documents-page">
      <header className="mobile-page-head documents-page-head">
        {historyReturnTo && <Link href={historyReturnTo} className="documents-return-context">Back to Care history</Link>}
        <h1>Documents</h1>
        <p>One reliable place for care letters, discharge papers, prescriptions, appointment notes and other important files.</p>
      </header>
      <section className="documents-upload-actions" aria-label="Add care files and photos">
        <input ref={uploadInputRef} type="file" multiple accept="image/*,application/pdf,text/*,.doc,.docx,.rtf,.odt,.eml,.msg,.csv,.json,.xml,.yaml,.yml" className="documents-file-input" onChange={(event) => { const files = Array.from(event.currentTarget.files || []); event.currentTarget.value = ""; setIntakeMode("upload"); void handleFiles(files); }} />
        <input ref={snapInputRef} type="file" accept="image/*" capture="environment" className="documents-file-input" onChange={(event) => { const files = Array.from(event.currentTarget.files || []); event.currentTarget.value = ""; setRecoveryPageNumbers([]); setRecoverySourceEvidenceId(null); setIntakeMode("capture"); void handleFiles(files); }} />
        <button type="button" onClick={() => uploadInputRef.current?.click()} disabled={uploading} className="documents-upload-action"><Upload size={17} />Upload files</button>
        <button type="button" onClick={() => snapInputRef.current?.click()} disabled={uploading} className="documents-upload-action"><Camera size={17} />Snap a photo</button>
        <button type="button" onClick={() => { setCapturedPages([]); setRecoveryPageNumbers([]); setRecoverySourceEvidenceId(null); setCameraError(null); setCameraFacingMode("environment"); setCameraOpen(true); }} disabled={uploading} className="documents-upload-action"><ScanLine size={17} />Scan pages</button>
      </section>

      <DocumentIntelligenceReview refreshToken={documentIntelligenceRefresh} documents={documents.filter((doc) => doc.evidence.type === "document").map(({ id, title }) => ({ id, title }))} onAddClearerPages={(evidenceId, pages) => { setRecoverySourceEvidenceId(evidenceId); setRecoveryPageNumbers(pages); setCapturedPages([]); setCameraError(null); setCameraFacingMode("environment"); setIntakeMode("scan"); setCameraOpen(true); }} />

      <section className="documents-library" aria-label="Saved documents and photos">
        <div className="documents-library-heading">
          <div>
            <h2>Saved documents and photos</h2>
            <p>Your original files are kept separate from suggested details.</p>
          </div>
          <button type="button" className="documents-refresh" onClick={() => void loadDocuments(true)} disabled={refreshing || loading} aria-label="Refresh documents">
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} /> Refresh
          </button>
        </div>


        {reviewPages.length > 0 && <section aria-label="Save original documents" style={{ marginTop: 16, padding: 14, border: "2px solid var(--theme-panel-border)", borderRadius: 12, background: "var(--bg)" }}>
          <h3 style={{ margin: 0, fontSize: "calc(17px * var(--solenos-text-scale, 1))" }}>Save your files</h3>
          <p style={{ margin: "6px 0 12px", fontSize: "calc(13px * var(--solenos-text-scale, 1))", lineHeight: 1.5, color: "var(--text-secondary)" }}>{intakeMode === "scan" ? recoveryPageNumbers.length ? "Save clearer copies of pages " + reviewPages.filter((page) => page.sourcePageNumber).map((page) => page.sourcePageNumber).join(", ") + " from the earlier document. SolenOS will read these separate files after upload." : "Save your captured pages now. SolenOS will read them after upload." : "Save the original file now. SolenOS will read it after upload."} Original files are preserved.</p>
          <p style={{ margin: "6px 0 12px", fontSize: "calc(13px * var(--solenos-text-scale, 1))", lineHeight: 1.5, color: "var(--text-secondary)" }}>You do not need to read or correct the text before saving. SolenOS keeps the original and reads it in the background. Anything unclear stays marked as uncertain.</p>
          <p style={{ margin: "0 0 12px", fontSize: "calc(13px * var(--solenos-text-scale, 1))", lineHeight: 1.5, color: "var(--text-secondary)" }}><strong>About text from scanned pages:</strong> The original page is saved. SolenOS reads the text and keeps suggested details linked to the document. Review each suggested detail before it is added to your Care Record.</p>
          <div style={{ display: "grid", gap: 12 }}>{reviewPages.map((page, index) => <article key={index + "-" + page.file.name + "-" + page.file.lastModified} style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)" }}>
            <strong style={{ overflowWrap: "anywhere" }}>{page.file.name}</strong><p style={{ margin: "4px 0 8px", fontSize: "calc(12px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>{formatBytes(page.file.size)} · Original file · SolenOS will read it after upload</p>
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
                    setReviewPages((current) => current.map((item, i) => i === index ? { ...item, crop: { ...item.crop, left, top }, note: "Crop change will be saved with the original when you upload." } : item));
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
                      return { ...item, crop, note: "Crop area moved. Save the crop settings before uploading." };
                    }));
                  }}
                  style={{ position: "absolute", left: `${page.crop.left}%`, top: `${page.crop.top}%`, width: `${100 - page.crop.left - page.crop.right}%`, height: `${100 - page.crop.top - page.crop.bottom}%`, border: "2px solid #fff", boxShadow: "0 0 0 1px #17251c", cursor: "move", touchAction: "none", boxSizing: "border-box", background: "transparent" }} />
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" onClick={() => setReviewPages((current) => current.map((item, i) => i === index ? { ...item, rotation: item.rotation - 0.5, note: "Rotation change will be saved with the original when you upload." } : item))} style={{ minHeight: 38, border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", background: "var(--surface)", color: "var(--text)" }}>Straighten left 0.5°</button>
                <button type="button" onClick={() => setReviewPages((current) => current.map((item, i) => i === index ? { ...item, rotation: item.rotation + 0.5, note: "Rotation change will be saved with the original when you upload." } : item))} style={{ minHeight: 38, border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", background: "var(--surface)", color: "var(--text)" }}>Straighten right 0.5°</button>
                <button type="button" onClick={() => setReviewPages((current) => current.map((item, i) => i === index ? { ...item, rotation: item.rotation - 90, note: "Rotation change will be saved with the original when you upload." } : item))} style={{ minHeight: 38, border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", background: "var(--surface)", color: "var(--text)" }}>Rotate left 90°</button>
                <button type="button" onClick={() => setReviewPages((current) => current.map((item, i) => i === index ? { ...item, rotation: item.rotation + 90, note: "Rotation change will be saved with the original when you upload." } : item))} style={{ minHeight: 38, border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", background: "var(--surface)", color: "var(--text)" }}>Rotate right 90°</button>
              </div>
              <p style={{ margin: 0, fontSize: "calc(12px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>Straightening: {page.rotation.toFixed(1)}°. Adjust how much to trim from each edge.</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8 }}>
                {(["top", "right", "bottom", "left"] as const).map((edge) => <label key={edge} style={{ display: "grid", gap: 4, fontSize: "calc(12px * var(--solenos-text-scale, 1))", textTransform: "capitalize" }}>{edge} crop (%)<input type="number" min={0} max={35} step={1} value={page.crop[edge]} onChange={(event) => { const value = Math.max(0, Math.min(35, Number(event.target.value) || 0)); setReviewPages((current) => current.map((item, i) => i === index ? { ...item, crop: { ...item.crop, [edge]: value }, note: "Crop change will be saved with the original when you upload." } : item)); }} style={{ width: "100%", boxSizing: "border-box", minHeight: 38, border: "1px solid var(--border)", borderRadius: 7, padding: 8, background: "var(--surface)", color: "var(--text)" }} /></label>)}
              </div>
            </div>}
            {page.note && <p style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))", lineHeight: 1.5, color: "var(--text-secondary)" }}>{page.note}</p>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}><button type="button" onClick={() => { if (page.previewUrl) URL.revokeObjectURL(page.previewUrl); setReviewPages((current) => current.filter((_, i) => i !== index)); }} disabled={uploading} style={{ justifySelf: "start", minHeight: 38, border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", background: "var(--surface)", color: "var(--text)" }}>Remove</button></div>
          </article>)}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}><button type="button" onClick={() => void saveReviewedPages()} disabled={uploading || reviewPages.length === 0} style={{ minHeight: 44, display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid var(--theme-action-border)", borderRadius: 9, background: "var(--theme-action-bg)", color: "var(--theme-action-fg)", fontWeight: 750, padding: "10px 13px" }}>{uploading ? <LoaderCircle size={17} className="animate-spin" /> : <ShieldCheck size={17} />}Save files</button><button type="button" onClick={() => setReviewPages([])} disabled={uploading} style={{ minHeight: 44, border: "1px solid var(--border)", borderRadius: 9, background: "var(--surface)", color: "var(--text)", padding: "10px 13px" }}>Discard selected files</button></div>
        </section>}
        {uploading && <div style={{ margin: "12px 0 0" }}><LivingArchiveMark size="sm" label="Saving original files…" /><p role="status" style={{ margin: "6px 0 0", fontSize: "calc(13px * var(--solenos-text-scale, 1))", overflowWrap: "anywhere" }}>{uploadProgress || "Saving your original files."} Keep this page open until the originals are saved. Reading and review happen separately after the upload is confirmed.</p></div>}
        {uploadMessage && <p role={uploadMessage.kind === "error" ? "alert" : "status"} style={{ margin: "12px 0 0", padding: 12, borderRadius: 9, border: "1px solid var(--border)", fontSize: "calc(14px * var(--solenos-text-scale, 1))", lineHeight: 1.5 }}>{uploadMessage.kind === "success" ? <CheckCircle2 size={17} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} /> : <AlertCircle size={17} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />}{uploadMessage.text}</p>}
        {pendingUploads > 0 && (
          <p role="status" style={{ margin: "10px 0 0", fontSize: "calc(13px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>
            {pendingUploads} original file{pendingUploads === 1 ? " is" : "s are"} kept on this device for now. They are not in your Care Record until the upload is confirmed.
          </p>
        )}
        {attentionUploads > 0 && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
            <p role="alert" style={{ margin: 0, fontSize: "calc(13px * var(--solenos-text-scale, 1))", color: "var(--theme-danger-fg, #9b3434)" }}>
              {attentionUploads} file upload{attentionUploads === 1 ? " needs" : "s need"} attention and has not been saved to the care record.
            </p>
            <button type="button" onClick={() => void retryPendingUploads()} style={{ border: 0, background: "transparent", textDecoration: "underline", cursor: "pointer" }}>Retry file uploads</button>
            <button type="button" onClick={() => void removeBlockedUploads()} style={{ border: 0, background: "transparent", textDecoration: "underline", cursor: "pointer" }}>Remove unsaved uploads from this device</button>
          </div>
        )}
        {listError && <RecordState kind="error" description={listError} onAction={() => void loadDocuments(documents.length > 0)} />}
        {listError && documents.length > 0 && <p role="status" className="documents-list-status">These are the last documents we could load. The list may be out of date; refresh before relying on it.</p>}

        <div className="documents-search">
          <Search size={17} aria-hidden="true" />
          <input className="documents-search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search saved file names and available text" aria-label="Search documents" />
        </div>

        {loading ? <RecordState kind="loading" title="Loading saved documents" /> : listError && documents.length === 0 ? null : visibleDocuments.length === 0 ? (
          <RecordState
            kind={documents.length === 0 ? "first-empty" : "no-results"}
            title={documents.length === 0 ? "No documents added yet" : "No matching documents"}
            description={documents.length === 0 ? "Add a document to keep it with the care information in this record." : "Try another search term or clear your search."}
            actionLabel={documents.length === 0 ? "Add a document" : "Clear search"}
            onAction={documents.length === 0 ? () => uploadInputRef.current?.click() : () => setQuery("")}
          />
        ) : (
          <div className="documents-list">
            {visibleDocuments.map((doc) => (
              <button key={doc.id} type="button" className="documents-list-item" onClick={() => void openOriginal(doc)}>
                <span className="documents-list-icon">{isImage(doc.mimeType) ? <FileImage size={21} /> : <FileText size={21} />}</span>
                <span className="documents-list-copy">
                  <span className="documents-list-title">{doc.title}</span>
                  <span className="documents-list-meta">{formatBytes(doc.sizeBytes)} · Added {formatDate(doc.uploadedAt)}{doc.careDate ? ` · ${doc.careDateLabel} ${formatDate(doc.careDate)}` : ""}</span>
                  <span className="documents-list-status">{doc.duplicateOfEvidenceId ? `This is the same file as ${documents.find((item) => item.id === doc.duplicateOfEvidenceId)?.title || "another saved document"}. It stays saved, but it does not add new information.` : doc.extractedText.trim() ? "Text available to review" : "Original saved · no readable text yet"}</span>{doc.possibleVersionOfEvidenceId && <span className="documents-list-status">Possible newer or corrected copy of {documents.find((item) => item.id === doc.possibleVersionOfEvidenceId)?.title || "an earlier document"}. Compare the two before treating them as versions.</span>}{doc.recoverySourceEvidenceId && <span className="documents-list-status">Clearer copy of page {doc.recoverySourcePageNumber ?? "?"} from {documents.find((item) => item.id === doc.recoverySourceEvidenceId)?.title || "another saved document"}.</span>}
                </span>
                <span aria-hidden="true" className="documents-list-open">Open</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {cameraOpen && <div role="dialog" aria-modal="true" aria-label="Scan care document pages" style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(0,0,0,.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
        <section style={{ width: "min(720px, 100%)", maxHeight: "92dvh", display: "grid", gap: 12, padding: 14, background: "var(--surface)", color: "var(--text)", borderRadius: 14, overflow: "auto" }}>
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div><h2 style={{ margin: 0, fontSize: "calc(18px * var(--solenos-text-scale, 1))" }}>Scan pages</h2><p style={{ margin: "4px 0 0", fontSize: "calc(13px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>{recoveryPageNumbers.length ? "Take clearer copies of pages " + recoveryPageNumbers.join(", ") + " from " + (documents.find((item) => item.id === recoverySourceEvidenceId)?.title || "the saved document") + ". These copies will be saved as a separate document; the original stays unchanged." : "Capture each page. Rotate or crop only if needed, then save the originals."}</p></div>
            <button type="button" onClick={closeCameraScanner} aria-label="Close scanner" style={{ width: 40, height: 40, border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--text)" }}><X size={18} /></button>
          </header>
          <video ref={cameraVideoRef} autoPlay playsInline muted aria-label="Live document camera preview" style={{ width: "100%", maxHeight: "55dvh", background: "#111", borderRadius: 10, objectFit: "contain" }} />
          {cameraStarting && <p role="status" style={{ margin: 0 }}>Starting camera…</p>}
          {cameraError && <p role="alert" style={{ margin: 0, color: "var(--theme-error-fg)" }}>{cameraError}</p>}
          <p style={{ margin: 0, fontSize: "calc(13px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>{capturedPages.length} page(s) captured{recoveryPageNumbers.length ? " for " + recoveryPageNumbers.slice(0, capturedPages.length).map((pageNumber) => "page " + pageNumber).join(", ") : ""}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setCameraFacingMode((current) => current === "environment" ? "user" : "environment")} disabled={cameraStarting} aria-label={cameraFacingMode === "environment" ? "Switch to front camera" : "Switch to back camera"} style={{ minHeight: 44, border: "1px solid var(--border)", borderRadius: 9, background: "var(--surface)", color: "var(--text)", padding: "9px 13px" }}>{cameraFacingMode === "environment" ? "Use front camera" : "Use back camera"}</button>
            <button type="button" onClick={captureCameraPage} disabled={cameraStarting || (recoveryPageNumbers.length > 0 && capturedPages.length >= recoveryPageNumbers.length)} style={{ minHeight: 44, border: "1px solid var(--theme-action-border)", borderRadius: 9, background: "var(--theme-action-bg)", color: "var(--theme-action-fg)", fontWeight: 700, padding: "9px 13px" }}>Take photo</button>
            <button type="button" onClick={finishCameraScan} disabled={!capturedPages.length || cameraStarting} style={{ minHeight: 44, border: "1px solid var(--theme-action-border)", borderRadius: 9, background: "var(--theme-action-bg)", color: "var(--theme-action-fg)", fontWeight: 700, padding: "9px 13px" }}>Review {capturedPages.length || ""} page(s)</button>
            <button type="button" onClick={closeCameraScanner} style={{ minHeight: 44, border: "1px solid var(--border)", borderRadius: 9, background: "var(--surface)", color: "var(--text)", padding: "9px 13px" }}>Cancel</button>
          </div>
        </section>
      </div>}
      {selected && <div role="dialog" aria-modal="true" aria-label={selected.title} onClick={(event) => { if (event.target === event.currentTarget) closePreview(); }} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
        <section style={{ width: "min(900px, 100%)", maxHeight: "92dvh", display: "flex", flexDirection: "column", background: "var(--surface)", color: "var(--text)", borderRadius: 14, overflow: "hidden", border: "1px solid var(--border)" }}>
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: 14, borderBottom: "1px solid var(--border)" }}>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: "calc(16px * var(--solenos-text-scale, 1))", overflowWrap: "anywhere" }}>{selected.title}</h2>
              <p style={{ margin: "4px 0 0", fontSize: "calc(12px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>{formatBytes(selected.sizeBytes)} · Added {formatDate(selected.uploadedAt)}{selected.careDate ? ` · ${selected.careDateLabel} ${formatDate(selected.careDate)}` : ""}</p>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button type="button" onClick={downloadOriginal} disabled={!previewUrl} aria-label={selected.evidence.type === "document" ? "Download original document" : "Download original photo"} style={{ minHeight: 42, padding: "8px 10px", display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--text)" }}><Download size={16} /> Download</button>
              {selected.evidence.type === "document" && <button type="button" onClick={() => void deleteSelectedDocument()} disabled={deletingDocument} aria-label="Delete document" style={{ minHeight: 42, padding: "8px 10px", display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--theme-error-fg)" }}>{deletingDocument ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />} Delete</button>}
              <button type="button" onClick={closePreview} aria-label={selected.evidence.type === "document" ? "Close document preview" : "Close photo preview"} style={{ width: 42, minHeight: 42, display: "grid", placeItems: "center", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--text)" }}><X size={19} /></button>
            </div>
          </header>
          <div style={{ padding: 14, overflow: "auto", minHeight: 180 }}>
            {selected.possibleVersionOfEvidenceId && !selected.evidence.parent_evidence_id && <section aria-label="Corrected document version" style={{ marginBottom: 14, padding: 12, border: "1px solid var(--border)", borderRadius: 10 }}>
              <strong style={{ fontSize: "calc(14px * var(--solenos-text-scale, 1))" }}>Is this a corrected copy of an earlier document?</strong>
              <p style={{ margin: "5px 0 9px", color: "var(--text-secondary)", fontSize: "calc(13px * var(--solenos-text-scale, 1))", lineHeight: 1.45 }}>SolenOS noticed a matching filename. Confirm only if this is a corrected copy. Both originals stay available, and the care record will not change automatically.</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <select aria-label="Earlier document version" value={versionPredecessorId} onChange={(event) => setVersionPredecessorId(event.target.value)} style={{ minHeight: 40, flex: "1 1 220px", minWidth: 0, border: "1px solid var(--border)", borderRadius: 8, padding: "7px 9px", background: "var(--surface)", color: "var(--text)" }}>
                  <option value="">Choose earlier document…</option>
                  {documents.filter((doc) => doc.id === selected.possibleVersionOfEvidenceId).map((doc) => <option key={doc.id} value={doc.id}>{doc.title} · {formatDate(doc.uploadedAt)}</option>)}
                </select>
                <button type="button" onClick={() => void linkSelectedVersion()} disabled={!versionPredecessorId || linkingVersion} style={{ minHeight: 40, padding: "8px 11px", border: "1px solid var(--theme-action-border)", borderRadius: 8, background: "var(--theme-action-bg)", color: "var(--theme-action-fg)", fontWeight: 700 }}>{linkingVersion ? "Saving…" : "Mark as corrected copy"}</button>
              </div>
            </section>}
            {(versionComparison || versionComparisonLoading || versionComparisonError) && <section aria-label="Document version comparison" style={{ marginBottom: 14, padding: 12, border: "1px solid var(--border)", borderRadius: 10 }}>
              <strong style={{ fontSize: "calc(14px * var(--solenos-text-scale, 1))" }}>What changed in this corrected copy</strong>
              {versionComparisonLoading && <p role="status" style={{ margin: "6px 0 0", color: "var(--text-secondary)", fontSize: "calc(13px * var(--solenos-text-scale, 1))" }}>Checking both documents…</p>}
              {versionComparisonError && <div role="alert"><p style={{ margin: "6px 0 0", fontSize: "calc(13px * var(--solenos-text-scale, 1))" }}>{versionComparisonError}</p><button type="button" onClick={() => void loadVersionComparison(selected.id)} disabled={versionComparisonLoading} style={{ minHeight: 40, marginTop: 8, padding: "7px 11px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--text)" }}>Try comparison again</button></div>}
              {versionComparison && (versionComparison.comparison_status === "pending" ? <p style={{ margin: "6px 0 0", color: "var(--text-secondary)", fontSize: "calc(13px * var(--solenos-text-scale, 1))" }}>{caregiverSafeGeneratedText(versionComparison.reason) || "SolenOS is still checking both copies."}</p> : <>
                <p style={{ margin: "6px 0 10px", color: "var(--text-secondary)", fontSize: "calc(13px * var(--solenos-text-scale, 1))" }}>This only compares the words found in each document. A healthcare professional has not confirmed these differences, and your Care Record has not changed. A detail missing from the newer document may simply have been left out; it does not confirm that a medication or care instruction was stopped.</p>
                {!(versionComparison.added?.length || versionComparison.removed?.length || versionComparison.changed?.length) && <p style={{ margin: 0, fontSize: "calc(13px * var(--solenos-text-scale, 1))" }}>No differences were found in the text SolenOS could read.</p>}
                {[...(versionComparison.changed || []).map((item) => ({ kind: "Changed", subject: item.subject, details: (item.previous_statements || []).map((v) => (v.statement || "") + (v.page_number ? " (page " + v.page_number + ")" : "")).join("; ") + " → " + (item.replacement_statements || []).map((v) => (v.statement || "") + (v.page_number ? " (page " + v.page_number + ")" : "")).join("; ") })), ...(versionComparison.added || []).map((item) => ({ kind: "Added", subject: item.subject, details: (item.statement || "") + (item.page_number ? " (page " + item.page_number + ")" : "") })), ...(versionComparison.removed || []).map((item) => ({ kind: "No longer listed", subject: item.subject, details: (item.statement || "") + (item.page_number ? " (previous document, page " + item.page_number + ")" : "") }))].map((item, index) => <p key={item.kind + "-" + index} style={{ margin: "8px 0 0", fontSize: "calc(13px * var(--solenos-text-scale, 1))", lineHeight: 1.5 }}><strong>{item.kind + (caregiverSafeAssistantText(item.subject) ? " · " + caregiverSafeAssistantText(item.subject) : "")}:</strong> {caregiverSafeAssistantText(item.details) || "No further details are available."}</p>)}
              </>)}
            </section>}
            {previewLoading ? <p role="status"><LoaderCircle size={18} className="animate-spin" style={{ display: "inline", verticalAlign: "middle", marginRight: 8 }} />Opening original file…</p> : previewError ? <div role="alert"><p>{previewError}</p><button type="button" onClick={() => void openOriginal(selected)} style={{ minHeight: 42, padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--text)" }}>Retry</button></div> : previewUrl && isPdf(selected.mimeType) ? <iframe title={selected.title} src={previewUrl} style={{ width: "100%", height: "65dvh", border: 0 }} /> : previewUrl && isImage(selected.mimeType) ? <img src={previewUrl} alt={selected.title} style={{ display: "block", maxWidth: "min(100%, 65dvh)", maxHeight: "65dvh", margin: "0 auto", objectFit: "contain", transform: `rotate(${selected.rotationDegrees}deg)` }} /> : previewUrl ? <div><p style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>The original file was opened successfully. Download it to open it in another app.</p>{selected.extractedText.trim() && <><h3 style={{ fontSize: "calc(15px * var(--solenos-text-scale, 1))" }}>Text saved with this document</h3><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: "calc(14px * var(--solenos-text-scale, 1))", lineHeight: 1.6 }}>{caregiverSourceText(selected.extractedText) || "The saved text is available, but cannot be displayed in a readable form here."}</p></>}</div> : <p>This file cannot be previewed here yet. Try downloading it instead.</p>}
          </div>
        </section>
      </div>}
    </div>
  );
}
