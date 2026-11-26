import { ensureAnonymousSession, getJSON, postFormData, postJSON } from "@/api/client";
import type { AttachedDocument } from "@/lib/mvp-workspace";
import type { InputEntryMethod } from "@/lib/input-entry-contract";
import { sanitizeCaregiverErrorMessage } from "@/lib/mvp-input-architecture";
import {
  deliverDurableWrite,
  enqueueDurableWrite,
  markDurableWritePending,
} from "@/lib/offline-sync/durable-write-queue";
import { sendQueuedCareWrite } from "@/lib/offline-sync/send-queued-care-write";

function createDocId() {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

type ScanProcessing = { rotationDegrees: number; cropInsetsPercent: { top: number; right: number; bottom: number; left: number } };

type UploadReceipt = { evidenceId: string; processingJobId?: string; processingStatus?: string; pendingOffline?: boolean };

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
  }
  return window.btoa(binary);
}

async function persistOriginalDocument(file: File, entryMethod: InputEntryMethod, uploadRetryKey: string, captureTimestamp: string, scanProcessing?: ScanProcessing, evidenceTypeOverride?: "care_photo" | "document", photoRotationDegrees = 0): Promise<UploadReceipt> {
  const session = await ensureAnonymousSession();
  const fields: Record<string, string> = {
    ingestion_key: uploadRetryKey,
    person_id: session.person.id,
    caregiver_id: session.caregiver.id,
    evidence_type: evidenceTypeOverride ?? (entryMethod === "snap" ? "care_photo" : "document"),
    capture_method: entryMethod,
    capture_timestamp: captureTimestamp,
    extracted_text: "",
  };
  if (evidenceTypeOverride === "care_photo") fields.photo_rotation_degrees = String(photoRotationDegrees);
  const scanPageNumber = entryMethod === "scan" ? /scan_page_(\d+)/i.exec(file.name)?.[1] : undefined;
  if (scanPageNumber) fields.capture_page_number = scanPageNumber;
  if (entryMethod === "scan" && scanProcessing) {
    fields.scan_review_status = "not_reviewed";
    fields.scan_rotation_degrees = String(scanProcessing.rotationDegrees);
    fields.scan_crop_json = JSON.stringify(scanProcessing.cropInsetsPercent);
    fields.scan_text_prepared = "false";
  }

  const payload = {
    offline_kind: "file_upload" as const,
    file_name: file.name,
    mime_type: file.type || "application/octet-stream",
    file_base64: await fileToBase64(file),
    fields,
  };
  let queuedId: string | null = null;
  try {
    queuedId = await enqueueDurableWrite({
      person_id: session.person.id,
      caregiver_id: session.caregiver.id,
      endpoint: "/upload",
      idempotency_key: uploadRetryKey,
      payload,
    });
  } catch {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new Error("This device could not securely keep the original file offline. Reconnect before uploading it.");
    }
  }

  if (queuedId && typeof navigator !== "undefined" && !navigator.onLine) {
    await markDurableWritePending(queuedId, new Error("Network unavailable"), { countAttempt: false });
    return {
      evidenceId: "",
      processingStatus: "queued",
      pendingOffline: true,
    };
  }

  const result = queuedId
    ? await deliverDurableWrite(queuedId, sendQueuedCareWrite) as {
        evidence_id?: string;
        persisted?: boolean;
        document_processing_job_id?: string | null;
        processing_status?: string;
      }
    : await postFormData("/upload", (() => {
        const form = new FormData();
        form.append("file", file);
        for (const [key, value] of Object.entries(fields)) form.append(key, value);
        return form;
      })()) as {
        evidence_id?: string;
        persisted?: boolean;
        document_processing_job_id?: string | null;
        processing_status?: string;
      };

  if (!result.persisted || !result.evidence_id) {
    throw new Error("The original file was not confirmed as saved.");
  }
  return {
    evidenceId: result.evidence_id,
    processingJobId: result.document_processing_job_id ?? undefined,
    processingStatus: result.processing_status,
  };
}


/**
 * Snap, Scan, Upload and Share preserve the original first. Document uploads
 * are then processed by the durable server worker; caregivers can continue
 * while OCR and document understanding run. No client text becomes source truth.
 */
