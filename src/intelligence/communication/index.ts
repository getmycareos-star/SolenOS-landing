/**
 * CommunicationStage — Stage 4 of the SolenOS Intelligence Pipeline.
 *
 * Composes the caregiver-facing response from the reasoning snapshot,
 * understanding model, and active care situation. This is the final stage
 * before output is delivered to the caregiver.
 *
 * Contract:
 * - Response is projected from structured reasoning, not raw input.
 * - Emotional load stays contextual, never primary situation.
 * - Internal engine concepts never exposed.
 * - Professional does not mean robotic: natural human language.
 *
 * Input:  CommunicationInput (reasoning + understanding + context + active state)
 * Output: CommunicationResult (final output + composed response)
 */

import type { ComposedCaregiverResponse } from "../../lib/caregiver-response-composer";
import type { CommunicationInput, CommunicationResult } from "../types";
import { projectCareSituationToResponseContract } from "../../lib/caregiver-response-composer/project-to-response-contract";
import { buildGreetingOrientation, isCasualGreetingInput } from "../../lib/greeting-orientation";
import type { CareSituationUnderstanding } from "../../lib/care-situation-understanding/types";
import type { FinalOutputContract, DecisionTrace, TrustLayerOutput } from "../../lib/final-output-contract/types";
import type { CareTransparencyPanel } from "../../lib/care-transparency-layer/types";
import { buildMemorySummary } from "../../lib/greeting-orientation/orientation";
import { getCareRealityState } from "../../lib/care-reality-state";
import { listCareRealityMemory } from "../../lib/care-reality-intelligence/care-reality-memory";
import { processMvpSurfaceArea } from "../../lib/mvp-surface-area";
import { applyPolicyToFinalOutput, validateOutputPolicy, buildPolicyEngineLayer } from "../../lib/policy-engine";
import { processCareTransparency, attachTransparencyToFinalOutput } from "../../lib/care-transparency-layer";
import { processProductNorthStar } from "../../lib/product-north-star";
import { processProductConstitution } from "../../lib/product-constitution";
import { processAdoptionWedge } from "../../lib/adoption-wedge-engine";
import type { CareIdentitySummary } from "../../lib/care-identity";

// Helper: build default trust layers from understanding and unknowns
function buildDefaultTrustLayer(
  understanding: CareSituationUnderstanding,
  mergedUncertain: string[],
): TrustLayerOutput {
  return {
    known: understanding.facts.map((f) => ({
      statement: f.text,
      source: "caregiver_input",
      source_type: "caregiver_input" as const,
      source_event_id: undefined,
    })),
    assumed: [],
    unknown: mergedUncertain.map((statement) => ({
      statement,
      drives_clarification: true,
    })),
    recency: {
      last_updated_at: null,
      freshness_score: 50,
      interpretation: "Current session",
    },
    confidence: understanding.confidence === "high" ? 80 : understanding.confidence === "medium" ? 60 : 40,
  };
}

// Helper: build a default transparency panel
function buildDefaultTransparencyPanel(
  understanding: CareSituationUnderstanding,
  events_created: Array<{ id: string }>,
  mergedUncertain: string[],
  raw_input: string,
  timestamp?: string,
): CareTransparencyPanel {
  return {
    data_used: {
      care_events: events_created.map((e) => e.id),
      timeline_segments: [],
      caregiver_inputs: [raw_input],
    },
    data_ignored: {
      conflicting: [],
      low_confidence: mergedUncertain,
      stale_or_decayed: [],
    },
    reason_for_output: "Projection of structured care understanding from caregiver input.",
    evidence_breakdown: understanding.facts.map((f) => ({
      conclusion: f.text,
      evidence_type: "observation" as const,
      confidence_pct: understanding.confidence === "high" ? 80 : understanding.confidence === "medium" ? 60 : 40,
    })),
    confidence_scores: {
      overall_pct: understanding.facts.length > 0 ? 65 : 30,
      tier: understanding.confidence === "high" ? "high" as const : understanding.confidence === "medium" ? "medium" as const : "low" as const,
    },
    recency: {
      last_update_at: timestamp ?? new Date().toISOString(),
      critical_event_ages: [],
      decay_status: "fresh" as const,
    },
    observed: understanding.facts.filter((f) => f.kind === "event" || f.kind === "observation").map((f) => f.text),
    inferred: understanding.facts.filter((f) => f.kind === "decision" || f.kind === "outcome").map((f) => f.text),
  };
}

