import type { DocumentKnowledgeResult } from "./types";

const resultsByDocument = new Map<string, DocumentKnowledgeResult>();
const caregiverIndex = new Map<string, string[]>();

export function storeDocumentKnowledge(result: DocumentKnowledgeResult): void {
  const caregiverId = result.journey_results[0]?.event.caregiver_id?.trim();
  if (!caregiverId || caregiverId === "default_caregiver") {
    throw new Error("Verified caregiver attribution is required before document knowledge can be indexed.");
  }
  if (result.journey_results.some((entry) => entry.event.caregiver_id !== caregiverId)) {
    throw new Error("Document knowledge contains mixed caregiver identities and cannot be indexed.");
  }
  resultsByDocument.set(result.document_id, result);
  const existing = caregiverIndex.get(caregiverId) ?? [];
  if (!existing.includes(result.document_id)) {
    caregiverIndex.set(caregiverId, [result.document_id, ...existing]);
  }
}

export function getDocumentKnowledge(documentId: string): DocumentKnowledgeResult | undefined {
  return resultsByDocument.get(documentId);
}

export function listDocumentKnowledgeForCaregiver(caregiverId: string): DocumentKnowledgeResult[] {
  const ids = caregiverIndex.get(caregiverId) ?? [];
  return ids
    .map((id) => resultsByDocument.get(id))
    .filter((r): r is DocumentKnowledgeResult => !!r);
}

export function resetUniversalKnowledgeStore(): void {
  resultsByDocument.clear();
  caregiverIndex.clear();
}
