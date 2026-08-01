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
  CareRealityIntelligenceSnapshot,
  CareTransitionSignal,
  CareTransitionSignalType,
  IntelligenceChainLink,
  ProcessCareRealityIntelligenceInput,
} from "./types";
import {
  listDecisionMemory,
  composeDecisionPreparation,
} from "../decision-memory";
import {
  listPrimaryCareRealityMemory,
  summarizeCareRealityMemory,
  detectRealityRecurrence,
} from "./care-reality-memory";
import { classifyExtractionFragment } from "../care-reality-extraction";

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

function buildSubstantiveEventsLink(
  input: ProcessCareRealityIntelligenceInput,
  eventIds: string[],
): IntelligenceChainLink {
  const all = input.all_events;
  const recent = input.events_created;
  const typeCounts = new Map<string, number>();
  for (const e of all) {
    const t = e.extracted_type ?? "observation";
    typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
  }
  const dominant = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "observation";
  const recentTypes = [...new Set(recent.map((e) => e.extracted_type ?? "observation"))];

  const summary =
    all.length === 0
      ? "No events yet — first input will establish the care record."
      : recent.length > 0
        ? `${all.length} events on record. This entry adds ${recent.length} ${recentTypes.join(" / ")} event(s). Dominant type: ${dominant}.`
        : `${all.length} events on record. No new events this turn. Dominant type: ${dominant}.`;

  return {
    stage: "events",
    summary,
    evidence_event_ids: eventIds.slice(-5),
    confidence: all.length >= 3 ? "high" : all.length > 0 ? "medium" : "low",
  };
}

function buildSubstantiveChangesLink(
  input: ProcessCareRealityIntelligenceInput,
  recentIds: string[],
  eventIds: string[],
): IntelligenceChainLink | null {
  const pipelineChanges = input.what_changed ?? [];
  const stateChanges = input.care_state?.recent_changes ?? [];
  const deviations = input.baseline?.deviations ?? [];
  const allChanges = [
    ...pipelineChanges,
    ...stateChanges,
    ...deviations.map((d) => d.observation),
  ];
  const unique = [...new Set(allChanges)].filter(Boolean);

  if (unique.length === 0 && deviations.length === 0) return null;

  const deviationNotes = deviations.slice(0, 3).map((d) => `${d.deviation_type}: ${d.observation}`);
  const parts = [
    ...unique.slice(0, 3).map((c) => `"${c}"`),
    ...deviationNotes,
  ].filter(Boolean);

  return {
    stage: "changes",
    summary: parts.length > 0 ? parts.join("; ") : "Change detected from prior care state.",
    evidence_event_ids: recentIds.length > 0 ? recentIds : eventIds.slice(-2),
    confidence: deviations.some((d) => d.is_unusual_for_person) ? "high" : "medium",
    uncertainty_note:
      unique.length > 3 ? `${unique.length - 3} additional change(s) tracked.` : undefined,
  };
}

function buildSubstantiveDecisionsLink(
  input: ProcessCareRealityIntelligenceInput,
  eventIds: string[],
): IntelligenceChainLink | null {
  const stateDecisions = input.care_state?.decisions ?? [];
  const decisionMemory = listDecisionMemory(input.care_recipient_id);
  const allDecisions = [...stateDecisions];
  const memoryEntries = decisionMemory.slice(-6);
  for (const entry of memoryEntries) {
    if (!allDecisions.includes(entry.what)) {
      allDecisions.push(entry.what);
    }
  }

  if (allDecisions.length === 0) return null;

  const recent = allDecisions.slice(-4);
  const openUnknowns = memoryEntries
    .filter((e) => !e.reason)
    .map((e) => `"${e.what}" — reason not held yet`);

  return {
    stage: "decisions",
    summary: recent.join("; "),
    evidence_event_ids: eventIds.slice(-3),
    confidence: memoryEntries.length > 0 ? "high" : "medium",
    uncertainty_note: openUnknowns.length > 0 ? `${openUnknowns.length} decision(s) without recorded reason.` : undefined,
  };
}