/**
 * Compose caregiver-facing communication from reasoned understanding.
 *
 * Produces a FinalOutputContract that serves as the authoritative output
 * for the caregiver, projection of the care situation understanding through
 * the response contract, and orientation/greeting when appropriate.
 */
export async function communicateFromReasoning(
  input: CommunicationInput,
): Promise<CommunicationResult> {
  const {
    reasoning,
    understanding,
    caregiverId,
    careRecipientId,
    context,
    events_created,
    whatChanged,
    mergedUncertain,
    mergedClarification,
    raw_input,
    continuityDecision,
    activeSituation,
    careRealityState,
    timestamp,
  } = input;

  // 1. Project understanding → response contract
  const responseContract = projectCareSituationToResponseContract(understanding);

  // 2. Build orientation for greeting inputs (hi, hello, how are you)
  const isGreeting = isCasualGreetingInput(raw_input);
  let orientationLine: string | null = null;

  if (isGreeting || raw_input.trim().length === 0) {
    const crs = careRealityState ?? getCareRealityState(careRecipientId);
    const memory = listCareRealityMemory(careRecipientId);
    const memorySummary = buildMemorySummary({
      crs,
      memory,
      careKey: caregiverId,
    });

    // Build identity from continuity decision or fallback
    const identity: CareIdentitySummary = {
      care_recipient_id: careRecipientId,
      display_name: continuityDecision?.identity?.display_name ?? null,
      relationship: continuityDecision?.identity?.relationship ?? null,
      lifecycle: continuityDecision?.identity?.lifecycle ?? "potential",
      has_active_care: (continuityDecision?.context.prior_events_exist) ?? false,
      last_active_at: timestamp ?? "",
    };

    const greetingContext = {
      is_first_session: !continuityDecision?.context.prior_events_exist,
      continuity: continuityDecision!,
      identity,
      crs,
      memory: memorySummary,
      raw_input,
      is_casual_greeting: isGreeting,
      is_how_are_you: false,
      is_gratitude: false,
      is_change_oriented: false,
    };

    const orientation = buildGreetingOrientation(greetingContext);
    orientationLine = orientation.orientation_line;
  }

  // 3. Build final output contract from reasoning + understanding
  const decisionTrace: DecisionTrace = {
    events: events_created.map((e) => e.id),
    assumptions: [],
    unknowns: mergedUncertain,
    evidence_sources: ["caregiver_input"],
  };

  const trustLayer = buildDefaultTrustLayer(understanding, mergedUncertain);
  const transparencyPanel = buildDefaultTransparencyPanel(understanding, events_created, mergedUncertain, raw_input, timestamp);

  const final_output: FinalOutputContract = {
    what_is_happening: responseContract.what_is_happening,
    what_matters_now: responseContract.what_matters_now,
    what_to_ask_next: Array.isArray(responseContract.what_to_ask_next)
      ? responseContract.what_to_ask_next[0] ?? ""
      : responseContract.what_to_ask_next,
    what_can_wait: responseContract.what_can_wait,
    risk_level: responseContract.risk_level === "high" ? "high" : responseContract.risk_level === "medium" ? "medium" : "low",
    follow_up_items: responseContract.follow_up_items,
    decision_trace: decisionTrace,
    confidence_state: {
      overall_confidence: understanding.confidence === "high" ? "high" : understanding.confidence === "medium" ? "medium" : "low",
      completeness: understanding.facts.length > 0 ? 60 : 20,
      reasoning_limits: understanding.facts.length === 0 ? ["Insufficient evidence to form a complete picture"] : [],
    },
    trust_layer: trustLayer,
    transparency_panel: transparencyPanel,
  };

  // 4. Build MVP surface area
  const mvp_surface_area_layer = processMvpSurfaceArea({
    caregiver_id: caregiverId,
    response: { final_output, context, events_created } as any,
    is_return_session: !(continuityDecision?.should_orient_new_user ?? true),
  });

  // 5. Build adoption wedge for new users
  const adoption_wedge_layer = processAdoptionWedge({
    caregiver_id: caregiverId,
    is_first_situation: !continuityDecision?.context.prior_events_exist,
    events_created_count: events_created.length,
    entry_mode: continuityDecision?.should_orient_new_user ? ("initialization" as const) : undefined,
  });

  // 6. Process product north star
  const product_north_star_layer = processProductNorthStar({
    raw_input,
    final_what_is_happening: final_output.what_is_happening,
    final_what_matters_now: final_output.what_matters_now,
    final_what_can_wait: final_output.what_can_wait,
    what_changed: whatChanged,
    has_care_events: context.events.length > 0,
    has_meaningful_diff: whatChanged.length > 0,
    has_state_of_care: context.events.length > 0,
  });

  // 7. Process product constitution
  const product_constitution_layer = processProductConstitution({
    care_recipient_id: careRecipientId,
    all_events: context.events,
    events_created,
    what_is_uncertain: mergedUncertain,
    what_needs_clarification: mergedClarification,
    care_state: { care_recipient_id: careRecipientId, needs_attention: [], what_is_stable: [] } as any,
    care_context_diff: { diff: [], has_meaningful_change: false } as any,
    state_of_care: { active: true, summary: { what_matters_most: "" } } as any,
    subject_label: activeSituation?.subject_label ?? null,
    final_what_matters_now: final_output.what_matters_now,
    final_what_can_wait: final_output.what_can_wait,
    what_changed: whatChanged,
    as_of: timestamp ?? new Date().toISOString(),
  });

  // 8. Enforce compiled dominant output (arbitration)
  const policyEngineLayer = buildPolicyEngineLayer(caregiverId);
  const policyApplied = applyPolicyToFinalOutput(caregiverId, final_output, {
    medical_advice_request: false,
    consent_required: false,
    soft_consent_prompt: null,
  });

  const care_transparency_layer = processCareTransparency({
    response: { final_output: policyApplied, context, events_created } as any,
    final_output_draft: policyApplied,
  });
  const outputWithTransparency = attachTransparencyToFinalOutput(
    policyApplied,
    care_transparency_layer.panel,
  );

  const outputPolicy = validateOutputPolicy({
    user_id: caregiverId,
    surfaces: {
      what_is_happening: outputWithTransparency.what_is_happening,
      what_matters_now: outputWithTransparency.what_matters_now,
      what_to_ask_next: typeof outputWithTransparency.what_to_ask_next === "string"
        ? outputWithTransparency.what_to_ask_next
        : outputWithTransparency.what_to_ask_next[0] ?? "",
    },
  });

  // 9. Build composed response
  const composedResponse: ComposedCaregiverResponse = {
    recognition_line: events_created.length > 0 ? `Noted ${events_created.length} observation${events_created.length > 1 ? "s" : ""}.` : null,
    confirmation: "I understand this is about your care situation.",
    what_matters_now: outputWithTransparency.what_matters_now || null,
    what_can_wait: outputWithTransparency.what_can_wait || null,
    what_may_become_serious: null,
    what_changed: whatChanged.length > 0 ? whatChanged.join(", ") : null,
    connection_note: null,
    show_connection: false,
    what_we_know: understanding.facts.map((f) => f.text),
    situation_summary: outputWithTransparency.what_is_happening,
    still_unclear: mergedUncertain,
    care_story_update: null,
    is_improvement: false,
    show_clarity: understanding.can_orient,
    show_questions: mergedClarification.length > 0,
    why_asking: null,
evidence_line: null,
    evidence_maturity: (understanding.facts.length > 0 ? 3 : 1) as 1 | 2 | 3 | 5 | 10,
    follow_up_items: outputWithTransparency.follow_up_items,
    contract_output: {
      what_is_happening: outputWithTransparency.what_is_happening,
      what_matters_now: outputWithTransparency.what_matters_now,
      what_to_ask_next: typeof outputWithTransparency.what_to_ask_next === "string"
        ? outputWithTransparency.what_to_ask_next
        : outputWithTransparency.what_to_ask_next[0] ?? "",
      risk_level: outputWithTransparency.risk_level === "high" ? "high" : outputWithTransparency.risk_level === "medium" ? "medium" : "low",
      what_can_wait: outputWithTransparency.what_can_wait,
      follow_up_items: outputWithTransparency.follow_up_items,
    },
    mental_load_signal: (() => {
      const openGaps = mergedUncertain.length;
      if (openGaps >= 3) {
        return "Several things need attention at once — nothing has to be solved tonight.";
      }
      if (openGaps >= 2) {
        return "A few pieces are still missing — the most important one is enough for now.";
      }
      if (openGaps === 1) {
        return "One question is still open — it can wait until you have the answer.";
      }
      return null;
    })(),
  };

  return {
    final_output: outputWithTransparency,
    composedResponse,
  };
}
