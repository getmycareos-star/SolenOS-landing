import { ensureAnonymousSession, getJSON, postFormData, postJSON } from "@/api/client";
import type { AttachedDocument } from "@/lib/mvp-workspace";
import type { InputEntryMethod } from "@/lib/input-entry-contract";
import { sanitizeCaregiverErrorMessage } from "@/lib/mvp-input-architecture";

function createDocId() {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

async function persistOriginalDocument(file: File): Promise<string> {
  const session = await ensureAnonymousSession();
  const form = new FormData();
  form.append("file", file);
  form.append("person_id", session.person.id);
  form.append("caregiver_id", session.caregiver.id);
  form.append("evidence_type", "document");
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
    evidenceId = await persistOriginalDocument(file);
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

  // The original is now durable. Do not route through the legacy /api/extract
  // endpoint: it made extraction a prerequisite for upload and bypassed the
  // evidence-bound document lifecycle used by Documents and LCR review.
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

    let reviewNote: string | undefined;
    try {
      await postJSON(
        "/documents/" + encodeURIComponent(evidenceId) + "/intelligence",
        {},
      );
    } catch {
      reviewNote =
        "The original and extracted text are saved. Automated document review is temporarily unavailable; retry it from Documents.";
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
      errorNote: reviewNote,
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
    let errorNote: string | undefined;
    try {
      await postJSON(
        "/documents/" + encodeURIComponent(document.evidenceId) + "/intelligence",
        {},
      );
    } catch {
      errorNote =
        "Text extraction is saved, but automated review is unavailable. Retry from Documents when the review service is available.";
    }
    window.dispatchEvent(new Event("careRecordUpdated"));
    return {
      ...document,
      extractedText: (persisted.extracted_text || "").trim(),
      extractedCharCount: persisted.extracted_char_count,
      extractionSource: persisted.extraction_method || extraction.extraction_method,
      status: "ready",
      errorNote,
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
