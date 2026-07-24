/**
 * Document evidence chain — preserve original source metadata alongside extraction.
 * Input Reality: Original input → Source → Extracted → Care Event → understanding.
 * Binary blob persistence can deepen later; never store extraction alone.
 */

import {
  livingCareRecordDataDir,
  readDurableJson,
  sanitizeDurableCareKey,
  writeDurableJson,
  clearDurableDirectory,
} from "../living-care-record-persistence/fs-store";

export type DocumentSourceEvidence = {
  document_id: string;
  care_key: string;
  original_name: string;
  mime_type: string | null;
  /** SHA-256 of extracted text — integrity of extract layer. */
  extracted_content_hash: string;
  extracted_text_preview: string;
  extracted_char_count: number;
  captured_at: string;
};

type DocumentEvidenceStore = {
  care_key: string;
  documents: DocumentSourceEvidence[];
  updated_at: string;
};

const memory = new Map<string, DocumentEvidenceStore>();

function storePath(careKey: string): string {
  return livingCareRecordDataDir(
    "document-evidence",
    `${sanitizeDurableCareKey(careKey)}.json`,
  );
}

function loadStore(careKey: string): DocumentEvidenceStore {
  const cached = memory.get(careKey);
  if (cached) return cached;
  const durable = readDurableJson<DocumentEvidenceStore>(storePath(careKey));
  if (durable?.documents) {
    memory.set(careKey, durable);
    return durable;
  }
  return { care_key: careKey, documents: [], updated_at: new Date().toISOString() };
}

function saveStore(store: DocumentEvidenceStore): void {
  memory.set(store.care_key, store);
  writeDurableJson(storePath(store.care_key), store);
}

async function hashText(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Node fallback
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(text).digest("hex");
}

export async function recordDocumentSourceEvidence(params: {
  careKey: string;
  documentId: string;
  originalName: string;
  mimeType?: string | null;
  extractedText: string;
  capturedAt?: string;
}): Promise<DocumentSourceEvidence> {
  const extracted = params.extractedText.trim();
  const now = params.capturedAt ?? new Date().toISOString();
  const evidence: DocumentSourceEvidence = {
    document_id: params.documentId,
    care_key: params.careKey,
    original_name: params.originalName,
    mime_type: params.mimeType ?? null,
    extracted_content_hash: await hashText(extracted),
    extracted_text_preview: extracted.slice(0, 240),
    extracted_char_count: extracted.length,
    captured_at: now,
  };
  const store = loadStore(params.careKey);
  const next = [
    ...store.documents.filter((d) => d.document_id !== evidence.document_id),
    evidence,
  ].slice(-40);
  saveStore({ care_key: params.careKey, documents: next, updated_at: now });
  return evidence;
}

export function listDocumentSourceEvidence(
  careKey: string,
): DocumentSourceEvidence[] {
  return [...loadStore(careKey).documents];
}

export function resetDocumentSourceEvidenceStore(): void {
  memory.clear();
  clearDurableDirectory(livingCareRecordDataDir("document-evidence"));
}