export async function extractAttachedDocument(
  file: File,
  entryMethod: InputEntryMethod,
  uploadRetryKey = crypto.randomUUID(),
  captureTimestamp = new Date().toISOString(),
  scanProcessing?: ScanProcessing,
  evidenceTypeOverride?: "care_photo" | "document",
  photoRotationDegrees = 0,
): Promise<AttachedDocument> {
  const base: AttachedDocument = {
    uploadRetryKey,
    captureTimestamp,
    id: createDocId(),
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    extractedText: "",
    status: "pending",
    entryMethod,
    sourceFile: file,
  };

  let uploadReceipt: UploadReceipt;
  try {
    uploadReceipt = await persistOriginalDocument(file, entryMethod, uploadRetryKey, captureTimestamp, scanProcessing, evidenceTypeOverride, photoRotationDegrees);
  } catch (error) {
    return {
      ...base,
      status: "failed",
      errorNote: sanitizeCaregiverErrorMessage(
        error instanceof Error
          ? error.message
          : "The original document could not be saved. Retry the upload.",
      ),
    };
  }

  if (uploadReceipt.pendingOffline) {
    return {
      ...base,
      status: "pending",
      errorNote: "The original file is encrypted on this device. It has not reached your Care Record yet and will sync when your connection returns.",
    };
  }

  // The upload endpoint durably queues document extraction and understanding.
  // Do not make the caregiver wait for OCR or Qwen before using the saved source.
  window.dispatchEvent(new Event("careRecordUpdated"));
  let processingQueued = evidenceTypeOverride === "care_photo" || entryMethod === "snap" || (
    !!uploadReceipt.processingJobId &&
    ["queued", "processing", "completed"].includes(uploadReceipt.processingStatus || "")
  );

  // A saved original must not be stranded if the upload transaction committed
  // but its best-effort queue insert did not return a durable job receipt.
  // Reuse the server-issued evidence ID; never upload the file a second time.
  if (!processingQueued && entryMethod !== "snap" && evidenceTypeOverride !== "care_photo") {
    try {
      const retry = await postJSON(
        "/documents/" + encodeURIComponent(uploadReceipt.evidenceId) + "/queue",
        {},
      ) as { job_id?: string; status?: string };
      processingQueued = Boolean(
        retry.job_id && ["queued", "processing"].includes(retry.status || ""),
      );
    } catch {
      // Keep the original and expose the existing retry action if the queue
      // remains unavailable. Do not turn a successful upload into a failed one.
    }
  }

  return {
    ...base,
    evidenceId: uploadReceipt.evidenceId,
    status: "saved",
    errorNote: processingQueued ? undefined : "The original is saved, but document processing did not start. Retry processing without uploading another copy.",
  };
}

export async function retryAttachedDocument(
  document: AttachedDocument,
): Promise<AttachedDocument> {
  if (document.entryMethod === "snap" && document.evidenceId) {
    return { ...document, status: "saved", errorNote: undefined };
  }
  if (!document.evidenceId) {
    return document.sourceFile
      ? extractAttachedDocument(document.sourceFile, document.entryMethod ?? "upload", document.uploadRetryKey ?? crypto.randomUUID(), document.captureTimestamp ?? new Date().toISOString())
      : {
          ...document,
          status: "failed",
          errorNote: "The original upload reference is unavailable. Attach the original file again.",
        };
  }

  try {
    const queued = await postJSON(
      "/documents/" + encodeURIComponent(document.evidenceId) + "/queue",
      {},
    ) as { job_id?: string; status?: string };
    if (!queued.job_id || !["queued", "processing"].includes(queued.status || "")) {
      throw new Error("The server did not confirm that document processing restarted.");
    }
    window.dispatchEvent(new Event("careRecordUpdated"));
    return { ...document, status: "saved", errorNote: undefined };
  } catch (error) {
    return {
      ...document,
      status: "saved",
      errorNote: sanitizeCaregiverErrorMessage(
        error instanceof Error
          ? error.message
          : "The original is saved, but background processing could not restart.",
      ),
    };
  }
}

export function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, data] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(header ?? "")?.[1] ?? "image/jpeg";
  const binary = atob(data ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], filename, { type: mime });
}
