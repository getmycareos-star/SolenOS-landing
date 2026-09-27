/**
 * Longitudinal Reasoning Orchestration — Phase 2 TODO
 * 
 * Composes existing engines (change-detection, contradiction-detection-engine,
 * pattern-intelligence, priority-engine, care-state-change-detector)
 * to answer longitudinal questions across prior records.
 * 
 * Does NOT create new reasoning engines — only orchestrates existing ones.
 */

import type { CanonicalCareEvent, CareContextRoot } from "../situation-entry/types";
import type { ContradictionDetectionResult } from "../contradiction-detection-engine";
import type { BaselineIntelligenceResult, BaselineFact, BaselineDeviation } from "../baseline-intelligence-engine";
import type { CareStateChangeReport, DomainChange, ChangeClassification, CareDomain } from "../care-state-change-detector";
import type { PriorityState } from "../engine/domain/types";
import type { AggregatedConfidence } from "../confidence-aggregation";
import type { ContinuityTruthSlice } from "../presentation-engine";

import { detectCareStateChanges, domainForEvent, signalsForEvent } from "../care-state-change-detector";
import { detectMobilityTransitions, mergeTimelineContradictions } from "../contradiction-detection-engine";
import { processBaselineIntelligence } from "../baseline-intelligence-engine";
import { layeredPriorityEngine } from "../priority-engine";
import { computeAggregatedConfidence } from "../confidence-aggregation";
import { integrateSourceReliability } from "../source-reliability-integration";
import { projectPresentation, projectCareMoment } from "../presentation-engine";

export type LongitudinalReasoningInput = {
  /** Current care context */
  current_context: CareContextRoot;
  /** Prior care context for comparison */
  prior_context: CareContextRoot | null;
  /** New events from current interaction */
  events_created: CanonicalCareEvent[];
  /** Contradiction detection result */
  contradiction_detection?: ContradictionDetectionResult;
  /** Baseline intelligence result */
  baseline_intelligence?: BaselineIntelligenceResult;
  /** Priority state from reasoning */
  priority_state?: PriorityState;
  /** Caregiver ID */
  caregiver_id: string;
  /** Care recipient ID */
  care_recipient_id: string;
  /** Timestamp */
  timestamp: string;
};

export type LongitudinalReasoningOutput = {
  /** Care state change report (from care-state-change-detector) */
  care_state_changes: CareStateChangeReport;
  /** Contradiction timeline (from contradiction-detection-engine) */
  contradiction_timeline: ReturnType<typeof mergeTimelineContradictions>;
  /** Baseline deviations (from baseline-intelligence-engine) */
  baseline_deviations: BaselineIntelligenceResult["deviations"];
  /** Priority reasoning (from priority-engine) */
  priority_reasoning: PriorityState;
  /** Aggregated confidence (from confidence-aggregation) */
  aggregated_confidence: AggregatedConfidence;
  /** Source reliability integration */
  source_reliability: ReturnType<typeof integrateSourceReliability>;
  /** Composed longitudinal insights */
  longitudinal_insights: {
    what_changed: string[];
    what_matters_now: string[];
    what_is_stable: string[];
    what_we_are_uncertain_about: string[];
    what_questions_reduce_uncertainty: string[];
    trajectory_summary: string;
    attention_required: boolean;
    can_wait: boolean;
  };
  /** Presentation view for first screen */
  presentation_view: ReturnType<typeof projectPresentation>;
  /** Care moment view for in-the-moment capture */
  care_moment_view: ReturnType<typeof projectCareMoment>;
};

/**
 * Main orchestration function — composes existing engines
 * to answer longitudinal care questions.
 */
