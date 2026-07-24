import {
  CARE_REALITY_INTELLIGENCE_CATEGORY,
  CARE_REALITY_INTELLIGENCE_DEFINING_PRINCIPLE,
  CARE_REALITY_INTELLIGENCE_STATUS,
  CARE_TRANSITION_SIGNAL_TYPES,
  COMPARISON_ENGINE_QUESTION,
  TRUST_ENGINEERING_RULES,
} from "./contract-constants";
import type {
  CareLoopOutcome,
  CareRealityIntelligenceResult,
  CareTransitionSignal,
  CareTransitionSignalType,
  IntelligenceChainLink,
  ProcessCareRealityIntelligenceInput,
} from "./types";
import { listDecisionMemory } from "../decision-memory";

const TRANSITION_PATTERNS: Array<{ type: CareTransitionSignalType; re: RegExp }> = [
  { type: "hospital_discharge", re: /\b(discharge|discharged|sent home from hospital)\b/i },
  { type: "medication_change", re: /\b(med(?:ication)? (?:change|adjust|start|stop)|new prescription|dose)\b/i },
  { type: "new_diagnosis", re: /\b(diagnos(?:is|ed)|new condition|test results)\b/i },
  { type: "new_symptom", re: /\b(new symptom|started (?:having|showing)|first time)\b/i },
  { type: "caregiver_handoff", re: /\b(handoff|new caregiver|shift change|responsibility transfer)\b/i },
  { type: "emergency_recovery", re: /\b(er visit|emergency|ambulance|911|a&e)\b/i },
  { type: "home_care_transition", re: /\b(home care|home health|returned home|nursing at home)\b/i },
];

function detectTransitionSignals(
  events: ProcessCareRealityIntelligenceInput["all_events"],
  asOf: string,
): CareTransitionSignal[] {
  const signals: CareTransitionSignal[] = [];
  for (const event of events.slice(-8)) {
    for (const { type, re } of TRANSITION_PATTERNS) {
      if (!re.test(event.raw_input)) continue;
      signals.push({
        type,
        detected_at: asOf,
        source_event_ids: [event.id],
        summary: `${type.replace(/_/g, " ")} signal from recent input`,
        mode: "signal_only",
        uncertainties: ["Care Transition Mode brief — FUTURE capability"],
      });
      break;
    }
  }
  return signals.slice(-3);
}

function deriveOutcomesFromProfile(
  input: ProcessCareRealityIntelligenceInput,
  asOf: string,
): CareLoopOutcome[] {
  const profile = input.care_reality_profile?.profile;
  if (!profile) return [];

  const helped = profile.sections.what_helped ?? [];
  const notHelped = profile.sections.what_did_not_help ?? [];
  const outcomes: CareLoopOutcome[] = [];

  for (const entry of helped.slice(-4)) {
    outcomes.push({
      id: `outcome_helped_${entry.label.slice(0, 24)}_${entry.observed_at}`,
      decision_summary: entry.label,
      intervention: entry.label,
      outcome: "helped",
      evidence_event_ids: entry.source_event_ids,
      recorded_at: asOf,
      confidence: entry.confidence,
      source: "profile_inference",
    });
  }
  for (const entry of notHelped.slice(-4)) {
    outcomes.push({
      id: `outcome_not_${entry.label.slice(0, 24)}_${entry.observed_at}`,
      decision_summary: entry.label,
      intervention: entry.label,
      outcome: "did_not_help",
      evidence_event_ids: entry.source_event_ids,
      recorded_at: asOf,
      confidence: entry.confidence,
      source: "profile_inference",
    });
  }
  return outcomes;
}

