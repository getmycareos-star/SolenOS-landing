import type { StressNormalizedOutput } from "../input-stress-normalizer";
import type { ContextWindowOutput } from "../context-window-strategy";

/** Deterministic serialization for LangChain envelope — no semantic mutation. */
export function stableStringifyStressPayload(payload: StressNormalizedOutput): string {
  return JSON.stringify({
    raw_input: payload.raw_input,
    detected_tags: [...payload.detected_tags].sort(),
    segments: payload.segments.map((segment) => ({
      type: segment.type,
      content: segment.content,
    })),
    metadata: {
      has_emotional_language: payload.metadata.has_emotional_language,
      has_medical_content: payload.metadata.has_medical_content,
      has_contradictions: payload.metadata.has_contradictions,
      has_incomplete_context: payload.metadata.has_incomplete_context,
    },
  });
}

/** Context window + document intake + optional grounding evidence for Gemini envelope. */
export function stableStringifyContextPayload(
  payload: ContextWindowOutput,
  documentIntake?: import("../document-intake").DocumentIntakeOutput | null,
  groundingContext?: import("../telemetry-persistence/schema").GroundingContextPackage | null,
): string {
  return JSON.stringify({
    preserved_text: payload.preserved_text,
    structured_context: payload.structured_context,
    compression_applied: payload.compression_applied,
    source_tags: [...payload.source_tags].sort(),
    metadata: payload.metadata,
    document_intake: documentIntake ?? null,
    grounding_evidence: groundingContext ?? null,
  });
}