export async function orchestrateLongitudinalReasoning(
  input: LongitudinalReasoningInput
): Promise<LongitudinalReasoningOutput> {
  const {
    current_context,
    prior_context,
    events_created,
    contradiction_detection,
    baseline_intelligence,
    priority_state,
    caregiver_id,
    care_recipient_id,
    timestamp,
  } = input;
  
  // 1. Care State Change Detection (semantic change classification)
  const care_state_changes = detectCareStateChanges({
    priorContext: prior_context,
    currentContext: current_context,
    eventsCreated: events_created,
    baselineFacts: baseline_intelligence?.baseline_facts ?? [],
    baselineDeviations: baseline_intelligence?.deviations ?? [],
    contradictions: contradiction_detection ? {
      open_contradictions: contradiction_detection.open_contradictions,
      change_classifications: contradiction_detection.change_classifications,
    } : undefined,
  });
  
  // 2. Contradiction Timeline (merge related contradictions)
  const contradiction_timeline = contradiction_detection
    ? mergeTimelineContradictions({
        transitions: contradiction_detection.transitions,
        open_contradictions: contradiction_detection.open_contradictions,
      })
    : { merged_contradictions: [], contradiction_groups: [] };
  
  // 3. Baseline Intelligence (if not provided, compute)
  let computed_baseline = baseline_intelligence;
  if (!computed_baseline) {
    computed_baseline = await processBaselineIntelligence({
      caregiver_id,
      care_recipient_id,
      events: current_context.events,
      new_events: events_created,
    });
  }
  const baseline_deviations = computed_baseline.deviations;
  
  // 4. Priority Reasoning (if not provided, compute)
  let computed_priority = priority_state;
  if (!computed_priority) {
    computed_priority = await layeredPriorityEngine({
      caregiver_id,
      care_recipient_id,
      events: current_context.events,
      new_events: events_created,
      contradiction_detection: contradiction_detection!,
      baseline_intelligence: computed_baseline,
      continuity_properties: { explicit_unknowns: [] } as any, // Would need full type
      care_reality_state: {} as any, // Would need full type
      timestamp,
    });
  }
  
  // 5. Source Reliability Integration
  const source_reliability = integrateSourceReliability({
    events: current_context.events,
  });
  
  // 6. Aggregated Confidence
  const aggregated_confidence = computeAggregatedConfidence({
    evidenceObjects: [], // Would come from evidence-preservation
    contradictionResult: contradiction_detection,
    baselineResult: computed_baseline,
    continuityResult: { explicit_unknowns: [] } as any,
    priorityState: computed_priority,
    events: current_context.events,
    explicitUnknownsCount: 0,
  });
  
  // 7. Compose longitudinal insights from all engines
  const longitudinal_insights = composeLongitudinalInsights({
    care_state_changes,
    contradiction_timeline,
    baseline_deviations,
    priority_state: computed_priority,
    aggregated_confidence,
    source_reliability,
  });
  
  // 8. Build truth slice for presentation
  const truth_slice = buildTruthSlice({
    longitudinal_insights,
    care_state_changes,
    baseline_deviations,
    source_reliability,
    events_created,
  });
  
  // 9. Presentation views
  const presentation_view = projectPresentation(truth_slice, { mode: "standard" });
  const care_moment_view = projectCareMoment(truth_slice);
  
  return {
    care_state_changes,
    contradiction_timeline,
    baseline_deviations,
    priority_reasoning: computed_priority,
    aggregated_confidence,
    source_reliability,
    longitudinal_insights,
    presentation_view,
    care_moment_view,
  };
}

/**
 * Compose insights from all engine outputs
 */
function composeLongitudinalInsights(params: {
  care_state_changes: CareStateChangeReport;
  contradiction_timeline: ReturnType<typeof mergeTimelineContradictions>;
  baseline_deviations: BaselineDeviation[];
  priority_state: PriorityState;
  aggregated_confidence: AggregatedConfidence;
  source_reliability: ReturnType<typeof integrateSourceReliability>;
}): LongitudinalReasoningOutput["longitudinal_insights"] {
  const { care_state_changes, contradiction_timeline, baseline_deviations, priority_state, aggregated_confidence, source_reliability } = params;
  
  // What changed - from care state changes
  const what_changed = care_state_changes.primary_changes
    .map(c => `${c.domain.replace(/_/g, " ")}: ${c.classification} (${c.confidence}) - ${c.evidence.join("; ")}`);
  
  // What matters now - from priority state and compound signals
  const what_matters_now = [
    ...priority_state.explanationLines ?? [],
    ...care_state_changes.compound_signals.map(cs => cs.description),
    ...contradiction_timeline.merged_contradictions.map(c => c.shared_message),
  ];
  
  // What is stable - domains with STABLE classification
  const what_is_stable = care_state_changes.all_changes
    .filter(c => c.classification === "STABLE" || c.classification === "PERSISTENT" || c.classification === "IMPROVED")
    .map(c => `${c.domain.replace(/_/g, " ")}: ${c.classification}`);
  
  // What we are uncertain about - from priority state and confidence
  const what_we_are_uncertain_about = [
    ...(priority_state.what_is_unknown ?? []),
    ...care_state_changes.unresolved_questions,
  ];
  
  // What questions reduce uncertainty
  const what_questions_reduce_uncertainty = [
    ...care_state_changes.unresolved_questions,
    ...(aggregated_confidence.what_would_increase ?? []),
  ].slice(0, 3);
  
  return {
    what_changed,
    what_matters_now: what_matters_now.slice(0, 5),
    what_is_stable: what_is_stable.slice(0, 3),
    what_we_are_uncertain_about: what_we_are_uncertain_about.slice(0, 4),
    what_questions_reduce_uncertainty,
    trajectory_summary: care_state_changes.trajectory_summary,
    attention_required: care_state_changes.attention_required,
    can_wait: care_state_changes.can_wait,
  };
}

