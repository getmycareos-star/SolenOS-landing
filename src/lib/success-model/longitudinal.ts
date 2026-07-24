import type { NetworkEffectMoatResult } from "../network-effect-moat/types";
import { buildMetricScore } from "./scoring";
import type { LongitudinalScores, SuccessSnapshot } from "./types";

export function measureLongitudinalSuccess(
  moat: NetworkEffectMoatResult,
  priorSnapshot: SuccessSnapshot | null,
  overallSuccessScore: number,
): LongitudinalScores {
  const m = moat.compounding_metrics;

  const connectedScore = Math.min(100, m.total_relationships * 5 + m.total_events * 2);
  const resolvedScore = Math.min(100, m.resolved_uncertainty_count * 20);
  const linkedScore = Math.min(100, m.total_relationships * 8);
  const reusableScore = Math.min(
    100,
    m.days_of_continuity * 2 + m.total_entities * 5 + m.linked_documents * 10,
  );

  let repeatedEntryReduction = 50;
  if (priorSnapshot) {
    const delta = overallSuccessScore - priorSnapshot.overall_success_score;
    repeatedEntryReduction = Math.min(100, 50 + delta);
  }
  if (moat.event_matches.length > 0) {
    repeatedEntryReduction = Math.min(100, repeatedEntryReduction + moat.event_matches.length * 10);
  }

  return {
    connected_events: buildMetricScore(
      "connected_events",
      connectedScore,
      [`${m.total_events} events, ${m.total_relationships} relationships`],
    ),
    resolved_uncertainties: buildMetricScore(
      "resolved_uncertainties",
      resolvedScore,
      [`${m.resolved_uncertainty_count} uncertainty(ies) became permanent knowledge`],
    ),
    linked_relationships: buildMetricScore(
      "linked_relationships",
      linkedScore,
      [`${m.total_relationships} continuity links`],
    ),
    reusable_historical_context: buildMetricScore(
      "reusable_historical_context",
      reusableScore,
      [
        `${m.days_of_continuity} days of continuity`,
        `${m.total_entities} entities tracked`,
      ],
    ),
    repeated_entry_reduction: buildMetricScore(
      "repeated_entry_reduction",
      repeatedEntryReduction,
      moat.event_matches.length > 0
        ? [`${moat.event_matches.length} input(s) enriched existing context vs re-entered`]
        : ["Context enrichment reduces repeated entry over time"],
    ),
  };
}
