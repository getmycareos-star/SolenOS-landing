/**
 * UnderstandingStage — Stage 2 of the SolenOS Intelligence Pipeline.
 *
 * Transforms extracted events into structured care situation understanding,
 * incorporating memory retrieval, relationship detection, and situation modeling.
 * Bridges the gap between raw extraction and reasoning.
 *
 * Contract:
 * - Never loses extracted events.
 * - Always produces a CareSituationUnderstanding (deterministic fallback).
 * - Memory retrieval enriches understanding without blocking orientation.
 * - Continuity detection bridges across sessions.
 *
 * Input:  UnderstandingInput (extraction result + prior context + identity)
 * Output: UnderstandingResult (understanding + context + whatChanged)
 */

import type { CanonicalCareEvent, CareContextRoot } from "../../lib/situation-entry/types";
import type { CareSituationUnderstanding } from "../../lib/care-situation-understanding/types";
import type { ContinuityDecision } from "../../lib/care-identity/continuity-detection";
import type { ActiveCareSituation } from "../../lib/active-care-situation/types";
import type { CareRealityState } from "../../lib/care-reality-state/types";
import type { UnderstandingInput, UnderstandingResult } from "../types";

import { getCareContextRoot, appendEventsToContext } from "../../lib/situation-entry/context-store";
import { buildSituationUnderstanding } from "../../lib/situation-entry/parse-situation";
import { processMemoryLayers } from "../../lib/care-memory-layers";
import { processMemoryStrategy } from "../../lib/memory-strategy-engine";
import { detectContinuity } from "../../lib/care-identity/continuity-detection";
import { processCareRealityIntelligence } from "../../lib/care-reality-intelligence";
import { processContinuityProperties } from "../../lib/continuity-properties";
import { processBaselineIntelligence } from "../../lib/baseline-intelligence-engine";
import { processCareRealityProfile } from "../../lib/care-reality-profile-engine";
import { processCareStateEngine } from "../../lib/care-state-engine";
import { processCareContextDiff } from "../../lib/care-context-diff-engine";
import { processBehaviorInterpretation } from "../../lib/behavior-interpretation-engine";
import {
  sanitizeCaregiverFacingLines,
  sanitizeSituationUncertaintyFields,
} from "../../lib/situation-entry/caregiver-facing-uncertainty";
import { caregiverLineFromDareUncertain, caregiverLineFromUnreadableSection } from "../../lib/situation-entry/caregiver-facing-uncertainty";
import { queryPriorityEvents } from "../../lib/care-event-priority";
import { estimateContextWindowSize } from "../../lib/care-memory-layers";
import { classifyInputForLoop } from "../../lib/continuous-execution-loop";
import { processContinuousExecutionLoop } from "../../lib/continuous-execution-loop";
import { processClarificationEngine } from "../../lib/clarification-engine";
import { applyPolicyToClarification } from "../../lib/policy-engine";

/**
 * Build a structured understanding of the care situation from extracted events,
 * enriched with memory retrieval, continuity detection, and situation modeling.
 */
