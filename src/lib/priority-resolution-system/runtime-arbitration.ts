import type { SituationResponse } from "../situation-entry/types";
import { processPriorityResolution } from "../priority-resolution-system";
import { processEdgeState } from "../edge-state-machine";
import { processEventSourcedStorage } from "../event-sourced-storage";
import { processEngineExecutionContract } from "../engine-execution-contract";
import {
  processConfidenceCalibration,
  type SourceTypeWeight,
} from "../confidence-calibration-system";
import type { CanonicalCareEvent } from "../situation-entry/types";

function mapSourceType(event: CanonicalCareEvent): SourceTypeWeight {
  if (event.source === "document") return "reported_second_hand";
  if (event.uncertainty.length > 2) return "unverified_input";
  if (/infer|possible|suspect|might/i.test(event.raw_input)) return "system_inference";
  return "caregiver_direct_observation";
}

function daysSinceLastEvent(events: CanonicalCareEvent[], asOf: string): number | null {
  if (events.length === 0) return null;
  const last = events[events.length - 1]!;
  const ms = new Date(asOf).getTime() - new Date(last.ingestion_time).getTime();
  return Math.max(0, ms / (24 * 60 * 60 * 1000));
}

/**
 * Run all five runtime arbitration / reliability layers after engines, before compile.
 */
export function processRuntimeArbitrationLayers(input: {
  caregiver_id: string;
  response: Omit<SituationResponse, "final_output" | "mvp_surface_area_layer" | "architectural_boundaries_layer"> &
    Partial<Pick<SituationResponse, "mvp_surface_area_layer">>;
  is_session_reentry?: boolean;
  is_return_session?: boolean;
  as_of?: string;
}): {
  priority_resolution_layer: ReturnType<typeof processPriorityResolution>;
  edge_state_layer: ReturnType<typeof processEdgeState>;
  event_sourced_storage_layer: ReturnType<typeof processEventSourcedStorage>;
  engine_execution_contract_layer: ReturnType<typeof processEngineExecutionContract>;
  confidence_calibration_layer: ReturnType<typeof processConfidenceCalibration>;
} {
  const asOf = input.as_of ?? new Date().toISOString();
  const context = input.response.context;
  const events = context.events;
  const crisis = input.response.crisis_mode_interaction_layer?.crisis_mode === true;
  const contradictions =
    input.response.contradiction_detection_layer?.open_contradictions.length ?? 0;
  const eventCount = events.length;
  const isFirst =
    input.response.is_first_situation === true || eventCount <= 1;
  const clarificationQuestions = input.response.what_needs_clarification.length;
  const insufficient =
    eventCount < 3 &&
    (input.response.what_is_uncertain.length >= 2 || clarificationQuestions >= 1);
  const has_meaningful_change =
    input.response.care_context_diff_layer?.has_meaningful_change === true ||
    (input.response.what_changed?.length ?? 0) > 0 ||
    (input.response.events_created?.length ?? 0) > 0;

  const priority_resolution_layer = processPriorityResolution({
    crisis_detected: crisis,
    no_care_context: eventCount === 0,
    is_first_interaction: isFirst && !input.is_session_reentry,
    is_session_reentry: input.is_session_reentry === true,
    is_return_session: input.is_return_session === true,
    has_care_context: eventCount > 0,
    clarification_required: clarificationQuestions > 0 && insufficient,
    insufficient_data_for_inference: insufficient,
    has_meaningful_change,
  });

  const edge_state_layer = processEdgeState({
    crisis_detected: crisis,
    unresolved_contradictions: contradictions,
    event_count: eventCount,
    days_since_last_event: daysSinceLastEvent(events, asOf),
    continuity_decay_pct: input.response.continuity_decay_layer?.continuity_confidence_pct ?? null,
    missing_critical_fields: input.response.what_is_uncertain.length,
    low_confidence_aggregate:
      (input.response.trust_layer_engine_layer?.trust_layer.confidence ?? 1) < 0.45,
  });

  const event_sourced_storage_layer = processEventSourcedStorage({
    care_recipient_id: context.care_recipient_id,
    caregiver_id: input.caregiver_id,
    events: events.map((e) => ({
      id: e.id,
      raw_input: e.raw_input,
      extracted_type: e.extracted_type,
      ingestion_time: e.ingestion_time,
      entities: e.entities,
      uncertainty: e.uncertainty,
    })),
    as_of: asOf,
  });

  const confidence_calibration_layer = processConfidenceCalibration({
    events: events.map((e) => {
      const age = Math.max(0, new Date(asOf).getTime() - new Date(e.ingestion_time).getTime());
      return {
        event_id: e.id,
        source_type: mapSourceType(e),
        is_observation: !/infer|possible|suspect|might/i.test(e.raw_input),
        age_ms: age,
        high_risk_context: crisis || /fall|emergency|911/i.test(e.raw_input),
        contradicted: (input.response.contradiction_detection_layer?.open_contradictions ?? []).some(
          (c) => c.event_ids?.includes(e.id) ?? false,
        ),
        confirmation_count: /\b(still|same|confirmed|no change|unchanged)\b/i.test(e.raw_input)
          ? 1
          : 0,
        missing_critical_fields: e.uncertainty.length,
      };
    }),
    as_of: asOf,
  });

  const engine_execution_contract_layer = processEngineExecutionContract({
    attempted_mutations: [],
    traces: (input.response.events_created ?? []).map((e) => ({
      source_engine: "care_event_engine",
      input_reference_ids: [e.id],
      confidence:
        confidence_calibration_layer.event_confidences.find((c) => c.event_id === e.id)?.confidence
          .score ?? null,
      timestamp: e.ingestion_time,
      output_kind: "event" as const,
    })),
  });

  return {
    priority_resolution_layer,
    edge_state_layer,
    event_sourced_storage_layer,
    engine_execution_contract_layer,
    confidence_calibration_layer,
  };
}
