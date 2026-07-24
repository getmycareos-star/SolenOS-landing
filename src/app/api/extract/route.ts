/**
 * POST /api/extract — document / image text extraction for MVP workspace.
 * Wraps existing Tika + Tesseract stack (not PaddleOCR). Pre-cognition only.
 */
import { NextRequest, NextResponse } from "next/server";
import { EXTRACTION_FAILED, extractTextFromBuffer } from "@/lib/tika-extractor";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") ?? form.get("document") ?? form.get("image");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "missing_file", message: "Attach an image or PDF as multipart field `file`." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename =
      file instanceof File && file.name ? file.name : "upload.bin";
    const contentType = file.type || "application/octet-stream";

    const text = await extractTextFromBuffer(buffer, contentType, filename);
    const failed = text === EXTRACTION_FAILED || !text.trim();

    return NextResponse.json({
      filename,
      content_type: contentType,
      text: failed ? "" : text,
      ok: !failed,
      extractor: "tika_tesseract",
      note: failed
        ? contentType.startsWith("image/")
          ? "Could not read text from this photo. Try a clearer shot, or type the key lines from the paper."
          : "Could not read this file. Try a photo of the page, a plain-text export, or type the key details."
        : undefined,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "extraction_failed",
        message: error instanceof Error ? error.message : "Unknown extraction error",
      },
      { status: 422 },
    );
  }
}
