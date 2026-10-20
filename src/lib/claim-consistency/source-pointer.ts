import type { ExtractedClaim, ConfidenceTag, EntityType, SourceSpan } from "./types";

const VALID_ENTITY_TYPES: readonly EntityType[] = [
  "person",
  "place",
  "institution",
  "object",
  "symptom",
  "behavior",
  "medication",
  "event",
  "unknown",
];

/**
 * Verify that a source span's text exactly matches the original evidence
 * text at the claimed character offsets.
 *
 * Per spec §6:
 *   const actual = originalText.slice(start_offset, end_offset);
 *   actual === source_span.text  must be true.
 *
 * If false: source_span must be nulled and confidence downgraded to "unknown".
 */
export function verifySourcePointer(claim: ExtractedClaim, originalText: string): boolean {
  if (!claim.source_span) return false;

  const span = claim.source_span;

  if (typeof span.start_offset !== "number" || typeof span.end_offset !== "number") {
    return false;
  }

  if (!Number.isFinite(span.start_offset) || !Number.isFinite(span.end_offset)) {
    return false;
  }

  if (span.start_offset < 0 || span.end_offset < 0) {
    return false;
  }

  if (span.end_offset <= span.start_offset) {
    return false;
  }

  if (span.start_offset > originalText.length) {
    return false;
  }

  if (typeof span.text !== "string" || span.text.trim().length === 0) {
    return false;
  }

  const actualText = originalText.slice(span.start_offset, span.end_offset);

  if (actualText !== span.text) {
    return false;
  }

  if (actualText.trim().length === 0) {
    return false;
  }

  return true;
}

/**
 * Enforce the source-pointer / confidence contract.
 *
 * When the pointer is invalid:
 *   - source_span is nulled (per spec §6)
 *   - confidence_tag is downgraded to "unknown" for confirmed/reported
 *   - confidence_tag is downgraded to "unknown" for inferred
 */
export function enforceSourcePointer(claim: ExtractedClaim, originalText: string): ExtractedClaim {
  const pointerValid = verifySourcePointer(claim, originalText);

  if (!pointerValid) {
    if (claim.confidence_tag === "confirmed" || claim.confidence_tag === "reported" || claim.confidence_tag === "inferred") {
      return {
        ...claim,
        source_span: null,
        confidence_tag: "unknown",
      };
    }

    if (claim.confidence_tag === "unknown" || claim.confidence_tag === "contradictory") {
      return {
        ...claim,
        source_span: null,
      };
    }
  }

  return claim;
}

export function isValidEntityType(entityType: string): entityType is EntityType {
  return VALID_ENTITY_TYPES.includes(entityType as EntityType);
}

export function coerceEntityType(entityType: string): EntityType {
  if (isValidEntityType(entityType)) {
    return entityType;
  }
  return "unknown";
}

export function computeSourceSpanOverlap(
  spanA: SourceSpan | null,
  spanB: SourceSpan | null,
): number {
  if (!spanA || !spanB) return 0;

  const overlapStart = Math.max(spanA.start_offset, spanB.start_offset);
  const overlapEnd = Math.min(spanA.end_offset, spanB.end_offset);

  const overlapLength = Math.max(0, overlapEnd - overlapStart);

  const spanALength = spanA.end_offset - spanA.start_offset;
  const spanBLength = spanB.end_offset - spanB.start_offset;

  const minLength = Math.min(spanALength, spanBLength);
  if (minLength <= 0) return 0;

  return overlapLength / minLength;
}
