/**
 * Evidence Preservation — every conclusion must reconstruct from CareEvents.
 * Never "because AI said so."
 */

export type ObservationType = "direct" | "inferred" | "mixed";

export type EvidenceObject = {
  event_ids: string[];
  timeline_reference: string[];
  observation_type: ObservationType;
  confidence_score: number;
  source_reliability_score: number;
  recency_weight: number;
  contradiction_links: string[];
  /** Human-readable chain — not a black box. */
  evidence_chain: string[];
  reasoning_summary: string;
  what_would_increase_confidence: string[];
};

export type EvidencedConclusion = {
  recommendation: string;
  implied_action: string | null;
  evidence: EvidenceObject;
  layers: {
    recommendation: string;
    evidence: string[];
    reasoning: string;
    confidence: string;
  };
};

export function buildEvidenceObject(input: {
  event_ids: string[];
  timeline_labels: string[];
  observation_type?: ObservationType;
  confidence_score: number;
  source_reliability_score: number;
  age_days?: number;
  contradiction_links?: string[];
  reasoning_summary: string;
  what_would_increase_confidence?: string[];
}): EvidenceObject {
  const age = Math.max(0, input.age_days ?? 0);
  const recency_weight = Math.max(0.2, Math.pow(0.5, age / 14));

  return {
    event_ids: input.event_ids,
    timeline_reference: input.timeline_labels,
    observation_type: input.observation_type ?? "mixed",
    confidence_score: Math.min(1, Math.max(0, input.confidence_score)),
    source_reliability_score: Math.min(1, Math.max(0, input.source_reliability_score)),
    recency_weight,
    contradiction_links: input.contradiction_links ?? [],
    evidence_chain: input.timeline_labels.map(
      (label, i) => `Step ${i + 1}: ${label}`,
    ),
    reasoning_summary: input.reasoning_summary,
    what_would_increase_confidence:
      input.what_would_increase_confidence ?? [
        "Resolve critical Explicit Unknowns",
        "Confirm with higher-reliability source",
      ],
  };
}

export function buildEvidencedConclusion(input: {
  recommendation: string;
  implied_action?: string | null;
  evidence: EvidenceObject;
}): EvidencedConclusion {
  const conf = input.evidence.confidence_score;
  const confLabel =
    conf >= 0.8 ? "high" : conf >= 0.55 ? "moderate" : conf >= 0.35 ? "limited" : "low";

  return {
    recommendation: input.recommendation,
    implied_action: input.implied_action ?? null,
    evidence: input.evidence,
    layers: {
      recommendation: input.recommendation,
      evidence: input.evidence.evidence_chain,
      reasoning: input.evidence.reasoning_summary,
      confidence: `${conf.toFixed(2)} (${confLabel}) — based on these events, not AI decree`,
    },
  };
}