function buildIntelligenceChain(
  input: ProcessCareRealityIntelligenceInput,
): IntelligenceChainLink[] {
  const eventIds = input.all_events.map((e) => e.id);
  const recentIds = input.events_created.map((e) => e.id);
  const chain: IntelligenceChainLink[] = [];

  if (input.all_events.length > 0) {
    chain.push({
      stage: "events",
      summary: `${input.all_events.length} CareEvent(s) ground this person's care reality.`,
      evidence_event_ids: eventIds.slice(-5),
      confidence: input.all_events.length >= 3 ? "high" : "medium",
    });
  }

  const changes = input.what_changed ?? input.care_state?.recent_changes ?? [];
  if (changes.length > 0) {
    chain.push({
      stage: "changes",
      summary: changes[0] ?? "Change detected from prior care state.",
      evidence_event_ids: recentIds.length > 0 ? recentIds : eventIds.slice(-2),
      confidence: "medium",
      uncertainty_note:
        changes.length > 1 ? `${changes.length - 1} additional change(s) tracked.` : undefined,
    });
  }

  const decisions = input.care_state?.decisions ?? [];
  if (decisions.length > 0) {
    chain.push({
      stage: "decisions",
      summary: decisions[decisions.length - 1] ?? "Decision recorded in care state.",
      evidence_event_ids: eventIds.slice(-3),
      confidence: "medium",
    });
  }

  const outcomes = deriveOutcomesFromProfile(input, input.as_of ?? new Date().toISOString());
  if (outcomes.length > 0) {
    chain.push({
      stage: "outcomes",
      summary: `${outcomes.length} response pattern(s) remembered from this person's history.`,
      evidence_event_ids: outcomes.flatMap((o) => o.evidence_event_ids).slice(0, 5),
      confidence: "medium",
    });
  }

  const baselineSummary =
    input.baseline?.deviations[0]?.compared_to_baseline ??
    input.care_reality_profile?.profile.person_specific_summary;
  if (baselineSummary) {
    chain.push({
      stage: "context",
      summary: baselineSummary,
      evidence_event_ids:
        input.baseline?.deviations[0]?.source_event_id
          ? [input.baseline.deviations[0].source_event_id]
          : eventIds.slice(-2),
      confidence: input.baseline?.deviations[0]?.confidence ?? "medium",
    });
  }

  const confEntries = input.care_state?.confidence_scores ?? [];
  const explicitUnknowns =
    input.continuity_properties?.explicit_unknowns.explicit_unknowns.length ?? 0;
  chain.push({
    stage: "confidence",
    summary:
      confEntries.length > 0
        ? confEntries.map((c) => `${c.area}: ${c.level}`).join("; ")
        : explicitUnknowns > 0
          ? `${explicitUnknowns} explicit unknown(s) — trustworthy limits surfaced.`
          : "Limited evidence — confidence remains conservative.",
    evidence_event_ids: recentIds.length > 0 ? recentIds : eventIds.slice(-1),
    confidence: explicitUnknowns > 2 ? "low" : confEntries.some((c) => c.level === "high") ? "high" : "medium",
    uncertainty_note:
      explicitUnknowns > 0
        ? "Uncertainty is surfaced — not hidden."
        : undefined,
  });

  return chain;
}

function resolveCapabilities(
  input: ProcessCareRealityIntelligenceInput,
): CareRealityIntelligenceResult["snapshot"]["capabilities_active"] {
  const active: CareRealityIntelligenceResult["snapshot"]["capabilities_active"] = [
    "living_care_record",
    "care_state_understanding",
  ];
  if (input.baseline?.active || input.care_reality_profile?.active) {
    active.push("person_specific_understanding");
  }
  if (input.moment_of_need?.triggered) {
    active.push("moment_of_need_guidance");
  }
  if (
    (input.care_state?.decisions.length ?? 0) > 0 ||
    listDecisionMemory(input.care_recipient_id).length > 0
  ) {
    active.push("decision_memory");
  }
  if (input.care_reality_profile?.profile.relationship_insights.length) {
    active.push("human_context");
  }
  return active;
}

/**
 * Compose Care Reality Intelligence from existing engines — facade only, no duplicate logic.
 */
export function processCareRealityIntelligence(
  input: ProcessCareRealityIntelligenceInput,
): CareRealityIntelligenceResult {
  const asOf = input.as_of ?? new Date().toISOString();
  const outcomes = deriveOutcomesFromProfile(input, asOf);
  const transitionSignals = detectTransitionSignals(input.all_events, asOf);

  const personSummary =
    input.care_reality_profile?.profile.person_specific_summary ??
    input.baseline?.comparison_question ??
    COMPARISON_ENGINE_QUESTION;

  const snapshot = {
    care_recipient_id: input.care_recipient_id,
    computed_at: asOf,
    category: CARE_REALITY_INTELLIGENCE_CATEGORY,
    comparison_question: COMPARISON_ENGINE_QUESTION,
    intelligence_chain: buildIntelligenceChain(input),
    capabilities_active: resolveCapabilities(input),
    care_loop_outcomes: outcomes,
    care_transition_signals: transitionSignals,
    person_specific_summary: personSummary,
    trust_rules_upheld: TRUST_ENGINEERING_RULES,
    build_surfaces_active: [
      "personal_baseline",
      "care_history",
      "change_detection",
      "context_reconstruction",
      "decision_memory",
      "uncertainty_awareness",
      "evidence_preservation",
      ...(transitionSignals.length > 0 ? (["care_transition_signals"] as const) : []),
    ] as const,
  };

  return {
    active: input.all_events.length > 0,
    snapshot,
    defining_principle: CARE_REALITY_INTELLIGENCE_DEFINING_PRINCIPLE,
    status: {
      facade: CARE_REALITY_INTELLIGENCE_STATUS.facade,
      care_loop_outcomes: CARE_REALITY_INTELLIGENCE_STATUS.care_loop_outcomes,
      care_transition_mode: CARE_REALITY_INTELLIGENCE_STATUS.care_transition_mode,
    },
  };
}

/** Guard: transition types are registered for future mode. */
export function listCareTransitionSignalTypes(): readonly CareTransitionSignalType[] {
  return CARE_TRANSITION_SIGNAL_TYPES;
}