/**
 * Build truth slice for presentation engine
 */
function buildTruthSlice(params: {
  longitudinal_insights: LongitudinalReasoningOutput["longitudinal_insights"];
  care_state_changes: CareStateChangeReport;
  baseline_deviations: BaselineDeviation[];
  source_reliability: ReturnType<typeof integrateSourceReliability>;
  events_created: CanonicalCareEvent[];
}): ContinuityTruthSlice {
  const { longitudinal_insights, care_state_changes, baseline_deviations, source_reliability, events_created } = params;
  
  return {
    what_changed: longitudinal_insights.what_changed,
    what_is_happening: longitudinal_insights.what_matters_now,
    what_needs_attention: longitudinal_insights.what_matters_now,
    what_is_stable: longitudinal_insights.what_is_stable,
    known: events_created
      .filter(e => (e.integrity?.field_confidence?.extracted_fact?.extraction ?? 0) > 0.7)
      .map(e => e.raw_input.slice(0, 100)),
    inferred: longitudinal_insights.what_matters_now,
    explicit_unknowns: longitudinal_insights.what_we_are_uncertain_about.map(q => ({
      missing_information: q,
      priority: "high" as const,
      reason_it_matters: "Reduces uncertainty in care understanding",
      related_event_ids: [],
    })),
    confidence_notes: [
      `Overall confidence: ${Math.round(aggregated_confidence.overall * 100)}% (${aggregated_confidence.label})`,
      `Source reliability: ${Math.round(source_reliability.overall_reliability * 100)}%`,
    ],
    evidence_summaries: source_reliability.weighted_events
      .filter(w => w.include_in_reasoning)
      .slice(0, 3)
      .map(w => `${w.source_reliability.source_type}: ${w.event.raw_input.slice(0, 80)}`),
    reasoning_summary: care_state_changes.trajectory_summary,
    baseline_comparison: baseline_deviations.map(d => ({
      domain: d.domain,
      baseline_statement: d.baseline_statement,
      current_observation: d.current_observation,
      deviation_type: d.deviation_type,
      confidence: d.confidence,
    })),
  };
}

/**
 * Quick longitudinal check for first screen
 */
export function quickLongitudinalCheck(
  prior: CareContextRoot | null,
  current: CareContextRoot,
  newEvents: CanonicalCareEvent[]
): {
  has_meaningful_change: boolean;
  primary_changes: string[];
  trajectory: "worsening" | "improving" | "stable" | "mixed" | "unknown";
  attention_required: boolean;
} {
  const report = detectCareStateChanges({
    priorContext: prior,
    currentContext: current,
    eventsCreated: newEvents,
    baselineFacts: [],
    baselineDeviations: [],
  });
  
  const worsening = report.all_changes.filter(c => c.trajectory === "worsening");
  const improving = report.all_changes.filter(c => c.trajectory === "improving");
  
  let trajectory: "worsening" | "improving" | "stable" | "mixed" | "unknown" = "unknown";
  if (worsening.length > 0 && improving.length > 0) trajectory = "mixed";
  else if (worsening.length > 0) trajectory = "worsening";
  else if (improving.length > 0) trajectory = "improving";
  else if (report.all_changes.some(c => c.classification === "STABLE" || c.classification === "PERSISTENT")) trajectory = "stable";
  
  return {
    has_meaningful_change: report.has_meaningful_change,
    primary_changes: report.primary_changes.map(c => `${c.domain}: ${c.classification}`),
    trajectory,
    attention_required: report.attention_required,
  };
}