import { ensureAnonymousSession, getJSON, postFormData, postJSON } from "@/api/client";
import type { AttachedDocument } from "@/lib/mvp-workspace";
import type { InputEntryMethod } from "@/lib/input-entry-contract";
import { sanitizeCaregiverErrorMessage } from "@/lib/mvp-input-architecture";

function createDocId() {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

type ScanProcessing = { rotationDegrees: number; cropInsetsPercent: { top: number; right: number; bottom: number; left: number } };

type UploadReceipt = { evidenceId: string; processingJobId?: string; processingStatus?: string };

async function persistOriginalDocument(file: File, entryMethod: InputEntryMethod, uploadRetryKey: string, captureTimestamp: string, scanProcessing?: ScanProcessing): Promise<UploadReceipt> {
  const session = await ensureAnonymousSession();
  const form = new FormData();
  form.append("file", file);
  form.append("ingestion_key", uploadRetryKey);
  form.append("person_id", session.person.id);
  form.append("caregiver_id", session.caregiver.id);
  // Snap captures a care photo, not a scanned document. The backend document\n  // extraction endpoint intentionally accepts only evidence_type=document.\n  form.append("evidence_type", entryMethod === "snap" ? "care_photo" : "document");
  form.append("capture_method", entryMethod);
  form.append("capture_timestamp", captureTimestamp);
  const scanPageNumber = entryMethod === "scan" ? /scan_page_(\d+)/i.exec(file.name)?.[1] : undefined;
  if (scanPageNumber) form.append("capture_page_number", scanPageNumber);
  if (entryMethod === "scan" && scanProcessing) {
    form.append("scan_review_status", "not_reviewed");
    form.append("scan_rotation_degrees", String(scanProcessing.rotationDegrees));
    form.append("scan_crop_json", JSON.stringify(scanProcessing.cropInsetsPercent));
    form.append("scan_text_prepared", "false");
  }
  // The server must extract from the immutable uploaded bytes. Client OCR/text is
  // deliberately not treated as authoritative source material.
  form.append("extracted_text", "");
  const result = (await postFormData("/upload", form)) as {
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
    uploadReceipt = await persistOriginalDocument(file, entryMethod, uploadRetryKey, captureTimestamp, scanProcessing);
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

  // The upload endpoint durably queues document extraction and understanding.
  // Do not make the caregiver wait for OCR or Qwen before using the saved source.
  window.dispatchEvent(new Event("careRecordUpdated"));
  const processingQueued = entryMethod === "snap" || (
    !!uploadReceipt.processingJobId &&
    ["queued", "processing", "completed"].includes(uploadReceipt.processingStatus || "")
  );
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
