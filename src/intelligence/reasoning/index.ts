/**
 * ReasoningStage — Stage 3 of the SolenOS Intelligence Pipeline.
 *
 * Before any caregiver-facing response is composed, this stage answers the
 * core questions about the care situation using CareSituationUnderstanding,
 * ContinuityDecision, and memory context.
 *
 * Contract:
 * - Never exposes internal reasoning artifacts to caregiver.
 * - Produces a structured CareReasoningSnapshot for the composer.
 * - Falls back deterministically when enrichment is unavailable.
 *
 * Input:  ReasoningInput (understanding + continuity + context)
 * Output: ReasoningResult (reasoning snapshot + allQuestionsAnswered)
 */

import { buildCareReasoning } from "../../lib/care-reasoning/internal-reasoning-layer";
import type { ReasoningInput, ReasoningResult } from "../types";
import { processMemoryStrategy } from "../../lib/memory-strategy-engine";
import { queryPriorityEvents } from "../../lib/care-event-priority";
import { processContinuityDecay } from "../../lib/continuity-decay-engine";
import { processTrustLayerEngine } from "../../lib/trust-layer-engine";
import { processCrisisModeInteraction } from "../../lib/crisis-mode-interaction-layer";

/**
 * Reason over the understood care situation to produce a structured
 * reasoning snapshot that feeds the communication/composer stage.
 *
 * Answers the core questions:
 * - Who is this about?
 * - Is this new information or continuation?
 * - What changed?
 * - What matters most?
 * - What can wait?
 * - What is unknown?
 * - What questions reduce uncertainty?
 */
export async function reasonFromUnderstanding(
  input: ReasoningInput,
): Promise<ReasoningResult> {
  const {
    understanding,
    continuityDecision,
    caregiverId,
    careRecipientId,
    events_created,
    context,
    whatChanged,
    mergedUncertain,
    mergedClarification,
    raw_input,
    timestamp,
  } = input;

  // 1. Build the core reasoning snapshot (7 questions)
  const reasoningSnapshot = buildCareReasoning({
    understanding,
    continuityDecision,
  });

  // 2. Process memory strategy — what should be remembered, surfaced, or decayed
  const memory_strategy_layer = processMemoryStrategy({
    caregiver_id: caregiverId,
    events_created,
    all_events: context.events,
    as_of: timestamp ?? new Date().toISOString(),
  });

  // 3. Get priority events context
  const priorityQuery = queryPriorityEvents(context.events);

  // 4. Process continuity decay — what is fading or needs reinforcement
  const continuity_decay_layer = processContinuityDecay({
    caregiver_id: caregiverId,
    all_events: context.events,
    events_created,
    what_needs_clarification: mergedClarification,
    what_is_uncertain: mergedUncertain,
    attention_event_ids: priorityQuery.attention_events.map((e: any) => e.id),
    what_changed: whatChanged,
    as_of: timestamp ?? new Date().toISOString(),
    trigger: "entry",
  });

  // 5. Process trust layer — confidence in the reasoning
  const trust_layer_engine_layer = processTrustLayerEngine({
    caregiver_id: caregiverId,
    events_created,
    all_events: context.events,
    what_is_uncertain: mergedUncertain,
    what_needs_clarification: mergedClarification,
    trust_provenance: null as any,
    behavior: null as any,
    continuity_decay: continuity_decay_layer,
    memory_strategy: memory_strategy_layer,
    clarification: null as any,
    attention_event_ids: priorityQuery.attention_events.map((e: any) => e.id),
    as_of: timestamp ?? new Date().toISOString(),
  });

  // 6. Process crisis detection — safety signals that override normal reasoning
  const crisis_mode_interaction_layer = processCrisisModeInteraction({
    caregiver_id: caregiverId,
    raw_input,
    events_created,
    all_events: context.events,
    behavior: null as any,
    attention_event_ids: priorityQuery.attention_events.map((e: any) => e.id),
    what_changed: whatChanged,
    as_of: timestamp ?? new Date().toISOString(),
  });

  // 7. Determine if all questions are sufficiently answered to compose
  const allQuestionsAnswered = Boolean(
    reasoningSnapshot.who.care_recipient ||
    reasoningSnapshot.change.has_changes ||
    reasoningSnapshot.priority.matters_now.length > 0 ||
    (understanding as any).can_orient
  );

return {
    reasoningSnapshot,
    allQuestionsAnswered,
  };
}
