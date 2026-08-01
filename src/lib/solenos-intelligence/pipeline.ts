/**
 * SolenOS Intelligence Layer — canonical intelligence pipeline.
 *
 * This is the explicit boundary between raw caregiver input and
 * structured care understanding. Every AI response must pass through
 * the stages defined by the SolenOS Intelligence Specification.
 *
 * Stages:
 * 0. Intent Interpretation — classify input by purpose, not format
 * 1. Memory Retrieval — reconnect to prior care reality
 * 2. Data Acquisition — normalize and validate input
 * 3. Understanding — extract events, observations, decisions, outcomes, unknowns
 * 4. Memory Strategy — decide what to remember, update continuity hooks
 * 5. Reasoning — apply the 13 reasoning questions
 * 6. Active Situation Update — update ACS and CRS
 * 7. Communication — project understanding into caregiver-facing response
 */

import type {
  CanonicalCareEvent,
  CareContextRoot,
  ProcessSituationInput,
  SituationResponse,
} from "../situation-entry";
import { recordCareEvent } from "../care-events/record-care-event";
import { intakeRawInput } from "../data-acquisition-resilience";
import { validatedToCanonical } from "../data-acquisition-resilience";
import type { DareIngestResult } from "../data-acquisition-resilience/types";
import { ingestActiveCareObservation } from "../active-care-situation";
import { updateCareRealityState } from "../care-reality-state/process";
import { buildCareSituationUnderstandingFromExtraction } from "../care-situation-understanding";
import { prioritizeFromUnderstanding } from "../care-situation-understanding/prioritize-from-understanding";
import { projectCareSituationToResponseContract } from "../caregiver-response-composer/project-to-response-contract";
import { buildGuidanceOrientationPillars, buildCareClarityPillars } from "../progressive-understanding/clarity-pillars";
import { processProgressiveUnderstanding } from "../progressive-understanding";
import { classifySituationRelation } from "../active-care-situation/classify";
import { buildDisclosurePlan } from "../care-reality-state/disclosure";
import { evaluateSituationRelationship } from "../situation-relationship-engine";
import { composeCaregiverResponse } from "../caregiver-response-composer";
import { assertResponseAcceptanceGate } from "../response-acceptance-gate";
import { applyRealCaregiverTestComposeGate } from "../real-caregiver-test";
import { ensureContributorCareReality } from "../multi-caregiver-context-model";
import { getOrCreateCareContextRoot, appendEventsToContext } from "../situation-entry/context-store";
import type {
  ActiveCareSituation,
  ActiveSituationTurn,
  CareRealityState,
  ContinuityDecision,
} from "../situation-entry";
import type { CareSituationUnderstanding } from "../care-situation-understanding";
import { retrieveMemory } from "./memory";
import { applyReasoning } from "./reasoning";
import { applyMemoryStrategy } from "./memory-strategy";
import { interpretIntent } from "../intent-interpretation";
import type {
  UnderstandingStage,
} from "../active-care-situation/types";
import type {
  CareRealityDisclosureStage,
} from "../care-reality-state/types";
import type {
  IntelligenceResult,
  IntelligenceOptions,
  SolenOSInput,
  SolenOSMemory,
} from "./types";

