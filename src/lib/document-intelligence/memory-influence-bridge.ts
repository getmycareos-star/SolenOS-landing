import type { MemoryInfluenceSignal } from "../memory-influence/types";
import type { DocumentIntelligenceMemoryLink, DocumentMemoryProposal } from "./types";

/**
 * Bridge document memory proposals to memory-influence signal shape.
 * Proposals remain pending — memory-influence layer must NOT auto-apply these.
 */
export function toMemoryInfluenceSignalProposals(
  memoryLinks: DocumentIntelligenceMemoryLink,
): MemoryInfluenceSignal[] {
  return memoryLinks.pendingWrites.map((proposal: DocumentMemoryProposal) => ({
    category: proposal.category,
    kind: `document_proposal:${proposal.suggestedKey}`,
    confidence: proposal.confidence,
    detail: proposal.suggestedInfluenceLabel,
    influenceLabel: proposal.suggestedInfluenceLabel,
    userConfirmed: false,
  }));
}

/** Guard integration contract — document proposals never bypass memory update conditions. */
export function assertDocumentProposalsNotApplied(
  proposals: readonly DocumentMemoryProposal[],
  appliedUpdateIds: readonly string[],
): boolean {
  const proposalIds = new Set(proposals.map((p) => p.id));
  return !appliedUpdateIds.some((id) => proposalIds.has(id));
}
