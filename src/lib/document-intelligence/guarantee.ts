import { DOCUMENT_CONFIDENCE_THRESHOLD } from "./contract-constants";
import type {
  DocumentIntelligenceLayerResult,
  DocumentIntelligenceSystemGuaranteeResult,
  DocumentNode,
} from "./types";
import { assertExtractionInferenceSeparation } from "./inference-separation";
import { validateExtractedDocumentStructure } from "./structuring";
import { assertNoMemoryAutoCommit } from "./memory-proposals";

/**
 * System guarantee before downstream influence:
 * extraction complete, structure validated, inference separated, confidence computed.
 */
export function runDocumentIntelligenceSystemGuarantee(params: {
  nodes: readonly DocumentNode[];
  skipped: boolean;
  memoryProposalsPending: boolean;
}): DocumentIntelligenceSystemGuaranteeResult {
  const violations: string[] = [];

  if (params.skipped) {
    return { ok: true, violations: [] };
  }

  if (params.nodes.length === 0) {
    violations.push("document input detected but no document nodes produced");
  }

  for (const node of params.nodes) {
    if (!validateExtractedDocumentStructure(node.extracted)) {
      violations.push(`node ${node.id}: extracted document structure invalid`);
    }

    if (!assertExtractionInferenceSeparation(node.extracted, node.inference)) {
      violations.push(`node ${node.id}: extraction and inference fields merged`);
    }

    if (node.confidence.overall === undefined || node.confidence.extraction === undefined) {
      violations.push(`node ${node.id}: confidence not computed`);
    }

    if (
      node.confidence.uncertaintyFlagged &&
      node.confidence.overall >= DOCUMENT_CONFIDENCE_THRESHOLD
    ) {
      violations.push(`node ${node.id}: uncertainty flag inconsistent with confidence score`);
    }
  }

  if (!params.memoryProposalsPending) {
    violations.push("memory proposals must remain pending — no auto-commit allowed");
  }

  return { ok: violations.length === 0, violations };
}

export function validateDocumentIntelligenceLayerResult(
  result: DocumentIntelligenceLayerResult,
): DocumentIntelligenceSystemGuaranteeResult {
  const allProposals = result.memoryLinks.suggestedUpdates;
  return runDocumentIntelligenceSystemGuarantee({
    nodes: result.nodes,
    skipped: result.skipped,
    memoryProposalsPending: assertNoMemoryAutoCommit(allProposals),
  });
}
