import type { MemoryCategory } from "../memory-influence/types";
import type {
  DocumentMemoryProposal,
  DocumentNode,
  DocumentIntelligenceMemoryLink,
  DocumentConflictCandidate,
} from "./types";

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function categoryForDocumentType(type: DocumentNode["type"]): MemoryCategory {
  switch (type) {
    case "medical_document":
    case "care_plan":
      return "operational";
    case "insurance_document":
    case "benefits_document":
    case "legal_document":
      return "patterns";
    default:
      return "operational";
  }
}

/**
 * Memory link proposals — pending writes ONLY. Memory system decides commit.
 * Documents do NOT directly modify memory.
 */
export function proposeMemoryLinks(node: DocumentNode): DocumentIntelligenceMemoryLink {
  const suggestedUpdates: DocumentMemoryProposal[] = [];
  const conflictCandidates: DocumentConflictCandidate[] = [];
  const category = categoryForDocumentType(node.type);

  if (node.extracted.obligations.length > 0) {
    suggestedUpdates.push({
      id: generateId("mem_prop"),
      documentNodeId: node.id,
      category,
      suggestedKey: `document_obligation_${node.type}`,
      suggestedInfluenceLabel: `Document obligation signal (${node.extracted.obligations.length} items) — pending review`,
      confidence: node.confidence.overall,
      status: "pending",
    });
  }

  if (node.extracted.timestamps.length > 0) {
    suggestedUpdates.push({
      id: generateId("mem_prop"),
      documentNodeId: node.id,
      category: "operational",
      suggestedKey: `document_deadline_${node.type}`,
      suggestedInfluenceLabel: `Document temporal marker signal — pending review`,
      confidence: node.confidence.extraction,
      status: "pending",
    });
  }

  if (node.inference.ambiguityFlags.length > 0) {
    conflictCandidates.push({
      id: generateId("conflict"),
      documentNodeId: node.id,
      field: "ambiguity",
      extractedValue: node.inference.ambiguityFlags.join("; "),
      reason: "ambiguous document content — requires human or memory-system resolution",
    });
  }

  if (node.confidence.uncertaintyFlagged) {
    conflictCandidates.push({
      id: generateId("conflict"),
      documentNodeId: node.id,
      field: "confidence",
      extractedValue: node.confidence.overall.toFixed(2),
      reason: "document confidence below threshold — do not commit as fact",
    });
  }

  return {
    suggestedUpdates,
    pendingWrites: suggestedUpdates.filter((p) => p.status === "pending"),
    conflictCandidates,
  };
}

export function mergeMemoryLinks(
  links: readonly DocumentIntelligenceMemoryLink[],
): DocumentIntelligenceMemoryLink {
  const suggestedUpdates: DocumentMemoryProposal[] = [];
  const pendingWrites: DocumentMemoryProposal[] = [];
  const conflictCandidates: DocumentConflictCandidate[] = [];

  for (const link of links) {
    suggestedUpdates.push(...link.suggestedUpdates);
    pendingWrites.push(...link.pendingWrites);
    conflictCandidates.push(...link.conflictCandidates);
  }

  return { suggestedUpdates, pendingWrites, conflictCandidates };
}

/** Guard: no auto-commit — all proposals must remain pending. */
export function assertNoMemoryAutoCommit(proposals: readonly DocumentMemoryProposal[]): boolean {
  return proposals.every((p) => p.status === "pending");
}
