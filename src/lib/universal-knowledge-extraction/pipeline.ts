import { stressNormalizeInput } from "../input-stress-normalizer";
import { applyDocumentIntake } from "../document-intake";
import { processDocumentIntelligenceLayer } from "../document-intelligence";
import { assessDocumentChanges, extractFollowUps } from "./assess-changes";
import { buildDocumentClarityOutput } from "./build-clarity";
import { domainFromDocumentTags, domainFromSolenOSDocumentType } from "./classify-domain";
import { detectKnowledgeRelationships } from "./detect-knowledge-links";
import { extractKnowledgeItemsFromNode } from "./extract-knowledge-items";
import { linkKnowledgeToCareJourney } from "./link-to-journey";
import { storeDocumentKnowledge } from "./store";
import { detectProposedMeetingsFromText } from "../meeting-preparation/preparation-windows";
import { createProposedMeeting } from "../meeting-preparation/meeting-store";
import type { DocumentKnowledgeResult, ProcessDocumentKnowledgeParams } from "./types";

/**
 * Universal Knowledge Extraction pipeline.
 *
 * Document text → structured knowledge → journey events → relationships → what changed
 */
export function processUniversalKnowledgeExtraction(
  params: ProcessDocumentKnowledgeParams,
): DocumentKnowledgeResult {
  const extractedText = params.extracted_text.trim();
  if (!extractedText) {
    throw new Error("extracted_text required for knowledge extraction");
  }

  const extractedAt = new Date().toISOString();
  const normalized = stressNormalizeInput(extractedText);
  const intake = applyDocumentIntake(normalized);
  const intelligence = processDocumentIntelligenceLayer({
    rawInput: normalized.raw_input,
    documentIntake: intake,
  });

  const node = intelligence.nodes[0];
  if (!node) {
    throw new Error("No document node produced from extraction");
  }

  const knowledgeItems = extractKnowledgeItemsFromNode(node, {
    document_id: params.document_id,
    document_name: params.document_name,
    extracted_at: extractedAt,
  });

  const relationships = detectKnowledgeRelationships(knowledgeItems);
  const clarity = buildDocumentClarityOutput([...intelligence.nodes], knowledgeItems);
  const changes = assessDocumentChanges(knowledgeItems, params.document_name);
  const followUps = extractFollowUps(knowledgeItems);

  const { results, updated_items } = linkKnowledgeToCareJourney({
    document_id: params.document_id,
    document_name: params.document_name,
    document_type: node.type,
    knowledge_items: knowledgeItems,
    caregiver_id: params.caregiver_id,
    case_id: params.case_id,
    mime_type: params.mime_type,
  });

  let domain = intake.document_type_tags.length
    ? domainFromDocumentTags(intake.document_type_tags)
    : domainFromSolenOSDocumentType(node.type);

  if (
    node.type === "legal_document" ||
    knowledgeItems.some((i) => i.category === "legal_authority")
  ) {
    domain = "legal";
  }

  const result: DocumentKnowledgeResult = {
    document_id: params.document_id,
    document_name: params.document_name,
    document_type: node.type,
    domain,
    knowledge_items: updated_items,
    relationships,
    clarity,
    changes,
    follow_ups: followUps,
    pending_review_count: updated_items.filter((i) => i.review_status === "pending_review").length,
    approved_count: updated_items.filter((i) => i.review_status === "approved").length,
    journey_results: results,
    document_node: node,
    extracted_at: extractedAt,
  };

  storeDocumentKnowledge(result);

  const proposals = detectProposedMeetingsFromText({
    text: extractedText,
    caregiver_id: params.caregiver_id,
    case_id: params.case_id,
  });
  for (const proposal of proposals) {
    createProposedMeeting(proposal);
  }

  return result;
}
