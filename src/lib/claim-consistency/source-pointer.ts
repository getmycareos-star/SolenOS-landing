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

export function verifySourcePointer(claim: ExtractedClaim): boolean {
  if (!claim.source_span) return false;

  const span = claim.source_span;

  if (typeof span.start_offset !== "number" || typeof span.end_offset !== "number") {
    return false;
  }

  if (span.start_offset < 0 || span.end_offset < 0) {
    return false;
  }

  if (span.end_offset <= span.start_offset) {
    return false;
  }

  if (typeof span.text !== "string" || span.text.trim().length === 0) {
    return false;
  }

  const actualText = span.text.slice(span.start_offset, span.end_offset);
  if (actualText.trim().length === 0) {
    return false;
  }

  return true;
}

export function enforceSourcePointer(claim: ExtractedClaim): ExtractedClaim {
  const pointerValid = verifySourcePointer(claim);

  if (!pointerValid) {
    const enforcedTag: ConfidenceTag = "unknown";

    if (claim.confidence_tag === "confirmed" || claim.confidence_tag === "reported") {
      return {
        ...claim,
        confidence_tag: enforcedTag,
      };
    }

    if (claim.confidence_tag === "inferred") {
      return {
        ...claim,
        confidence_tag: "unknown",
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