export async function understandFromExtraction(
  input: UnderstandingInput,
): Promise<UnderstandingResult> {
  const {
    extraction,
    priorContext,
    caregiverId,
    careRecipientId,
    raw_input,
    continuityDecision: incomingContinuityDecision,
    activeSituation,
    careRealityState,
    timestamp,
  } = input;

  const isFirstSituation = !priorContext || priorContext.events.length === 0;

  // 1. Build care context from existing state + new events
  const context = priorContext
    ? appendEventsToContext(caregiverId, extraction.events)
    : (() => {
        const { getOrCreateCareContextRoot } = require("../../lib/situation-entry/context-store");
        const root = getOrCreateCareContextRoot(caregiverId);
        return appendEventsToContext(caregiverId, extraction.events);
      })();

  const events_created = extraction.events;
  const allEvents = context.events;

  // 2. Detect continuity — how this input relates to prior care reality
  const continuityDecision = incomingContinuityDecision ?? detectContinuity({
    caregiverId,
    careRecipientId,
    rawText: raw_input,
  });

  // 3. Build situation understanding from events
  const { understood, uncertain, clarification, tracked } = buildSituationUnderstanding(events_created);

  // 4. Classify input for continuous execution loop
  const unifiedInputType = classifyInputForLoop({
    raw_input,
    documents: [],
  });

  const continuous_execution_loop_layer = processContinuousExecutionLoop({
    caregiver_id: caregiverId,
    raw_input,
    input_type: unifiedInputType,
    prior_context: priorContext,
    context,
    events_created,
    dare: extraction.dare,
    is_first_situation: isFirstSituation,
    document_ids: [],
    captured_at: timestamp,
  });

  const whatChanged = continuous_execution_loop_layer.what_changed;

  // 5. Sanitize uncertainty lines from DARE and execution loop
  const provisionalFromDare = extraction.dare
    ? [
        ...extraction.dare.uncertain_events
          .map((u: any) => caregiverLineFromDareUncertain(u))
          .filter((line: string | null): line is string => Boolean(line)),
        ...extraction.dare.unreadable_sections.map((s: any) =>
          caregiverLineFromUnreadableSection(s.reason),
        ),
        ...extraction.dare.disambiguation_questions
          .map((q: any) => q.question)
          .filter((line: string | null): line is string => Boolean(line)),
      ]
    : [];

  const mergedUncertain = sanitizeCaregiverFacingLines([
    ...uncertain,
    ...provisionalFromDare,
    ...continuous_execution_loop_layer.open_uncertainties,
  ]);

  // 6. Process clarification engine
  const clarificationRaw = processClarificationEngine({
    caregiver_id: caregiverId,
    raw_input,
    events_created,
    what_is_uncertain: mergedUncertain,
    dare_disambiguation: extraction.dare?.disambiguation_questions.map((q: any) => q.question),
  });
  const clarificationPolicy = applyPolicyToClarification(caregiverId, clarificationRaw);
  const clarification_engine_layer = clarificationPolicy.layer;

  const mergedClarification = sanitizeCaregiverFacingLines([
    ...clarification_engine_layer.questions.map((q: { question: string }) => q.question),
    ...clarification,
    ...(extraction.dare?.disambiguation_questions.map((q: any) => q.question) ?? []),
    ...(extraction.dare?.normalization?.clarification_question ? [extraction.dare.normalization.clarification_question] : []),
  ], Math.max(clarification_engine_layer.budget_max, 5), { asksOnly: true });

  // 7. Process memory layers (episodic, semantic, working memory)
  const memory = processMemoryLayers({
    caregiver_id: caregiverId,
    events: allEvents,
    current_situation: raw_input.trim() || undefined,
    unresolved_questions: mergedClarification,
  });

  // 8. Process memory strategy (classification, decay, promotion, reinforcement)
  const memory_strategy_layer = processMemoryStrategy({
    caregiver_id: caregiverId,
    events_created,
    all_events: allEvents,
    as_of: timestamp ?? new Date().toISOString(),
  });

  // 9. Process baseline intelligence (person-level baselines)
  const baseline_intelligence_layer = processBaselineIntelligence({
    caregiver_id: caregiverId,
    care_recipient_id: careRecipientId,
    events_created,
    all_events: allEvents,
    raw_input,
    as_of: timestamp ?? new Date().toISOString(),
  });

  // 10. Process behavior interpretation
  const behavior_interpretation_layer = processBehaviorInterpretation({
    caregiver_id: caregiverId,
    events_created,
    all_events: allEvents,
    prior_events: priorContext?.events ?? [],
    what_changed: whatChanged,
    situation_snippets: raw_input.trim() ? [raw_input.trim()] : [],
  });

  // 11. Process care reality profile
  const care_reality_profile_layer = processCareRealityProfile({
    care_recipient_id: careRecipientId,
    all_events: allEvents,
    baseline: baseline_intelligence_layer,
    behavior: behavior_interpretation_layer,
    memory_strategy: memory_strategy_layer,
    what_is_uncertain: mergedUncertain,
    what_needs_clarification: mergedClarification,
    as_of: timestamp ?? new Date().toISOString(),
  });

  // 12. Process care context diff
  const care_context_diff_layer = processCareContextDiff({
    caregiver_id: caregiverId,
    prior_context: priorContext,
    context,
    events_created,
    state_diff: continuous_execution_loop_layer.diff,
    what_changed: whatChanged,
    behavior: behavior_interpretation_layer,
    continuity_decay: null as any,
    multi_caregiver: null as any,
    state_of_care: null as any,
    attention_event_ids: [],
    as_of: timestamp ?? new Date().toISOString(),
  });

  // 13. Process care state engine
  const care_state_engine_layer = processCareStateEngine({
    care_recipient_id: careRecipientId,
    all_events: allEvents,
    events_created,
    what_is_uncertain: mergedUncertain,
    what_needs_clarification: mergedClarification,
    care_context_diff: care_context_diff_layer,
    state_of_care: null as any,
    as_of: timestamp ?? new Date().toISOString(),
  });

  // 14. Process continuity properties
  const continuity_properties_layer = processContinuityProperties({
    caregiver_id: caregiverId,
    care_recipient_id: careRecipientId,
    raw_input,
    all_events: allEvents,
    events_created,
    what_is_happening: "",
    what_changed: whatChanged,
    what_needs_clarification: mergedClarification,
    what_needs_attention: care_state_engine_layer.care_state.needs_attention,
    what_is_stable: care_state_engine_layer.care_state.what_is_stable,
    conflict_count: 0,
    has_meaningful_diff: care_context_diff_layer.has_meaningful_change === true,
    clarification_question_count: clarification_engine_layer.questions?.length ?? 0,
    presentation_mode: "standard",
    clinical_profile_id: undefined,
  });

  // 15. Process care reality intelligence
  const care_reality_intelligence_layer = processCareRealityIntelligence({
    care_recipient_id: careRecipientId,
    all_events: allEvents,
    events_created,
    what_changed: whatChanged,
    what_is_happening: "",
    what_needs_attention: care_state_engine_layer.care_state.needs_attention,
    what_is_uncertain: mergedUncertain,
    baseline: baseline_intelligence_layer,
    care_reality_profile: care_reality_profile_layer,
    care_state: care_state_engine_layer.care_state,
    continuity_properties: continuity_properties_layer,
    moment_of_need: null as any,
    as_of: timestamp ?? new Date().toISOString(),
  });

  // 16. Build the CareSituationUnderstanding from events
  const understanding: CareSituationUnderstanding = {
    care_recipient: careRecipientId,
    facts: events_created
      .filter((e: CanonicalCareEvent) => e.status === "committed" || e.status === "provisional")
      .map((e: CanonicalCareEvent) => ({
        kind: (e.extracted_type === "incident" ? "event" : "observation") as "event" | "observation",
        text: e.raw_input.slice(0, 240),
        source_fragment: e.raw_input.slice(0, 500),
      })),
    interpretations: [],
    unknowns: mergedUncertain,
    possible_links: [],
    changes_from_baseline: baseline_intelligence_layer.deviations?.map(
      (d: any) => d.observation,
    ) ?? [],
    matters_now: [],
    can_wait: [],
    follow_up_questions: mergedClarification,
    context_only: [],
    continuity_hooks: [],
    can_orient: events_created.length > 0 || mergedUncertain.length > 0,
    instant_path: true,
    confidence: events_created.length >= 2 ? "medium" : "low",
  };

  return {
    understanding,
    events_created,
    context,
    whatChanged,
    mergedUncertain,
    mergedClarification,
    tracked: tracked.map((t: any) => t.label ?? String(t)),
  };
}
