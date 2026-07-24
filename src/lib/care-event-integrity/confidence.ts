import type { ConfidenceLevel, FieldConfidence } from "./types";

export function numericToConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 0.85) return "high";
  if (score >= 0.65) return "medium";
  return "low";
}

export function createFieldConfidence(
  score: number,
  userConfirmed = false,
): FieldConfidence {
  return {
    extraction: numericToConfidenceLevel(score),
    user_confirmed: userConfirmed,
  };
}

/** Confidence increases only on user confirm, repeated evidence, or source alignment. */
export function upgradeFieldConfidence(
  current: FieldConfidence,
  reason: "user_confirmation" | "repeated_signal" | "cross_document_match",
): FieldConfidence {
  const order: ConfidenceLevel[] = ["low", "medium", "high"];
  const idx = order.indexOf(current.extraction);
  const next =
    reason === "user_confirmation"
      ? "high"
      : order[Math.min(idx + 1, order.length - 1)]!;
  return {
    extraction: next,
    user_confirmed: reason === "user_confirmation" ? true : current.user_confirmed,
  };
}

/** Contradiction lowers confidence — data is never removed. */
export function downgradeFieldConfidence(current: FieldConfidence): FieldConfidence {
  const order: ConfidenceLevel[] = ["low", "medium", "high"];
  const idx = order.indexOf(current.extraction);
  return {
    ...current,
    extraction: order[Math.max(idx - 1, 0)]!,
  };
}

export function createDefaultIntegrityFields(score: number, userConfirmed = false) {
  const fc = createFieldConfidence(score, userConfirmed);
  return {
    extracted_fact: fc,
    event_time: createFieldConfidence(score > 0.7 ? score : 0.4, userConfirmed),
  };
}
