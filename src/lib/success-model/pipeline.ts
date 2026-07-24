import type { DareIngestResult } from "../data-acquisition-resilience/types";
import type { FailureResilienceResult } from "../failure-resilience/types";
import type { NetworkEffectMoatResult } from "../network-effect-moat/types";
import type { TrustProvenanceResult } from "../trust-provenance/types";
import type { CanonicalCareEvent } from "../situation-entry/types";
import { ACTIVITY_METRICS, SUCCESS_MODEL_IDENTITY } from "./contract-constants";
import { createFeatureAcceptanceTemplate } from "./feature-acceptance";
import { measureLongitudinalSuccess } from "./longitudinal";
import {
  measureCognitiveLoadReduction,
  measureContinuityRestoration,
} from "./primary-metrics";
import {
  measureFollowUpReliability,
  measureMeetingPreparationEfficiency,
  measureRecallAccuracy,
  runRecallProbes,
} from "./recall-and-prep";
import { averageScores, scoreToLevel } from "./scoring";
import { getLatestSnapshot, recordSuccessSnapshot } from "./store";
import { measureSystemQuality } from "./system-quality";
import type { SuccessModelResult } from "./types";
import { measureUserTrust } from "./user-trust";

export { SUCCESS_MODEL_IDENTITY };

export function processSuccessModel(input: {
  caregiver_id: string;
  events: CanonicalCareEvent[];
  events_created: CanonicalCareEvent[];
  what_changed: string[];
  unresolved_questions: string[];
  dare: DareIngestResult | null;
  failure: FailureResilienceResult;
  trust: TrustProvenanceResult;
  moat: NetworkEffectMoatResult;
  top_event_ids: string[];
  attention_event_ids: string[];
  context_window_chars: number;
  has_active_episode: boolean;
}): SuccessModelResult {
  const linkedCount = input.events.filter(
    (e) => e.root_event_id !== null || e.entities.length > 0,
  ).length;
  const linkedEventPct = input.events.length > 0 ? linkedCount / input.events.length : 0;

  const cognitive_load_reduction = measureCognitiveLoadReduction({
    totalEvents: input.events.length,
    contextWindowChars: input.context_window_chars,
    unresolvedVisible: input.unresolved_questions.length,
    memoryRetrievalOrder: input.trust.retrieval_context.care_event_ids,
    caregiverRemembersViaSystem: input.events.length >= 3,
  });

  const continuity_restoration = measureContinuityRestoration({
    events: input.events,
    whatChanged: input.what_changed,
    unresolvedVisible: input.unresolved_questions,
    linkedEventPct,
    hasActiveEpisode: input.has_active_episode,
  });

  const meeting_preparation_efficiency = measureMeetingPreparationEfficiency({
    topEventIds: input.top_event_ids,
    attentionEventIds: input.attention_event_ids,
    unresolvedQuestions: input.unresolved_questions,
    openFollowUps: input.moat.compounding_metrics.open_follow_ups,
    totalRelevantEvents: input.events.length,
  });

  const follow_up_reliability = measureFollowUpReliability({
    openFollowUps: input.moat.compounding_metrics.open_follow_ups,
    closedFollowUps: input.moat.compounding_metrics.closed_follow_ups,
    attentionEvents: input.attention_event_ids.length,
    overdueSurfaced: input.attention_event_ids.length,
  });

  const recall_probes = runRecallProbes(input.events, input.unresolved_questions);
  const recall_accuracy = measureRecallAccuracy(recall_probes);

  const primary = {
    cognitive_load_reduction,
    continuity_restoration,
    meeting_preparation_efficiency,
    follow_up_reliability,
    recall_accuracy,
  };

  const system_quality = measureSystemQuality({
    events: input.events,
    dare: input.dare,
    failure: input.failure,
    moat: input.moat,
  });

  const user_trust = measureUserTrust(input.trust);

  const priorSnapshot = getLatestSnapshot(input.caregiver_id);

  const primaryScores = Object.values(primary).map((m) => m.score);
  const overall_success_score = Math.round(averageScores(primaryScores));

  const longitudinal = measureLongitudinalSuccess(
    input.moat,
    priorSnapshot,
    overall_success_score,
  );

  recordSuccessSnapshot({
    caregiver_id: input.caregiver_id,
    overall_success_score,
    primary_scores: Object.fromEntries(
      Object.entries(primary).map(([k, v]) => [k, v.score]),
    ),
    captured_at: new Date().toISOString(),
  });

  const overall_level = scoreToLevel(overall_success_score);

  const outcome_summary =
    overall_level === "strong"
      ? "SolenOS is measurably reducing cognitive load and restoring continuity."
      : overall_level === "moderate"
        ? "Continuity is building — outcome metrics trending positive."
        : overall_level === "weak"
          ? "Early journey — success metrics will strengthen with continued use."
          : "Add structured situations to begin measuring outcome success.";

  return {
    primary,
    system_quality,
    user_trust,
    longitudinal,
    overall_success_score,
    overall_level,
    outcome_summary,
    recall_probes,
    activity_metrics_excluded: [...ACTIVITY_METRICS],
    feature_acceptance_template: createFeatureAcceptanceTemplate(),
  };
}
