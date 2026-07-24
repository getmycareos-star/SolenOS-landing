/**
 * SolenOS — Apache Tika Extraction Layer (Pre-Cognition)
 *
 * SINGLE RESPONSIBILITY: file → raw text string
 * NOT cognition. NOT decision logic. NOT analysis.
 */
import { execFile } from "node:child_process";
import { mkdtemp, writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import Tesseract from "tesseract.js";

const execFileAsync = promisify(execFile);

export const EXTRACTION_FAILED = "ERROR: extraction_failed";

const IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/tiff",
  "image/bmp",
]);

const TIKA_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/rtf",
  "text/html",
  "application/vnd.oasis.opendocument.text",
]);

function tikaServerUrl(): string {
  return process.env.TIKA_SERVER_URL ?? "http://127.0.0.1:9998";
}

function ocrEnabled(): boolean {
  return process.env.TESSERACT_OCR !== "0";
}

async function extractPlainText(buffer: Buffer): Promise<string> {
  return buffer.toString("utf-8");
}

async function extractViaTikaServer(
  buffer: Buffer,
  contentType: string,
): Promise<string | null> {
  const base = tikaServerUrl().replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/tika`, {
      method: "PUT",
      headers: {
        Accept: "text/plain",
        "Content-Type": contentType || "application/octet-stream",
      },
      body: new Uint8Array(buffer),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text;
  } catch {
    return null;
  }
}

async function extractViaTikaJar(
  buffer: Buffer,
  filename: string,
): Promise<string | null> {
  const jarPath = process.env.TIKA_JAR_PATH;
  if (!jarPath) return null;

  const dir = await mkdtemp(join(tmpdir(), "solenos-tika-"));
  const filePath = join(dir, filename.replace(/[^\w.-]/g, "_") || "upload.bin");
  try {
    await writeFile(filePath, buffer);
    const { stdout } = await execFileAsync("java", ["-jar", jarPath, "-t", filePath], {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 120_000,
    });
    return stdout;
  } catch {
    return null;
  } finally {
    await unlink(filePath).catch(() => {});
  }
}

async function extractViaTesseract(buffer: Buffer): Promise<string | null> {
  if (!ocrEnabled()) return null;
  try {
    const result = await Tesseract.recognize(buffer, "eng", {
      logger: () => {},
    });
    return result.data.text;
  } catch {
    return null;
  }
}

function guessContentType(filename: string, declared: string): string {
  if (declared) return declared;
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".tif") || lower.endsWith(".tiff")) return "image/tiff";
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".docx"))
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".txt")) return "text/plain";
  return "application/octet-stream";
}

async function extractFromBuffer(
  buffer: Buffer,
  contentType: string,
  filename: string,
): Promise<string | null> {
  const mime = guessContentType(filename, contentType);

  if (mime === "text/plain" || filename.toLowerCase().endsWith(".txt")) {
    return extractPlainText(buffer);
  }

  if (TIKA_TYPES.has(mime) || mime === "application/octet-stream") {
    const fromServer = await extractViaTikaServer(buffer, mime);
    if (fromServer !== null && fromServer.trim().length > 0) return fromServer;

    const fromJar = await extractViaTikaJar(buffer, filename);
    if (fromJar !== null && fromJar.trim().length > 0) return fromJar;
  }

  if (IMAGE_TYPES.has(mime) || /\.(png|jpe?g|gif|webp|tiff?|bmp)$/i.test(filename)) {
    const fromOcr = await extractViaTesseract(buffer);
    if (fromOcr !== null && fromOcr.trim().length > 0) return fromOcr;

    const fromTika = await extractViaTikaServer(buffer, mime);
    if (fromTika !== null && fromTika.trim().length > 0) return fromTika;
  }

  if (mime.startsWith("text/")) {
    return extractPlainText(buffer);
  }

  const lastResort = await extractViaTikaServer(buffer, mime);
  if (lastResort !== null && lastResort.trim().length > 0) return lastResort;

  return null;
}

/**
 * Extract raw text from a file. No interpretation, no JSON, no AI.
 * @returns raw text string, or `ERROR: extraction_failed`
 */
export async function extractText(file: File): Promise<string> {
  if (!file || file.size === 0) {
    return EXTRACTION_FAILED;
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractFromBuffer(
      buffer,
      file.type || "",
      file.name || "upload",
    );

    if (text === null || text.trim().length === 0) {
      return EXTRACTION_FAILED;
    }

    return text;
  } catch {
    return EXTRACTION_FAILED;
  }
}

/** Server-side entry when File is unavailable — same contract. */
export async function extractTextFromBuffer(
  buffer: Buffer,
  contentType: string,
  filename: string,
): Promise<string> {
  if (!buffer || buffer.length === 0) {
    return EXTRACTION_FAILED;
  }

  try {
    const text = await extractFromBuffer(buffer, contentType, filename);
    if (text === null || text.trim().length === 0) {
      return EXTRACTION_FAILED;
    }
    return text;
  } catch {
    return EXTRACTION_FAILED;
  }
}
