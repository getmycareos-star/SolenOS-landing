import type {
  DocumentEvidenceRow,
  GroundingContextPackage,
  InteractionContextRow,
  KnowledgeChunkRow,
  PolicyFactRow,
} from "./schema";
import type { TelemetryStore } from "./types";
import {
  POSTGRES_INTERACTION_CONTEXT_LIMIT,
  POSTGRES_KNOWLEDGE_CHUNK_LIMIT,
} from "../postgres-contract";

/**
 * Step 5 — package non-interpretive evidence for the model envelope.
 * NEVER includes raw DB structure, hidden memory, or inferred caregiver history.
 */
export function packageGroundingContext(sources: {
  documentEvidence: readonly DocumentEvidenceRow[];
  interactionContext: readonly InteractionContextRow[];
  knowledgeChunks: readonly KnowledgeChunkRow[];
  policyFacts: readonly PolicyFactRow[];
}): GroundingContextPackage {
  return {
    document_evidence: sources.documentEvidence.map((row) => ({
      extracted_text: row.extracted_text,
      structured_output: row.structured_output,
    })),
    interaction_context: sources.interactionContext.map((row) => ({
      input_raw: row.input_raw,
      risk_level: row.risk_level,
      created_at: row.created_at,
    })),
    knowledge_chunks: sources.knowledgeChunks.map((row) => ({
      chunk: row.chunk,
      category: row.category,
      source: row.source,
    })),
    policy_facts: sources.policyFacts.map((row) => ({
      category: row.category,
      key: row.key,
      value: row.value,
    })),
  };
}

/** Mandatory pre-reasoning order before model invocation. */
export async function loadPreReasoningEvidence(
  store: TelemetryStore,
  userId: string,
  policyCategories?: readonly string[],
): Promise<GroundingContextPackage> {
  const documentEvidence = await store.loadDocumentEvidence(userId);
  const interactionContext = await store.loadInteractionContext(
    userId,
    POSTGRES_INTERACTION_CONTEXT_LIMIT,
  );
  const knowledgeChunks = await store.retrieveKnowledgeChunks(
    POSTGRES_KNOWLEDGE_CHUNK_LIMIT,
  );
  const policyFacts = await store.loadPolicyFacts(policyCategories);

  return packageGroundingContext({
    documentEvidence,
    interactionContext,
    knowledgeChunks,
    policyFacts,
  });
}
