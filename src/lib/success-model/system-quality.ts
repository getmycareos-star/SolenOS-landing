import type { DareIngestResult } from "../data-acquisition-resilience/types";
import type { FailureResilienceResult } from "../failure-resilience/types";
import type { NetworkEffectMoatResult } from "../network-effect-moat/types";
import type { TrustProvenanceResult } from "../trust-provenance/types";
import type { CanonicalCareEvent } from "../situation-entry/types";
import { buildMetricScore } from "./scoring";
import type { SystemQualityScores } from "./types";

export function measureSystemQuality(input: {
  events: CanonicalCareEvent[];
  dare: DareIngestResult | null;
  failure: FailureResilienceResult;
  moat: NetworkEffectMoatResult;
}): SystemQualityScores {
  const committed = input.events.filter((e) => e.status === "committed");
  const avgConfidence =
    committed.length > 0
      ? committed.reduce((sum, e) => {
          const fc = e.integrity.field_confidence.extracted_fact.extraction;
          return sum + (fc === "high" ? 0.9 : fc === "medium" ? 0.7 : 0.45);
        }, 0) / committed.length
      : 0;

  const duplicateRate =
    input.events.length > 0
      ? input.moat.event_matches.length / input.events.length
      : 0;

  const linkingAccuracy =
    input.events.length > 0
      ? 1 - input.moat.isolated_records / Math.max(1, input.moat.interaction_outcomes.length)
      : 0;

  const docEvents = input.events.filter((e) => e.source === "document");
  const docSuccess =
    docEvents.length > 0
      ? docEvents.filter((e) => e.status !== "unparsed_raw").length / docEvents.length
      : 1;

  const followUpTotal =
    input.moat.compounding_metrics.open_follow_ups +
    input.moat.compounding_metrics.closed_follow_ups;
  const followUpCompletion =
    followUpTotal > 0
      ? input.moat.compounding_metrics.closed_follow_ups / followUpTotal
      : 0;

  const corrections =
    input.events.reduce((n, e) => n + e.integrity.correction_count, 0) +
    input.moat.compounding_metrics.correction_count;

  return {
    extraction_confidence: buildMetricScore(
      "extraction_confidence",
      avgConfidence * 100,
      [`Average extraction confidence: ${Math.round(avgConfidence * 100)}%`],
    ),
    unresolved_uncertainty_count: buildMetricScore(
      "unresolved_uncertainty_count",
      Math.max(0, 100 - input.failure.failures.length * 10),
      [`${input.failure.failures.length} active failure mode(s)`],
    ),
    user_corrections: buildMetricScore(
      "user_corrections",
      Math.min(100, corrections * 15),
      [`${corrections} caregiver correction(s) improving accuracy`],
    ),
    duplicate_event_rate: buildMetricScore(
      "duplicate_event_rate",
      Math.max(0, 100 - duplicateRate * 100),
      [`Duplicate detection: ${input.moat.event_matches.length} match(es) refined`],
    ),
    event_linking_accuracy: buildMetricScore(
      "event_linking_accuracy",
      linkingAccuracy * 100,
      [`${Math.round(linkingAccuracy * 100)}% events linked to context`],
    ),
    document_processing_accuracy: buildMetricScore(
      "document_processing_accuracy",
      docSuccess * 100,
      [`${Math.round(docSuccess * 100)}% documents structured successfully`],
    ),
    follow_up_completion_rate: buildMetricScore(
      "follow_up_completion_rate",
      followUpCompletion * 100,
      [`${Math.round(followUpCompletion * 100)}% follow-ups completed`],
    ),
  };
}
