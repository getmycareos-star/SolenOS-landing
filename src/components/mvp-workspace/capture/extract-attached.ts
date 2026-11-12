import { ensureAnonymousSession, getJSON, postFormData, postJSON } from "@/api/client";
import type { AttachedDocument } from "@/lib/mvp-workspace";
import type { InputEntryMethod } from "@/lib/input-entry-contract";
import { sanitizeCaregiverErrorMessage } from "@/lib/mvp-input-architecture";

function createDocId() {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

async function persistOriginalDocument(file: File, entryMethod: InputEntryMethod): Promise<string> {
  const session = await ensureAnonymousSession();
  const form = new FormData();
  form.append("file", file);
  form.append("person_id", session.person.id);
  form.append("caregiver_id", session.caregiver.id);
  // Snap captures a care photo, not a scanned document. The backend document\n  // extraction endpoint intentionally accepts only evidence_type=document.\n  form.append("evidence_type", entryMethod === "snap" ? "care_photo" : "document");
  form.append("capture_method", entryMethod);
  form.append("capture_timestamp", new Date().toISOString());
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
): Promise<AttachedDocument> {
  const base: AttachedDocument = {
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
    evidenceId = await persistOriginalDocument(file, entryMethod);
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

  // Snap photos are preserved as care-photo evidence. They are not forced
  // through document OCR; downstream care interpretation receives the evidence ID.
  if (entryMethod === "snap") {
    window.dispatchEvent(new Event("careRecordUpdated"));
    return { ...base, evidenceId, status: "ready" };
  }

  // The original is now durable. Extract only document evidence from the
  // immutable server-side upload; never trust client-provided OCR text.
  try {
    const extraction = (await postJSON(
      "/documents/" + encodeURIComponent(evidenceId) + "/extract",
      {},
    )) as { analysis_id?: string; extraction_method?: string };

    if (!extraction.analysis_id) {
      throw new Error("The server saved the original but did not return an extraction record.");
    }

    const persisted = (await getJSON(
      "/documents/analyses/" + encodeURIComponent(extraction.analysis_id),
    )) as {
      extracted_text?: string;
      extracted_char_count?: number;
      extraction_method?: string;
    };

    let intelligenceStatus = "unavailable";
    try {
      const intelligence = (await postJSON(
        "/documents/" + encodeURIComponent(evidenceId) + "/intelligence",
        {},
      )) as { intelligence_status?: string };
      intelligenceStatus = intelligence.intelligence_status || "unavailable";
      if (!["available", "partial"].includes(intelligenceStatus)) {
        throw new Error("Document understanding did not complete.");
      }
    } catch {
      throw new Error(
        "The original and extracted text are saved, but document understanding did not complete. Retry from Documents.",
      );
    }

    window.dispatchEvent(new Event("careRecordUpdated"));
    return {
      ...base,
      evidenceId,
      name: file.name,
      mimeType: file.type || base.mimeType,
      extractedText: (persisted.extracted_text || "").trim(),
      extractedCharCount: persisted.extracted_char_count,
      extractionSource: persisted.extraction_method || extraction.extraction_method,
      status: "ready",
    };
  } catch (error) {
    window.dispatchEvent(new Event("careRecordUpdated"));
    return {
      ...base,
      evidenceId,
      status: "failed",
      errorNote: sanitizeCaregiverErrorMessage(
        error instanceof Error
          ? error.message
          : "The original is saved, but text extraction failed. Retry extraction from Documents.",
      ),
    };
  }
}

export async function retryAttachedDocument(
  document: AttachedDocument,
): Promise<AttachedDocument> {
  if (!document.evidenceId) {
    return document.sourceFile
      ? extractAttachedDocument(document.sourceFile, document.entryMethod ?? "upload")
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