function buildSubstantiveOutcomesLink(
  input: ProcessCareRealityIntelligenceInput,
  asOf: string,
  eventIds: string[],
): IntelligenceChainLink | null {
  const profile = input.care_reality_profile?.profile;
  const helped = profile?.sections.what_helped ?? [];
  const notHelped = profile?.sections.what_did_not_help ?? [];
  const decisionMemory = listDecisionMemory(input.care_recipient_id);
  const withOutcomes = decisionMemory.filter((e) => e.outcome);

  const parts: string[] = [];
  for (const entry of helped.slice(-2)) {
    parts.push(`Helped: ${entry.label}`);
  }
  for (const entry of notHelped.slice(-2)) {
    parts.push(`Did not help: ${entry.label}`);
  }
  for (const entry of withOutcomes.slice(-2)) {
    parts.push(`Outcome: ${entry.what} → ${entry.outcome}`);
  }

  if (parts.length === 0) return null;

  return {
    stage: "outcomes",
    summary: parts.join("; "),
    evidence_event_ids: eventIds.slice(-5),
    confidence: helped.length + notHelped.length + withOutcomes.length > 2 ? "high" : "medium",
  };
}

function buildSubstantiveContextLink(
  input: ProcessCareRealityIntelligenceInput,
  eventIds: string[],
): IntelligenceChainLink | null {
  const profile = input.care_reality_profile?.profile;
  const baselineFacts = input.baseline?.baseline_facts ?? [];
  const relationshipInsights = profile?.relationship_insights ?? [];
  const personSummary = profile?.person_specific_summary;

  const parts: string[] = [];
  if (personSummary) parts.push(personSummary);
  for (const fact of baselineFacts.slice(-3)) {
    parts.push(`Baseline: ${fact.label} (${fact.domain}, ${fact.confidence})`);
  }
  for (const insight of relationshipInsights.slice(-2)) {
    parts.push(`Context: ${insight}`);
  }

  if (parts.length === 0) return null;

  return {
    stage: "context",
    summary: parts.join("; "),
    evidence_event_ids: eventIds.slice(-3),
    confidence: baselineFacts.length > 0 ? "high" : "medium",
  };
}

function buildSubstantiveConfidenceLink(
  input: ProcessCareRealityIntelligenceInput,
  recentIds: string[],
  eventIds: string[],
): IntelligenceChainLink {
  const explicitUnknowns = input.continuity_properties?.explicit_unknowns.explicit_unknowns ?? [];
  const confidenceScores = input.care_state?.confidence_scores ?? [];
  const uncertainties = input.what_is_uncertain ?? [];

  const parts: string[] = [];
  for (const entry of confidenceScores.slice(-3)) {
    parts.push(`${entry.area}: ${entry.level}`);
  }
  for (const unknown of explicitUnknowns.slice(-3)) {
    parts.push(`Unknown: ${unknown.clarification_question ?? unknown.missing_information}`);
  }
  for (const u of uncertainties.slice(-2)) {
    parts.push(`Uncertain: ${u}`);
  }

  const confidence =
    explicitUnknowns.length > 3
      ? "low"
      : confidenceScores.some((c) => c.level === "high")
        ? "high"
        : confidenceScores.length > 0
          ? "medium"
          : "low";

  return {
    stage: "confidence",
    summary: parts.length > 0 ? parts.join("; ") : "Limited evidence — confidence remains conservative.",
    evidence_event_ids: recentIds.length > 0 ? recentIds : eventIds.slice(-1),
    confidence,
    uncertainty_note: explicitUnknowns.length > 0 ? "Uncertainty is surfaced — not hidden." : undefined,
  };
}

function retrieveRelevantMemory(
  input: ProcessCareRealityIntelligenceInput,
): CareRealityIntelligenceSnapshot["memory_surface"] {
  const primary = listPrimaryCareRealityMemory(input.care_recipient_id);
  const summary = summarizeCareRealityMemory({ careKey: input.care_recipient_id });

  let recurring: import("./care-reality-memory").CareRealityMemoryObject | null = null;
  if (input.events_created.length > 0 || input.all_events.length > 0) {
    const recent = input.events_created[0] ?? input.all_events[input.all_events.length - 1];
    if (recent) {
      const cat = classifyExtractionFragment(recent.raw_input);
      const type = cat === "contributor_load" || cat === "disagreement_perspective"
        ? "contributor_context"
        : "observation";
      recurring = detectRealityRecurrence({
        careKey: input.care_recipient_id,
        type,
        description: recent.raw_input.slice(0, 140),
      });
    }
  }

  return {
    primary_count: primary.length,
    recurring_description: recurring?.description ?? null,
    summary_what_changed: summary.what_changed,
    summary_decisions: summary.decisions,
    summary_outcomes: summary.outcomes,
    summary_unknowns: summary.unknowns,
    summary_context: summary.context,
    recurring_patterns: summary.recurring_patterns,
  };
}