function mapUnderstandingStageToDisclosure(
  stage: UnderstandingStage,
): CareRealityDisclosureStage {
  switch (stage) {
    case "gathering":
      return "early";
    case "forming":
      return "growing";
    case "synthesizing":
      return "established";
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function resolveCareRecipientId(input: SolenOSInput, memory: SolenOSMemory): string {
  return input.careRecipientId ??
    memory.careRealityState?.care_recipient_id ??
    memory.activeSituation?.care_recipient_id ??
    input.caregiverId;
}

function buildActiveSituationStub(
  input: SolenOSInput,
  careRecipientId: string,
): ActiveCareSituation {
  return {
    id: `acs_${careRecipientId}`,
    caregiver_id: input.caregiverId,
    care_recipient_id: careRecipientId,
    opened_at: nowIso(),
    updated_at: nowIso(),
    root_event_id: null,
    subject_label: "",
    theme: "mixed",
    observations: [],
    open_questions: [],
    asked_questions: [],
    understanding_stage: "gathering",
    connection_note: null,
    synthesis: null,
    what_matters_now: null,
    interaction_paused_at: null,
    lifecycle_status: "active",
    familiarity_baseline: [],
    pattern_label: null,
  };
}

async function runDataAcquisition(params: {
  input: SolenOSInput;
  rootEventId: string | null;
}): Promise<{ events: CanonicalCareEvent[]; dare: DareIngestResult | null; documentEventsCount: number }> {
  const { input, rootEventId } = params;
  const events: CanonicalCareEvent[] = [];
  const dareResults: DareIngestResult[] = [];
  let documentEventsCount = 0;

  if (input.raw.trim()) {
    const dare = intakeRawInput({
      caregiver_id: input.caregiverId,
      content: input.raw,
      input_type: input.source as import("../data-acquisition-resilience/types").RawInputType,
      captured_at: input.timestamp,
    });
    dareResults.push(dare);
  }

  for (const doc of input.documents ?? []) {
    if (!doc.extracted_text?.trim()) continue;
    dareResults.push(
      intakeRawInput({
        caregiver_id: input.caregiverId,
        content: doc.extracted_text,
        input_type: "pdf",
        document_id: doc.id,
        document_name: doc.name,
        ocr_confidence: doc.ocr_confidence ?? null,
        captured_at: input.timestamp,
      }),
    );
    documentEventsCount += 1;
  }

  const dare = dareResults.length > 0 ? mergeDareResults(dareResults) : null;

  if (dare) {
    for (const ve of dare.validated_events) {
      const canonical = validatedToCanonical(ve);
      canonical.root_event_id = rootEventId;
      canonical.situation_id = null;
      events.push(canonical);
    }
  }

  return { events, dare, documentEventsCount };
}

function mergeDareResults(results: DareIngestResult[]): DareIngestResult {
  if (results.length === 0) throw new Error("No DARE ingest results");
  const first = results[0]!;
  return {
    raw_input: first.raw_input,
    candidates: results.flatMap((r) => r.candidates),
    uncertain_events: results.flatMap((r) => r.uncertain_events),
    unreadable_sections: results.flatMap((r) => r.unreadable_sections),
    disambiguation_questions: results.flatMap((r) => r.disambiguation_questions),
    conflicts: results.flatMap((r) => r.conflicts),
    validated_events: results.flatMap((r) => r.validated_events),
    provisional_count: results.reduce((n, r) => n + r.provisional_count, 0),
    normalization: results[results.length - 1]?.normalization ?? null,
  };
}

function persistEvents(events: CanonicalCareEvent[], caregiverId: string): void {
  for (const event of events) {
    void recordCareEvent({
      content: event.raw_input,
      created_by: caregiverId,
      provenance: {
        input_type: event.source === "document" ? "document" : "text",
        captured_at: event.ingestion_time,
      },
      metadata: {
        canonical_care_event: event,
        dare_validated: true,
        extracted_type: event.extracted_type,
        entities: event.entities,
        attributes: event.attributes,
        uncertainty: event.uncertainty,
        source: event.source,
        root_event_id: event.root_event_id,
        document_id: event.document_id,
      },
    });
  }
}

/**
 * Run the explicit SolenOS intelligence pipeline.
 *
 * This is the canonical entry point for all caregiver input.
 * It replaces the implicit procedural chain with explicit stages.
 */
export async function runIntelligencePipeline(
  rawInput: ProcessSituationInput,
  options: IntelligenceOptions = {},
): Promise<IntelligenceResult> {
  const startTime = Date.now();
  const stages: IntelligenceResult["stages"] = [];

  // Stage 0: Normalize input
  const input: SolenOSInput = {
    raw: rawInput.raw_input ?? "",
    source: rawInput.source ?? "user_input",
    caregiverId: rawInput.caregiver_id ?? rawInput.contributor_id ?? "default",
    careRecipientId: rawInput.care_recipient_id,
    contributorId: rawInput.contributor_id,
    documents: rawInput.documents,
    timestamp: rawInput.timestamp ?? nowIso(),
  };

  // Stage 1: Memory Retrieval
  const memory = retrieveMemory(input);
  stages.push({
    name: "memory_retrieval",
    durationMs: Date.now() - startTime,
  });

  // Stage 0: Intent Interpretation
  const inputIntent = interpretIntent({
    rawText: input.raw,
    hasDocuments: (input.documents?.length ?? 0) > 0,
    priorUnderstandingCount: memory.activeSituation?.observations.length ?? 0,
  });
  stages.push({
    name: "intent_interpretation",
    durationMs: Date.now() - startTime,
  });

  // Ensure care reality scope (Locked B)
  const careRecipientId = resolveCareRecipientId(input, memory);
  ensureContributorCareReality(input.caregiverId, careRecipientId);

  // Initialize durable context
  const contextRoot = getOrCreateCareContextRoot(input.caregiverId);

  // Stage 2: Data Acquisition
  const { events, documentEventsCount } = await runDataAcquisition({
    input,
    rootEventId: contextRoot.root_event_id,
  });
  stages.push({
    name: "data_acquisition",
    durationMs: Date.now() - startTime,
  });

  // Stage 3: Memory Strategy
  const understanding = buildCareSituationUnderstandingFromExtraction({
    rawText: input.raw,
    contributorId: input.contributorId,
    careKey: input.caregiverId,
    personDisplayName: null,
    situation: memory.activeSituation ?? undefined,
    priorContinuityHooks: memory.careRealityState?.continuity_hooks,
    priorUnknowns: memory.careRealityState?.open_uncertainties,
    continuityDecision: memory.continuityDecision ?? undefined,
  });

  const memoryStrategy = applyMemoryStrategy({
    input: input.raw,
    understanding,
    memory,
  });

  if (memoryStrategy.willRemember && options.applyMemoryStrategy !== false) {
    persistEvents(events, input.caregiverId);
  }

  stages.push({
    name: "memory_strategy",
    durationMs: Date.now() - startTime,
  });

  // Stage 4: Understanding is complete from buildCareSituationUnderstandingFromExtraction
  const understandingResult = {
    understanding,
    appliedContinuity: memory.continuityDecision !== null,
  };

  // Stage 5: Reasoning
  const reasoningResult = applyReasoning({
    input,
    memory,
    understanding,
  });
  stages.push({
    name: "reasoning",
    durationMs: Date.now() - startTime,
  });

  // Stage 6: Active Situation Update
  let activeSituation = memory.activeSituation ?? buildActiveSituationStub(input, careRecipientId);
  const relation = classifySituationRelation({
    active: memory.activeSituation,
    rawText: input.raw,
    kind: "general",
    nowIso: nowIso(),
  });

  for (const event of events) {
    ingestActiveCareObservation({
      caregiverId: input.caregiverId,
      rawText: event.raw_input,
      kind: event.extracted_type as any,
      eventIds: [event.id],
      nowIso: event.ingestion_time,
      contributorId: input.contributorId,
    });
  }

  const situationDecision = memory.continuityDecision
    ? evaluateSituationRelationship({
        active: activeSituation,
        rawText: input.raw,
        kind: "general",
        nowIso: nowIso(),
      })
    : null;

  const prioritized = prioritizeFromUnderstanding(understanding, [
    ...(memory.careRealityState?.continuity_hooks ?? []),
  ], [
    ...(memory.careRealityState?.open_uncertainties ?? []),
  ]);

  const careRealityState = updateCareRealityState({
    caregiverId: input.caregiverId,
    turn: {
      relation,
      situation: activeSituation,
      confirmation_title: "",
      confirmation_body: "",
      understanding_heading: "",
      understanding_stage: activeSituation.understanding_stage,
      current_understanding: understanding.facts.map((f) => f.text),
      insufficiency_note: null,
      connection_note: null,
      what_needs_context: understanding.unknowns,
      what_will_be_remembered: prioritized.continuity_hooks,
      what_seems_happening: understanding.matters_now[0] ?? null,
      what_matters_now: prioritized.matters_now[0] ?? null,
      show_attention_sections: true,
      what_changed_in_understanding: understanding.changes_from_baseline[0] ?? null,
      understanding_effect: "changes_what_matters",
      resolved_uncertainties: [],
      pattern_label: null,
      what_can_wait: prioritized.can_wait[0] ?? null,
      what_may_become_serious: null,
      care_reality_state_id: memory.careRealityState?.id ?? null,
      crs_observation_count: memory.careRealityState?.observation_count ?? 0,
      crs_revision: memory.careRealityState?.revision ?? 0,
      disclosure_stage: buildDisclosurePlan(mapUnderstandingStageToDisclosure(activeSituation.understanding_stage)).stage,
      disclosure_plan: buildDisclosurePlan(mapUnderstandingStageToDisclosure(activeSituation.understanding_stage)),
      response_evolution: {
        updates_active_situation: relation === "updates_active",
        answers_previous_uncertainty: relation === "answers_uncertainty",
        strengthens_existing_hypothesis: false,
        introduces_new_pattern: relation === "opens_new",
        changes_what_matters_now: prioritized.matters_now.length > 0,
        invalidates_previous_understanding: false,
      },
      primary_screen_question: understanding.follow_up_questions[0] ?? "",
      identity_mismatch: false,
      memory_correction_applied: false,
      continuity_decision: memory.continuityDecision ?? undefined,
      continuity_hooks: prioritized.continuity_hooks,
    },
    situation: activeSituation,
    relation,
  });

  const isFirstSituation = contextRoot.events.length === 0;

  const situationResponse: SituationResponse = {
    what_i_understood: understanding.facts.map((f) => ({
      label: f.text,
      extracted_type: f.kind === "event" ? "incident" :
        f.kind === "observation" ? "observation" :
        f.kind === "decision" ? "decision" :
        f.kind === "outcome" ? "follow_up" : "unknown",
      event_id: events[0]?.id ?? "",
    })),
    what_is_uncertain: understanding.unknowns,
    what_needs_clarification: [],
    what_will_be_tracked: [],
    what_changed: understanding.changes_from_baseline,
    what_merged_or_split: [],
    events_created: events,
    context: contextRoot,
    is_first_situation: isFirstSituation,
    document_events_count: documentEventsCount,
    dare: null,
    timeline_views: null,
    integrity_summary: null,
    priority_layer: null,
    memory_layer: null,
    failure_resilience_layer: null,
    trust_provenance_layer: null,
    network_effect_moat_layer: null,
    success_model_layer: null,
    final_output: null as any,
    mvp_surface_area_layer: null as any,
    continuous_execution_loop_layer: null as any,
    behavior_interpretation_layer: null as any,
    continuity_decay_layer: null as any,
    north_star_experience_layer: null as any,
    clarification_engine_layer: undefined,
    memory_strategy_layer: undefined,
    trust_layer_engine_layer: undefined,
    crisis_mode_interaction_layer: undefined,
    multi_caregiver_context_layer: undefined,
    audit_trail_layer: undefined,
    state_of_care_summary_layer: undefined,
    care_context_diff_layer: undefined,
    entry_behavior_layer: undefined,
    care_timeline_engine_layer: undefined,
    task_extraction_layer: undefined,
    current_state_view_layer: undefined,
    adoption_wedge_layer: undefined,
    product_reality_model_layer: undefined,
    forbidden_build_zone_layer: undefined,
    policy_engine_layer: undefined,
    timeline_reconstruction_layer: undefined,
    contradiction_detection_layer: undefined,
    care_transparency_layer: undefined,
    baseline_intelligence_layer: undefined,
    care_reality_profile_layer: undefined,
    moment_of_need_layer: undefined,
    retention_engine_layer: undefined,
    priority_resolution_layer: undefined,
    edge_state_layer: undefined,
    event_sourced_storage_layer: undefined,
    engine_execution_contract_layer: undefined,
    confidence_calibration_layer: undefined,
    care_state_engine_layer: undefined,
    single_user_journey_layer: undefined,
    product_north_star_layer: undefined,
    product_constitution_layer: undefined,
    continuity_properties_layer: undefined,
    care_reality_intelligence_layer: undefined,
    care_reality_engine_layer: undefined,
    care_signal_understanding_layer: undefined,
    generalized_care_understanding_layer: undefined,
    care_identity_summary: undefined,
    continuity_decision: memory.continuityDecision ?? undefined,
    composed_response: undefined,
    care_key: input.caregiverId,
    resolution_engine_layer: undefined,
    active_situations: undefined,
    ui_situations: undefined,
    active_care_situation: activeSituation,
    active_care_situation_turn: {
      relation,
      situation: activeSituation,
      confirmation_title: "",
      confirmation_body: "",
      understanding_heading: "",
      understanding_stage: activeSituation.understanding_stage,
      current_understanding: understanding.facts.map((f) => f.text),
      insufficiency_note: null,
      connection_note: null,
      what_needs_context: understanding.unknowns,
      what_will_be_remembered: prioritized.continuity_hooks,
      what_seems_happening: understanding.matters_now[0] ?? null,
      what_matters_now: prioritized.matters_now[0] ?? null,
      show_attention_sections: true,
      what_changed_in_understanding: understanding.changes_from_baseline[0] ?? null,
      understanding_effect: "changes_what_matters",
      resolved_uncertainties: [],
      pattern_label: activeSituation.pattern_label ?? null,
      what_can_wait: prioritized.can_wait[0] ?? null,
      what_may_become_serious: null,
      care_reality_state_id: careRealityState?.id ?? null,
      crs_observation_count: careRealityState?.observation_count ?? 0,
      crs_revision: careRealityState?.revision ?? 0,
      identity_mismatch: false,
      continuity_hooks: prioritized.continuity_hooks,
      identity_mismatch_input: null,
      memory_correction_applied: false,
      continuity_decision: memory.continuityDecision ?? undefined,
      disclosure_stage: buildDisclosurePlan(mapUnderstandingStageToDisclosure(activeSituation.understanding_stage)).stage,
      disclosure_plan: buildDisclosurePlan(mapUnderstandingStageToDisclosure(activeSituation.understanding_stage)),
      response_evolution: {
        updates_active_situation: relation === "updates_active",
        answers_previous_uncertainty: relation === "answers_uncertainty",
        strengthens_existing_hypothesis: false,
        introduces_new_pattern: relation === "opens_new",
        changes_what_matters_now: prioritized.matters_now.length > 0,
        invalidates_previous_understanding: false,
      },
      primary_screen_question: understanding.follow_up_questions[0] ?? "",
    } satisfies ActiveSituationTurn,
    care_situation_groups: [],
  };

  // Stage 7: Communication — compose caregiver response
  let composedResponse: import("../caregiver-response-composer").ComposedCaregiverResponse | null = null;
  if (options.composeResponse !== false) {
    try {
      composedResponse = composeCaregiverResponse({
        turn: situationResponse.active_care_situation_turn!,
        latestRawText: input.raw,
        kind: "general",
        hasDocuments: documentEventsCount > 0,
        baselineChangeNote: null,
      });
    } catch {
      composedResponse = null;
    }
  }

  stages.push({
    name: "communication",
    durationMs: Date.now() - startTime,
  });

  return {
    input,
    memory,
    understanding: understandingResult,
    reasoning: reasoningResult,
    memoryStrategy: memoryStrategy,
    situationResponse,
    activeSituation,
    activeTurn: situationResponse.active_care_situation_turn!,
    careRealityState,
    composedResponse,
    stages,
  };
}

export function buildMinimalFinalOutput(params: {
  understanding: import("../care-situation-understanding").CareSituationUnderstanding;
  composedResponse: import("../caregiver-response-composer").ComposedCaregiverResponse | null;
  continuityDecision: import("../care-identity").ContinuityDecision | null;
  careRealityState: import("../care-reality-state/types").CareRealityState | null;
  events: CanonicalCareEvent[];
}): import("../final-output-contract/types").FinalOutputContract {
  const { understanding, composedResponse, continuityDecision, careRealityState, events } = params;

  const whatIsHappening =
    composedResponse?.situation_summary ??
    understanding.matters_now[0] ??
    understanding.facts[0]?.text ??
    "Care reality is being established.";

  const whatMattersNow =
    composedResponse?.what_matters_now ??
    understanding.matters_now[0] ??
    "Continuing to gather context.";

  const whatToAskNext =
    composedResponse?.still_unclear?.[0] ??
    understanding.follow_up_questions[0] ??
    "What is the main concern right now?";

  const whatCanWait =
    composedResponse?.what_can_wait ??
    understanding.can_wait[0] ??
    "Other details can wait until the main concern is clearer.";

  const riskLevel = events.some((e) => e.extracted_type === "incident")
    ? "high"
    : events.some((e) => e.extracted_type === "behavioral_change")
      ? "medium"
      : "low";

  const eventIds = events.slice(0, 5).map((e) => e.id);
  const evidenceSources = understanding.facts
    .filter((f) => f.source_fragment)
    .map((f) => f.source_fragment!.slice(0, 80));

  return {
    what_is_happening: whatIsHappening.slice(0, 500),
    what_matters_now: whatMattersNow.slice(0, 500),
    what_to_ask_next: whatToAskNext.slice(0, 500),
    risk_level: riskLevel,
    what_can_wait: whatCanWait.slice(0, 500),
    follow_up_items: (composedResponse?.follow_up_items ?? []).slice(0, 5),
    decision_trace: {
      events: eventIds,
      assumptions: [],
      unknowns: understanding.unknowns.slice(0, 5),
      evidence_sources: evidenceSources,
    },
    confidence_state: {
      overall_confidence: understanding.confidence === "high" ? "high" : understanding.confidence === "medium" ? "medium" : "low",
      completeness: Math.min(100, Math.round((understanding.facts.length / 4) * 100)),
      reasoning_limits: ["Initial capture — understanding will deepen with more context."],
    },
    trust_layer: {
      known: understanding.facts.slice(0, 5).map((f) => ({
        statement: f.text.slice(0, 200),
        source: "caregiver_input",
        source_type: "caregiver_input",
      })),
      assumed: [],
      unknown: understanding.unknowns.slice(0, 5).map((u) => ({
        statement: u,
        drives_clarification: true,
      })),
      recency: {
        last_updated_at: new Date().toISOString(),
        freshness_score: 1,
        interpretation: "Current capture",
      },
      confidence: understanding.confidence === "high" ? 0.8 : understanding.confidence === "medium" ? 0.5 : 0.3,
    },
    transparency_panel: {
      data_used: {
        care_events: eventIds,
        timeline_segments: [],
        caregiver_inputs: [events[0]?.raw_input?.slice(0, 100) ?? ""],
      },
      data_ignored: {
        conflicting: [],
        low_confidence: [],
        stale_or_decayed: [],
      },
      reason_for_output: "Structured understanding from caregiver input via SolenOS Intelligence Pipeline.",
      evidence_breakdown: understanding.facts.slice(0, 3).map((f) => ({
        conclusion: f.text.slice(0, 100),
        evidence_type: "observation",
        confidence_pct: understanding.confidence === "high" ? 80 : understanding.confidence === "medium" ? 50 : 30,
      })),
      confidence_scores: {
        overall_pct: understanding.confidence === "high" ? 80 : understanding.confidence === "medium" ? 50 : 30,
        tier: understanding.confidence,
      },
      recency: {
        last_update_at: new Date().toISOString(),
        critical_event_ages: [],
        decay_status: "fresh",
      },
      observed: understanding.facts.filter((f) => f.kind === "observation").map((f) => f.text),
      inferred: [],
    },
  };
}
