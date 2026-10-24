import { NextResponse } from "next/server";
import {
  extractTextWithMetadataFromBuffer,
  EXTRACTION_FAILED,
} from "../../../lib/tika-extractor";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/rtf",
  "text/html",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/vnd.oasis.opendocument.text",
  "application/octet-stream",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/tiff",
  "image/bmp",
]);

function createDocId(): string {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function jsonError(error: string, note: string, status: number) {
  return NextResponse.json({ ok: false, error, note }, { status });
}

export async function POST(request: Request) {
  // Reject oversized requests before multipart parsing when the client sends
  // Content-Length. Enforce the limit again against the actual File size below.
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_BYTES + 64 * 1024) {
    return jsonError(
      "file_too_large",
      "This file is larger than the 10 MiB limit. Choose a smaller file.",
      413,
    );
  }

  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!file || typeof (file as Blob)?.arrayBuffer !== "function") {
      return jsonError(
        "missing_file",
        "No file was provided for extraction.",
        400,
      );
    }

    const blob = file as File;
    if (blob.size === 0) {
      return jsonError("empty_file", "The selected file is empty.", 400);
    }
    if (blob.size > MAX_UPLOAD_BYTES) {
      return jsonError(
        "file_too_large",
        "This file is larger than the 10 MiB limit. Choose a smaller file.",
        413,
      );
    }

    const filename = (blob.name || "upload").replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 180);
    const contentType = (blob.type || "").toLowerCase();
    const extension = /\.([a-z0-9]{1,10})$/i.exec(filename)?.[1]?.toLowerCase();
    const typeByExtension: Record<string, string> = {
      pdf: "application/pdf",
      txt: "text/plain",
      md: "text/markdown",
      csv: "text/csv",
      html: "text/html",
      htm: "text/html",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      rtf: "application/rtf",
      odt: "application/vnd.oasis.opendocument.text",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      tif: "image/tiff",
      tiff: "image/tiff",
      bmp: "image/bmp",
      json: "text/plain",
    };
    const effectiveType = contentType || typeByExtension[extension ?? ""] || "";
    if (!ALLOWED_TYPES.has(effectiveType) && !(extension && typeByExtension[extension])) {
      return jsonError(
        "unsupported_file_type",
        "This file type is not supported. Choose a PDF, text document, Office document, or image.",
        415,
      );
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    const result = await extractTextWithMetadataFromBuffer(
      buffer,
      effectiveType || contentType,
      filename,
    );

    if (!result.text || result.text === EXTRACTION_FAILED || !result.text.trim()) {
      return jsonError(
        "extraction_failed",
        "Could not read this document in the current deployment. Try another file, or type the key details.",
        422,
      );
    }

    const extracted = result.text.trim();
    const doc = {
      id: createDocId(),
      name: filename,
      mime_type: effectiveType || null,
      extracted_text: extracted,
      extracted_text_preview: extracted.slice(0, 240),
      extracted_char_count: extracted.length,
      ocr_confidence: result.ocr_confidence,
      extraction_source: result.source,
    };

    return NextResponse.json({ ok: true, document: doc });
  } catch {
    // Avoid returning raw exception text, which can expose internal paths or
    // implementation details to clients.
    return jsonError(
      "unexpected_error",
      "The document could not be processed. Try again, or type the key details.",
      500,
    );
  }
}