function buildComparisonEngineOutput(
  input: ProcessCareRealityIntelligenceInput,
): CareRealityIntelligenceSnapshot["comparison_engine"] {
  const deviations = input.baseline?.deviations ?? [];
  const baselineFacts = input.baseline?.baseline_facts ?? [];
  const topDeviation = deviations[0];

  return {
    deviations,
    baseline_facts_count: baselineFacts.length,
    has_deviation: deviations.length > 0,
    top_deviation: topDeviation
      ? `${topDeviation.deviation_type}: ${topDeviation.observation} (vs ${topDeviation.compared_to_baseline})`
      : null,
  };
}

function synthesizeReasoning(
  chain: IntelligenceChainLink[],
  memory: ReturnType<typeof retrieveRelevantMemory>,
  comparison: ReturnType<typeof buildComparisonEngineOutput>,
  input: ProcessCareRealityIntelligenceInput,
): string {
  const parts: string[] = [];

  const eventsLink = chain.find((l) => l.stage === "events");
  const changesLink = chain.find((l) => l.stage === "changes");
  const decisionsLink = chain.find((l) => l.stage === "decisions");
  const outcomesLink = chain.find((l) => l.stage === "outcomes");
  const contextLink = chain.find((l) => l.stage === "context");
  const confidenceLink = chain.find((l) => l.stage === "confidence");

  if (eventsLink) parts.push(eventsLink.summary);
  if (changesLink) parts.push(changesLink.summary);
  if (decisionsLink) parts.push(decisionsLink.summary);
  if (outcomesLink) parts.push(outcomesLink.summary);
  if (contextLink) parts.push(contextLink.summary);
  if (confidenceLink) parts.push(confidenceLink.summary);

  if ((memory as any)?.recurring_description) {
    parts.push(`Recurring pattern detected: "${(memory as any).recurring_description}"`);
  }
  if ((memory as any)?.recurring_patterns?.length > 0) {
    parts.push(`Known patterns: ${(memory as any).recurring_patterns[0]}`);
  }
  if ((comparison as any)?.has_deviation && (comparison as any)?.top_deviation) {
    parts.push(`Comparison engine: ${(comparison as any).top_deviation}`);
  }

  const unknowns = input.continuity_properties?.explicit_unknowns.explicit_unknowns ?? [];
  if (unknowns.length > 0) {
    parts.push(`${unknowns.length} explicit unknown(s) — trustworthy limits surfaced.`);
  }

  return parts.filter(Boolean).join(" → ");
}

function buildIntelligenceChain(
  input: ProcessCareRealityIntelligenceInput,
): IntelligenceChainLink[] {
  const eventIds = input.all_events.map((e) => e.id);
  const recentIds = input.events_created.map((e) => e.id);
  const chain: IntelligenceChainLink[] = [];

  const eventsLink = buildSubstantiveEventsLink(input, eventIds);
  chain.push(eventsLink);

  const changesLink = buildSubstantiveChangesLink(input, recentIds, eventIds);
  if (changesLink) chain.push(changesLink);

  const decisionsLink = buildSubstantiveDecisionsLink(input, eventIds);
  if (decisionsLink) chain.push(decisionsLink);

  const outcomesLink = buildSubstantiveOutcomesLink(input, input.as_of ?? new Date().toISOString(), eventIds);
  if (outcomesLink) chain.push(outcomesLink);

  const contextLink = buildSubstantiveContextLink(input, eventIds);
  if (contextLink) chain.push(contextLink);

  const confidenceLink = buildSubstantiveConfidenceLink(input, recentIds, eventIds);
  chain.push(confidenceLink);

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
 * Compose Care Reality Intelligence from existing engines — facade with substantive reasoning chain.
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

  const chain = buildIntelligenceChain(input);
  const memorySurface = retrieveRelevantMemory(input);
  const comparisonEngine = buildComparisonEngineOutput(input);
  const reasoningSummary = synthesizeReasoning(chain, memorySurface, comparisonEngine, input);

  const decisionMemory = listDecisionMemory(input.care_recipient_id);
  const decisionPreparation = composeDecisionPreparation({ careKey: input.care_recipient_id, maxLines: 3 });

  const snapshot = {
    care_recipient_id: input.care_recipient_id,
    computed_at: asOf,
    category: CARE_REALITY_INTELLIGENCE_CATEGORY,
    comparison_question: COMPARISON_ENGINE_QUESTION,
    intelligence_chain: chain,
    capabilities_active: resolveCapabilities(input),
    care_loop_outcomes: outcomes,
    care_transition_signals: transitionSignals,
    person_specific_summary: personSummary,
    reasoning_summary: reasoningSummary,
    memory_surface: memorySurface,
    decision_memory_surface: {
      count: decisionMemory.length,
      preparation_lines: decisionPreparation.lines,
      open_unknowns: decisionPreparation.open_unknowns,
    },
    comparison_engine: comparisonEngine,
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
