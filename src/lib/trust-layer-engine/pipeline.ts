import {
  TRUST_BEHAVIOR_RULES,
  TRUST_DESIGN_PRINCIPLES,
  TRUST_LAYER_DEFINING_PRINCIPLE,
  TRUST_LAYER_ENGINE_IDENTITY,
  CLARIFICATION_CONFIDENCE_THRESHOLD,
} from "./contract-constants";
import { buildKnownFacts } from "./build-known";
import { buildAssumedInferences } from "./build-assumed";
import { buildUnknownGaps } from "./build-unknown";
import { computeConfidence, computeRecency } from "./compute-recency-confidence";
import { validateTrustLayer } from "./validate-trust";
import { recordTrustSnapshot } from "./store";
import type { ProcessTrustLayerEngineInput, TrustLayerEngineResult } from "./types";

export function processTrustLayerEngine(
  input: ProcessTrustLayerEngineInput,
): TrustLayerEngineResult {
  const asOf = input.as_of ?? new Date().toISOString();

  const known = buildKnownFacts(input.events_created, input.trust_provenance.provenance_records);
  const assumed = buildAssumedInferences(input.behavior);
  const unknown = buildUnknownGaps({
    what_is_uncertain: input.what_is_uncertain,
    what_needs_clarification: input.what_needs_clarification,
    continuity_decay: input.continuity_decay,
    clarification: input.clarification,
  });

  const recency = computeRecency(input.all_events, input.continuity_decay, asOf);
  const hasVerifiedEvents = input.events_created.some(
    (e) => e.status === "committed" || e.source === "document",
  );

  const confidence = computeConfidence({
    trust_provenance: input.trust_provenance,
    continuity_decay: input.continuity_decay,
    memory_strategy: input.memory_strategy,
    unknown_count: unknown.filter((u) => u.drives_clarification).length,
    assumed_count: assumed.length,
    freshness_score: recency.freshness_score,
    has_verified_events: hasVerifiedEvents,
  });

  const trust_layer = { known, assumed, unknown, recency, confidence };
  const { valid, errors } = validateTrustLayer(trust_layer);

  const highSeverity = input.attention_event_ids.length >= 1;
  const clarification_triggered =
    confidence < CLARIFICATION_CONFIDENCE_THRESHOLD && highSeverity;

  recordTrustSnapshot(input.caregiver_id, trust_layer);

  return {
    active: true,
    trust_layer,
    valid,
    validation_errors: errors,
    clarification_triggered,
    rules_upheld: [...TRUST_BEHAVIOR_RULES, ...TRUST_DESIGN_PRINCIPLES],
    defining_principle: TRUST_LAYER_DEFINING_PRINCIPLE,
  };
}

export { TRUST_LAYER_ENGINE_IDENTITY };
