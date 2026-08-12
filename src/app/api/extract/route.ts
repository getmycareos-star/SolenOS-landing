import { NextResponse } from "next/server";
import {
  extractTextWithMetadataFromBuffer,
  EXTRACTION_FAILED,
} from "../../../lib/tika-extractor";

export const runtime = "nodejs";

function createDocId(): string {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!file || typeof (file as Blob)?.arrayBuffer !== "function") {
      return NextResponse.json(
        {
          ok: false,
          error: "missing_file",
          note: "No file was provided for extraction.",
        },
        { status: 400 },
      );
    }

    const blob = file as Blob;
    const buffer = Buffer.from(await blob.arrayBuffer());
    const filename = (blob as File).name || "upload";
    const contentType = (blob as File).type || "";

    const result = await extractTextWithMetadataFromBuffer(
      buffer,
      contentType,
      filename,
    );

    if (!result.text || result.text === EXTRACTION_FAILED || !result.text.trim()) {
      return NextResponse.json(
        {
          ok: false,
          error: "extraction_failed",
          note: "Could not read this document. Try another file, or type the key details.",
        },
        { status: 400 },
      );
    }

    const extracted = result.text.trim();
    const doc = {
      id: createDocId(),
      name: filename,
      mime_type: contentType || null,
      extracted_text: extracted,
      extracted_text_preview: extracted.slice(0, 240),
      extracted_char_count: extracted.length,
      ocr_confidence: result.ocr_confidence,
      extraction_source: result.source,
    };

    return NextResponse.json({ ok: true, document: doc });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "unexpected_error",
        note:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while extracting the document.",
      },
      { status: 500 },
    );
  }
}
