import { NextResponse } from "next/server";
import {
  extractTextWithMetadataFromBuffer,
  EXTRACTION_FAILED,
} from "../../../lib/tika-extractor";
import { getBackendOrigin } from "../../../lib/backend-origin";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function createDocId(): string {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function failure(status: number, error: string, note: string) {
  return NextResponse.json({ ok: false, error, note }, { status });
}

function canUseLocalExtractor(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    file.type.startsWith("image/") ||
    file.type === "application/pdf" ||
    /\.(pdf|doc|docx|rtf|eml|msg|tif|tiff|bmp|webp|gif|jpe?g)$/i.test(name)
  );
}

async function extractWithExistingOcrFallback(
  buffer: Buffer,
  contentType: string,
  filename: string,
) {
  const result = await extractTextWithMetadataFromBuffer(buffer, contentType, filename);
  if (!result.text || result.text === EXTRACTION_FAILED || !result.text.trim()) {
    return null;
  }
  const extracted = result.text.trim();
  return {
    ok: true,
    document: {
      id: createDocId(),
      name: filename,
      mime_type: contentType || null,
      extracted_text: extracted,
      extracted_text_preview: extracted.slice(0, 240),
      extracted_char_count: extracted.length,
      ocr_confidence: result.ocr_confidence,
      extraction_source: result.source,
    },
  };
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!/^Bearer\s+\S+$/i.test(authorization)) {
    return failure(
      401,
      "authentication_required",
      "A valid SolenOS care-record session is required to read this document.",
    );
  }

  try {
    const form = await request.formData();
    const candidate = form.get("file");

    if (!candidate || typeof (candidate as Blob)?.arrayBuffer !== "function") {
      return failure(400, "missing_file", "No file was provided for extraction.");
    }

    const blob = candidate as File;
    const filename = blob.name || "upload";
    const contentType = blob.type || "";
    if (blob.size === 0) {
      return failure(422, "empty_file", "The uploaded file is empty.");
    }
    if (blob.size > MAX_UPLOAD_BYTES) {
      return failure(413, "file_too_large", "Files must be 10 MiB or smaller.");
    }

    // The Railway API is the primary extractor. The same bearer capability
    // scopes extraction to the current care-record session.
    const backendForm = new FormData();
    backendForm.append("file", blob, filename);

    let backendResponse: Response;
    try {
      backendResponse = await fetch(`${getBackendOrigin()}/api/extract`, {
        method: "POST",
        headers: { Authorization: authorization },
        body: backendForm,
        signal: AbortSignal.timeout(35_000),
        cache: "no-store",
      });
    } catch {
      return failure(
        502,
        "backend_unavailable",
        "The secure document reader could not be reached. Try again, or type the key details.",
      );
    }

    let backendData: {
      ok?: boolean;
      document?: {
        id: string;
        name: string;
        mime_type: string | null;
        extracted_text: string;
        extracted_text_preview: string;
        extracted_char_count: number;
        ocr_confidence?: number | null;
        extraction_source?: string;
      };
      detail?: string;
      error?: string;
      note?: string;
    } = {};
    try {
      backendData = (await backendResponse.json()) as typeof backendData;
    } catch {
      return failure(
        502,
        "invalid_backend_response",
        "The secure document reader returned an unreadable response. Try again.",
      );
    }

    if (backendResponse.ok && backendData.ok && backendData.document?.extracted_text?.trim()) {
      return NextResponse.json(backendData);
    }

    // Never fall back around an authentication or size rejection. Only use
    // the existing OCR/Tika layer when the backend explicitly says this file
    // type/content needs a capability it does not provide (415/422).
    if (backendResponse.status === 401 || backendResponse.status === 403) {
      return failure(
        backendResponse.status,
        "session_invalid",
        "This care-record session is no longer valid. Reopen the workspace before retrying.",
      );
    }
    if (backendResponse.status === 413) {
      return failure(413, "file_too_large", "Files must be 10 MiB or smaller.");
    }

    if (
      (backendResponse.status === 415 || backendResponse.status === 422) &&
      canUseLocalExtractor(blob)
    ) {
      const buffer = Buffer.from(await blob.arrayBuffer());
      const fallback = await extractWithExistingOcrFallback(buffer, contentType, filename);
      if (fallback) return NextResponse.json(fallback);
    } else if (backendResponse.status !== 415 && backendResponse.status !== 422) {
      return failure(
        502,
        "backend_extraction_failed",
        "The secure document reader could not complete extraction. Try again, or type the key details.",
      );
    }

    const detail = typeof backendData.detail === "string" ? backendData.detail : "";
    const note =
      detail.includes("Scanned-image OCR is not available") ||
      detail.includes("scanned-image OCR is not available")
        ? "Scanned-image text extraction is not available in this deployment. Type the key details instead."
        : "Could not read this document. Try another file, or type the key details.";
    return failure(422, "extraction_failed", note);
  } catch {
    return failure(
      500,
      "unexpected_error",
      "An unexpected error occurred while reading this document. Try again, or type the key details.",
    );
  }
}
