import type { TrustProvenanceResult } from "../trust-provenance/types";
import { buildMetricScore } from "./scoring";
import type { UserTrustScores } from "./types";

export function measureUserTrust(trust: TrustProvenanceResult): UserTrustScores {
  const verified = trust.trust_indicators.filter((i) => i.kind === "verified_by_caregiver").length;
  const provenanceCoverage =
    trust.provenance_records.length > 0
      ? trust.provenance_records.filter((p) => p.source_label).length /
        trust.provenance_records.length
      : 0;

  const evidenceSupported =
    trust.evidence_bundles.length > 0
      ? trust.evidence_bundles.filter((b) => b.supporting_events.length > 0).length /
        trust.evidence_bundles.length
      : 0;

  const confidenceScore =
    trust.confidence_assessment.level === "high"
      ? 90
      : trust.confidence_assessment.level === "medium"
        ? 70
        : trust.confidence_assessment.level === "low"
          ? 45
          : 10;

  return {
    corrections_accepted: buildMetricScore(
      "corrections_accepted",
      Math.min(100, trust.audit_trail_summary.length * 20 + verified * 10),
      [`${trust.audit_trail_summary.length} correction(s) in audit trail`],
    ),
    confidence_in_extraction: buildMetricScore(
      "confidence_in_extraction",
      confidenceScore,
      [trust.confidence_assessment.reason],
    ),
    provenance_coverage: buildMetricScore(
      "provenance_coverage",
      provenanceCoverage * 100,
      [`${trust.provenance_records.length} fact(s) with provenance records`],
    ),
    evidence_supported_answers: buildMetricScore(
      "evidence_supported_answers",
      evidenceSupported * 100,
      [`${Math.round(evidenceSupported * 100)}% insights have supporting evidence`],
    ),
    fabricated_events: buildMetricScore(
      "fabricated_events",
      trust.generation_boundaries.retrieval_only ? 100 : 0,
      trust.generation_boundaries.retrieval_only
        ? ["Zero fabricated events — retrieval-only enforced"]
        : ["Retrieval-only not enforced"],
    ),
  };
}
