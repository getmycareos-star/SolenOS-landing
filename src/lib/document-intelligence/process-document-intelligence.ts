import type { DocumentIntakeOutput } from "../document-intake";
import { MULTI_DOCUMENT_BOUNDARY_PATTERN } from "../document-intake/patterns";
import { applyLowConfidenceRules, computeDocumentConfidence } from "./confidence";
import {
  classifySolenOSDocumentType,
  detectSolenOSDocumentTypeFromText,
} from "./classify-document-type";
import { runDocumentIntelligenceSystemGuarantee } from "./guarantee";
import { separateInference } from "./inference-separation";
import { mergeMemoryLinks, proposeMemoryLinks } from "./memory-proposals";
import { derivePrioritySignals, generateDocumentSignals } from "./signals";
import { structureExtractedDocument, validateExtractedDocumentStructure } from "./structuring";
import type {
  DocumentIntelligenceLayerPayload,
  DocumentIntelligenceLayerResult,
  DocumentNode,
  DocumentReasoningOutput,
  SolenOSDocument,
} from "./types";

function generateNodeId(): string {
  return `doc_node_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function splitDocumentSegments(text: string, documentCount: number): string[] {
  const segments = text
    .split(MULTI_DOCUMENT_BOUNDARY_PATTERN)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (segments.length >= documentCount) return segments.slice(0, documentCount);
  if (segments.length === 0) return [text.trim()];
  return segments;
}

function buildDocumentNode(rawText: string, sourceType: SolenOSDocument): DocumentNode {
  const extracted = structureExtractedDocument(rawText, sourceType);
  const structureValid = validateExtractedDocumentStructure(extracted);
  const inference = separateInference(extracted, sourceType);
  const confidence = computeDocumentConfidence(extracted, inference, structureValid);
  const signals = generateDocumentSignals(sourceType, extracted);

  const node: DocumentNode = {
    id: generateNodeId(),
    type: sourceType,
    extracted,
    inference,
    linkedMemoryIds: [],
    linkedCareContextIds: [],
    prioritySignals: derivePrioritySignals(signals),
    confidence,
  };

  const memoryLinks = proposeMemoryLinks(node);
  node.linkedMemoryIds = memoryLinks.pendingWrites.map((p) => p.id);

  return node;
}

export type ProcessDocumentIntelligenceParams = {
  rawInput: string;
  documentIntake: DocumentIntakeOutput;
  /** Optional care context ids for linkage — never persisted by this layer. */
  careContextIds?: string[];
};

/**
 * Document Intelligence Layer — transforms raw document text into structured graph nodes.
 * Runs on raw input only; does NOT consume or modify LLM reasoning output.
 */
export function processDocumentIntelligenceLayer(
  params: ProcessDocumentIntelligenceParams,
): DocumentIntelligenceLayerResult {
  if (!params.documentIntake.is_document_input) {
    return {
      nodes: [],
      signals: [],
      memoryLinks: { suggestedUpdates: [], pendingWrites: [], conflictCandidates: [] },
      guarantee: { ok: true, violations: [] },
      skipped: true,
    };
  }

  const baseType =
    params.documentIntake.document_type_tags.length > 0
      ? classifySolenOSDocumentType(params.documentIntake.document_type_tags)
      : detectSolenOSDocumentTypeFromText(params.rawInput);

  const segments = splitDocumentSegments(params.rawInput, params.documentIntake.document_count);
  const nodes: DocumentNode[] = segments.map((segment) => {
    const segmentType =
      params.documentIntake.document_type_tags.length > 0
        ? classifySolenOSDocumentType(params.documentIntake.document_type_tags)
        : detectSolenOSDocumentTypeFromText(segment);
    const node = buildDocumentNode(segment, segmentType || baseType);
    if (params.careContextIds?.length) {
      node.linkedCareContextIds = [...params.careContextIds];
    }
    return node;
  });

  const signals = nodes.map((node) => generateDocumentSignals(node.type, node.extracted));
  const memoryLinks = mergeMemoryLinks(nodes.map((node) => proposeMemoryLinks(node)));

  const guarantee = runDocumentIntelligenceSystemGuarantee({
    nodes,
    skipped: false,
    memoryProposalsPending: memoryLinks.pendingWrites.every((p) => p.status === "pending"),
  });

  return { nodes, signals, memoryLinks, guarantee, skipped: false };
}

export function toDocumentIntelligenceLayerPayload(
  result: DocumentIntelligenceLayerResult,
): DocumentIntelligenceLayerPayload {
  const overallConfidence =
    result.nodes.length > 0
      ? result.nodes.reduce((sum, n) => sum + n.confidence.overall, 0) / result.nodes.length
      : 1;

  return {
    nodeCount: result.nodes.length,
    documentTypes: result.nodes.map((n) => n.type),
    overallConfidence,
    uncertaintyFlagged: result.nodes.some((n) => n.confidence.uncertaintyFlagged),
    signals: result.signals,
    pendingMemoryWriteCount: result.memoryLinks.pendingWrites.length,
  };
}

/** Output layer shape when document used in reasoning — extraction vs inference separated. */
export function buildDocumentReasoningOutput(
  result: DocumentIntelligenceLayerResult,
): DocumentReasoningOutput {
  const uncertaintyFlags: string[] = [];

  for (const node of result.nodes) {
    uncertaintyFlags.push(...applyLowConfidenceRules(node.confidence));
    uncertaintyFlags.push(...node.inference.ambiguityFlags);
  }

  return {
    extractionSection: result.nodes.map((n) => n.extracted),
    inferenceSection: result.nodes.map((n) => n.inference),
    confidenceScores: result.nodes.map((n) => n.confidence),
    uncertaintyFlags: [...new Set(uncertaintyFlags)],
  };
}

export function formatDocumentIntelligenceObservation(
  payload: DocumentIntelligenceLayerPayload,
): string | null {
  if (payload.nodeCount === 0) return null;
  const types = [...new Set(payload.documentTypes)].join(",");
  const uncertainty = payload.uncertaintyFlagged ? " uncertainty_flagged" : "";
  return `document_intelligence: nodes=${payload.nodeCount} types=${types} confidence=${payload.overallConfidence.toFixed(2)}${uncertainty}`;
}
