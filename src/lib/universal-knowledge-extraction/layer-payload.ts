import {
  UNIVERSAL_KNOWLEDGE_BOUNDARY,
  UNIVERSAL_KNOWLEDGE_IDENTITY,
} from "./contract-constants";
import type { DocumentKnowledgeResult, UniversalKnowledgeLayerPayload } from "./types";

export function toUniversalKnowledgeLayerPayload(
  result: DocumentKnowledgeResult,
): UniversalKnowledgeLayerPayload {
  return {
    identity: UNIVERSAL_KNOWLEDGE_IDENTITY,
    boundary: UNIVERSAL_KNOWLEDGE_BOUNDARY,
    document_id: result.document_id,
    document_name: result.document_name,
    domain: result.domain,
    document_type: result.document_type,
    approved_items: result.approved_count,
    pending_review_items: result.pending_review_count,
    changes_summary: result.changes.summary,
    follow_ups: result.follow_ups,
    clarity: result.clarity,
    journey_event_ids: result.journey_results.map((r) => r.event.id),
  };
}
