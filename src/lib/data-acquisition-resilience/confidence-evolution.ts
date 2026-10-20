import type { ConfidenceSource, ExtractionCandidate, ValidatedCareEvent } from "./types";

export function evolveConfidence(
  current: number,
  sources: ConfidenceSource[],
  event: "repeated_signal" | "user_confirmation" | "contradiction_detected",
): { score: number; sources: ConfidenceSource[] } {
  const next = [...sources];

  switch (event) {
    case "repeated_signal":
      return {
        score: Math.min(0.92, current + 0.12),
        sources: [...new Set([...next, "repeated_signal" as ConfidenceSource])],
      };
    case "user_confirmation":
      return {
        score: 0.95,
        sources: [...new Set([...next, "user_confirmation" as ConfidenceSource])],
      };
    case "contradiction_detected":
      return { score: Math.max(0.1, current - 0.25), sources: next };
    default:
      return { score: current, sources: next };
  }
}

export function findRepeatedSignals(
  candidate: ExtractionCandidate,
  prior: ValidatedCareEvent[],
): ValidatedCareEvent | null {
  return (
    prior.find(
      (p) =>
        p.event_signal === candidate.event_signal &&
        p.extracted_fact.toLowerCase().includes(candidate.source_span.slice(0, 20).toLowerCase()),
    ) ?? null
  );
}

export function applyRepeatedSignalBoost(
  candidate: ExtractionCandidate,
  prior: ValidatedCareEvent[],
): { confidence: number; sources: ConfidenceSource[] } {
  const match = findRepeatedSignals(candidate, prior);
  if (!match) {
    return { confidence: candidate.confidence, sources: candidate.confidence_sources };
  }
  const evolved = evolveConfidence(candidate.confidence, candidate.confidence_sources, "repeated_signal");
  return { confidence: evolved.score, sources: evolved.sources };
}
