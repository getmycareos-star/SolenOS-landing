/**
 * Evidence Preservation — evidence linkage is not the same as verified truth.
 * Numeric confidence and recency values are withheld until validated methods exist.
 */

export type ObservationType = "direct" | "inferred" | "mixed" | "reported" | "unclassified";

export type EvidenceObject = {
  event_ids: string[];
  timeline_reference: string[];
  observation_type: ObservationType;
  /** Null unless a validated, task-specific calibration is configured. */
  confidence_score: number | null;
  /** Null unless a validated, claim-specific source assessment exists. */
  source_reliability_score: number | null;
  /** Null until a domain-specific freshness policy is configured. */
  recency_weight: number | null;
  linkage_status: "event_references_present" | "no_linked_event_references";
  contradiction_links: string[];
  /** Human-readable references; labels are not substitutes for source passages. */
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
    grounding_status: "event_references_present" | "no_linked_event_references";
  };
};

export function buildEvidenceObject(input: {
  event_ids: string[];
  timeline_labels: string[];
  observation_type?: ObservationType;
  /** Deprecated compatibility input. It is deliberately not emitted as calibrated confidence. */
  confidence_score?: number | null;
  /** Deprecated compatibility input. It is deliberately not emitted as source reliability. */
  source_reliability_score?: number | null;
  /** Deprecated compatibility input. No universal recency decay is applied. */
  age_days?: number | null;
  contradiction_links?: string[];
  reasoning_summary: string;
  what_would_increase_confidence?: string[];
}): EvidenceObject {
  const eventIds = [...new Set(input.event_ids.filter(
    (id) => typeof id === "string" && id.trim().length > 0,
  ))];
  const timelineLabels = input.timeline_labels.filter(
    (label) => typeof label === "string" && label.trim().length > 0,
  );

  return {
    event_ids: eventIds,
    timeline_reference: timelineLabels,
    observation_type: input.observation_type ?? "unclassified",
    // Caller-supplied numbers are not evidence that a scoring method is calibrated.
    confidence_score: null,
    source_reliability_score: null,
    recency_weight: null,
    linkage_status: eventIds.length > 0 ? "event_references_present" : "no_linked_event_references",
    contradiction_links: [...new Set(input.contradiction_links ?? [])],
    evidence_chain: timelineLabels.map((label, i) => `Reference ${i + 1}: ${label}`),
    reasoning_summary: input.reasoning_summary,
    what_would_increase_confidence:
      input.what_would_increase_confidence ?? [
        "Link the original source record and identify who reported or observed it.",
        "Assess the claim against a documented, task-specific evidence policy.",
      ],
  };
}

export function buildEvidencedConclusion(input: {
  recommendation: string;
  implied_action?: string | null;
  evidence: EvidenceObject;
}): EvidencedConclusion {
  return {
    recommendation: input.recommendation,
    implied_action: input.implied_action ?? null,
    evidence: input.evidence,
    layers: {
      recommendation: input.recommendation,
      evidence: input.evidence.evidence_chain,
      reasoning: input.evidence.reasoning_summary,
      confidence: "Not calibrated: no validated task-specific confidence method is configured.",
      grounding_status: input.evidence.linkage_status,
    },
  };
}

// Export builder functions
export {
  buildEvidenceForPriority,
  buildEvidenceForUncertainty,
  collectEvidenceFromInterpretation,
  ratifyPriorityWithEvidence,
  buildTransparencyAuditTrail,
  type EvidenceContext,
  type EvidenceTraceContext,
} from "./evidence-builder";
