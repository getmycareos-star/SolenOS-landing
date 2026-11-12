import { ensureAnonymousSession, getJSON, postFormData, postJSON } from "@/api/client";
import type { AttachedDocument } from "@/lib/mvp-workspace";
import type { InputEntryMethod } from "@/lib/input-entry-contract";
import { sanitizeCaregiverErrorMessage } from "@/lib/mvp-input-architecture";

function createDocId() {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

async function persistOriginalDocument(file: File, entryMethod: InputEntryMethod, uploadRetryKey: string, captureTimestamp: string): Promise<string> {
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
  // The server must extract from the immutable uploaded bytes. Client OCR/text is
  // deliberately not treated as authoritative source material.
  form.append("extracted_text", "");
  const result = (await postFormData("/upload", form)) as {
    evidence_id?: string;
    persisted?: boolean;
  };
  if (!result.persisted || !result.evidence_id) {
    throw new Error("The original file was not confirmed as saved.");
  }
  return result.evidence_id;
}

/**
 * Snap, Scan, Upload and Share all follow the same order:
 * persist original -> server extraction/OCR -> Qwen candidate review.
 * Extraction failure never deletes or discards the already-saved original.
 */
export async function extractAttachedDocument(
  file: File,
  entryMethod: InputEntryMethod,
  uploadRetryKey = crypto.randomUUID(),
  captureTimestamp = new Date().toISOString(),
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

  let evidenceId: string;
  try {
    evidenceId = await persistOriginalDocument(file, entryMethod, uploadRetryKey, captureTimestamp);
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
  return { ...base, evidenceId, status: "saved" };
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
    const extraction = (await postJSON(
      "/documents/" + encodeURIComponent(document.evidenceId) + "/extract",
      {},
    )) as { analysis_id?: string; extraction_method?: string };
    if (!extraction.analysis_id) {
      throw new Error("The saved original did not return an extraction record.");
    }
    const persisted = (await getJSON(
      "/documents/analyses/" + encodeURIComponent(extraction.analysis_id),
    )) as {
      extracted_text?: string;
      extracted_char_count?: number;
      extraction_method?: string;
    };
    const intelligence = (await postJSON(
      "/documents/" + encodeURIComponent(document.evidenceId) + "/intelligence",
      {},
    )) as { intelligence_status?: string };
    if (!["available", "partial"].includes(intelligence.intelligence_status || "")) {
      throw new Error("Document understanding did not complete. Retry from Documents.");
    }
    window.dispatchEvent(new Event("careRecordUpdated"));
    return {
      ...document,
      extractedText: (persisted.extracted_text || "").trim(),
      extractedCharCount: persisted.extracted_char_count,
      extractionSource: persisted.extraction_method || extraction.extraction_method,
      status: "ready",
    };
  } catch (error) {
    return {
      ...document,
      status: "failed",
      errorNote: sanitizeCaregiverErrorMessage(
        error instanceof Error
          ? error.message
          : "The original is saved, but extraction failed. Retry without uploading another copy.",
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
