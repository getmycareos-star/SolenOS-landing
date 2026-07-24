import type { SituationResponse } from "../situation-entry/types";
import { MAX_FOLLOW_UP_ITEMS, MAX_HIGH_IMPACT_QUESTIONS } from "./contract-constants";
import {
  humanizeUncertaintyForCaregiver,
  isGenericSignalText,
  resolveCaregiverWords,
} from "../mvp-input-architecture";
import {
  buildDegradedOutput,
  computeCompleteness,
  createEmptyTrustLayer,
  createEmptyTransparencyPanel,
  mapConfidenceToCanonical,
  mapRiskToCanonical,
} from "./degrade";
import type { FinalOutputContract } from "./types";
import { validateFinalOutput, extractFinalOutputPayload } from "./schema";
import { applyCrisisOverlay } from "./crisis-overlay";
import { compileWithEntryBehavior } from "./entry-compile";

type CompileSource = Omit<SituationResponse, "final_output">;

function buildWhatIsHappening(response: CompileSource): string {
  const caregiverWords = resolveCaregiverWords(response.events_created);
  // First situation: caregiver words win — never bury them under engine phrasing.
  if (response.is_first_situation && caregiverWords) {
    return caregiverWords.slice(0, 240);
  }

  const moment = response.moment_of_need_layer;
  if (moment?.triggered && moment.sections.what_changed.length > 0) {
    return moment.sections.what_changed.join(" · ");
  }

  const continuityPrefix =
    response.north_star_experience_layer?.continuity_recognition?.trim() ?? "";
  const memorySummary = response.memory_strategy_layer?.current_status_summary ?? [];

  if (response.what_i_understood.length === 0) {
    if (response.events_created.length > 0) {
      const body = response.events_created
        .map(
          (e) =>
            `${e.extracted_type.replace(/_/g, " ")}: ${e.raw_input.slice(0, 100)}`,
        )
        .join(" · ");
      const withSummary =
        memorySummary.length > 0
          ? `${body} · Current status: ${memorySummary.slice(0, 2).join("; ")}`
          : body;
      return continuityPrefix ? `${continuityPrefix} ${withSummary}` : withSummary;
    }
    if (memorySummary.length > 0) {
      const summaryBody = memorySummary.slice(0, 3).join(" · ");
      return continuityPrefix ? `${continuityPrefix} ${summaryBody}` : summaryBody;
    }
    return continuityPrefix;
  }

  const body = response.what_i_understood
    .map((u) => `${u.extracted_type.replace(/_/g, " ")} — ${u.label}`)
    .join(" · ");
  const withSummary =
    memorySummary.length > 0
      ? `${body} · Current status: ${memorySummary.slice(0, 2).join("; ")}`
      : body;

  return continuityPrefix ? `${continuityPrefix} ${withSummary}` : withSummary;
}

function isWeakPriorityLine(text: string): boolean {
  const t = text.trim().toLowerCase();
  return (
    t === "time" ||
    t === "entity" ||
    t.startsWith("provisional:") ||
    t.startsWith("when this started") ||
    t.startsWith("new event added")
  );
}

function caregiverSnippetFromEvents(response: CompileSource): string | null {
  return resolveCaregiverWords(response.events_created);
}

function buildWhatMattersNow(response: CompileSource): string {
  // Prefer ACS / held caregiver words — never keyword Clarity templates (eat→fluids, fall→safety).
  if (response.is_first_situation) {
    const snippet = caregiverSnippetFromEvents(response);
    if (snippet) {
      return snippet.slice(0, 160);
    }
  }

  const momentKnown = response.moment_of_need_layer?.sections.what_we_know[0];
  if (momentKnown) {
    return momentKnown;
  }

  const baselineDeviation = response.baseline_intelligence_layer?.deviations[0];
  if (baselineDeviation?.is_unusual_for_person) {
    return `Unusual for this person: ${baselineDeviation.observation.slice(0, 120)}`;
  }

  const memoryPriority = response.memory_strategy_layer?.retrieval_priority[0];
  if (memoryPriority) {
    const record = response.memory_strategy_layer?.explainable_facts.find(
      (f) => f.label.length > 0,
    );
    if (record) {
      // Never emit confidence % in caregiver-facing strings.
      return record.label.slice(0, 160);
    }
  }

  const decayStale = response.continuity_decay_layer?.stale_items.find(
    (s) => s.tier === "short_lived" || s.tier === "medium_lived",
  );
  if (decayStale) {
    return `May need a fresh check: ${decayStale.label}`;
  }

  const attentionIds = response.priority_layer?.attention_events ?? [];
  const topIds = response.priority_layer?.top_events ?? [];

  for (const id of [...attentionIds, ...topIds]) {
    const event = response.context.events.find((e) => e.id === id);
    if (event) {
      return `${event.extracted_type.replace(/_/g, " ")}: ${event.raw_input.slice(0, 120)}`;
    }
  }

  if (response.what_changed.length > 0) {
    const candidate = response.what_changed[0]!;
    if (!isWeakPriorityLine(candidate)) return candidate;
  }

  const snippet = caregiverSnippetFromEvents(response);
  if (snippet) {
    return snippet.slice(0, 160);
  }

  return "No immediate priority identified — continue building continuity.";
}

function buildWhatToAskNext(response: CompileSource): string {
  const momentQuestions =
    response.moment_of_need_layer?.sections.questions_worth_tracking.slice(0, MAX_HIGH_IMPACT_QUESTIONS) ??
    [];
  if (momentQuestions.length > 0) {
    return momentQuestions.join(" ");
  }

  const questions = response.what_needs_clarification
    .map(humanizeUncertaintyForCaregiver)
    .slice(0, MAX_HIGH_IMPACT_QUESTIONS);
  const behaviorUnknowns =
    response.behavior_interpretation_layer?.decision_trace_unknowns.slice(0, 2) ?? [];
  const decayQuestions =
    response.continuity_decay_layer?.refresh_session?.questions.slice(0, 2) ?? [];
  const clarificationQuestions =
    response.clarification_engine_layer?.questions.map((q) => q.question).slice(0, 2) ?? [];
  const combined = [
    ...questions,
    ...clarificationQuestions,
    ...behaviorUnknowns.map((u) => u.replace(/^Unverified: /, "")),
    ...decayQuestions,
  ];
  if (combined.length === 0) {
    return "No high-impact questions at this time — add updates as the situation evolves.";
  }
  return combined.slice(0, MAX_HIGH_IMPACT_QUESTIONS).join(" ");
}

function buildWhatCanWait(response: CompileSource): string {
  const hidden = response.priority_layer?.hidden_count ?? 0;
  const tracked = response.what_will_be_tracked
    .filter((d) => !response.what_is_uncertain.some((u) => u.includes(d)))
    .map((d) => d.replace(/_/g, " "));

  const parts: string[] = [];
  if (hidden > 0) parts.push(`${hidden} lower-priority event(s) can wait`);
  if (tracked.length > 0) parts.push(`Monitoring: ${tracked.join(", ")}`);
  if (parts.length === 0) {
    return "Non-urgent continuity signals will emerge as more context is added.";
  }
  return parts.join(". ");
}

function buildFollowUpItems(response: CompileSource): string[] {
  const items: string[] = [];

  for (const event of response.events_created) {
    if (event.extracted_type === "follow_up") {
      items.push(`Schedule or confirm follow-up: ${event.raw_input.slice(0, 80)}`);
    }
    if (event.extracted_type === "financial_issue") {
      items.push(`Verify insurance or billing status: ${event.raw_input.slice(0, 60)}`);
    }
    if (event.extracted_type === "contact_event") {
      items.push(`Call or contact: ${event.raw_input.slice(0, 60)}`);
    }
    if (/\b(confirm|verify|check|call|schedule)\b/i.test(event.raw_input)) {
      items.push(event.raw_input.slice(0, 100));
    }
  }

  for (const q of response.what_needs_clarification) {
    if (/appointment|follow[- ]?up|deadline|due/i.test(q)) {
      items.push(`Clarify: ${q}`);
    }
  }

  for (const action of response.behavior_interpretation_layer?.escalation.suggested_actions ?? []) {
    items.push(action);
  }

  for (const prompt of response.continuity_decay_layer?.recheck_prompts ?? []) {
    items.push(prompt);
  }

  const memoryFollowUps = response.memory_layer?.retrieval_order.includes("open_follow_ups");
  if (memoryFollowUps) {
    items.push("Review open follow-ups in continuity timeline");
  }

  return [...new Set(items)].slice(0, MAX_FOLLOW_UP_ITEMS);
}

function buildDecisionTrace(response: CompileSource): FinalOutputContract["decision_trace"] {
  const events = [
    ...response.events_created.map((e) => e.raw_input.slice(0, 120)),
    ...response.what_i_understood.map((u) => u.label),
    ...(response.behavior_interpretation_layer?.decision_trace_events ?? []),
  ].filter((e, i, arr) => arr.indexOf(e) === i);

  const assumptions = [
    ...(response.failure_resilience_layer?.failures
      .filter((f) => f.category === "ambiguous_interpretation")
      .flatMap((f) => f.possible_interpretations)
      .slice(0, 5) ?? []),
    ...(response.behavior_interpretation_layer?.decision_trace_assumptions ?? []),
    ...(response.north_star_experience_layer?.decision_trace ?? []),
  ];

  const unknowns = [
    ...response.what_is_uncertain,
    ...(response.failure_resilience_layer?.failures.flatMap((f) => f.not_understood) ?? []),
    ...(response.behavior_interpretation_layer?.decision_trace_unknowns ?? []),
    ...(response.continuity_decay_layer?.decision_trace_reasons ?? []),
  ].slice(0, 8);

  const evidence_sources = [
    ...new Set(
      response.trust_provenance_layer?.provenance_records.map((p) => p.source_label) ?? [
        "user input",
      ],
    ),
  ];

  if (response.document_events_count > 0) {
    evidence_sources.push("uploaded document");
  }

  return { events, assumptions, unknowns, evidence_sources };
}

function buildConfidenceState(response: CompileSource): FinalOutputContract["confidence_state"] {
  const trustLevel = response.trust_provenance_layer?.confidence_assessment.level ?? "low";
  const understood = response.what_i_understood.length + response.events_created.length;
  const uncertain = response.what_is_uncertain.length;

  const completeness = computeCompleteness(understood, uncertain);
  const decayConfidence = response.continuity_decay_layer?.continuity_confidence_pct;
  const adjustedCompleteness =
    decayConfidence !== undefined
      ? Math.round((completeness + decayConfidence) / 2)
      : completeness;

  const reasoning_limits = [
    ...(response.trust_provenance_layer?.generation_boundaries.forbidden.map(
      (f) => `Cannot ${f.replace(/_/g, " ")}`,
    ) ?? []),
    ...(response.failure_resilience_layer?.failures.map((f) => f.message) ?? []),
  ].slice(0, 6);

  if (decayConfidence !== undefined && decayConfidence < 60) {
    reasoning_limits.unshift(
      "Care understanding may be out of date — a fresh update would help",
    );
  }

  if (reasoning_limits.length === 0) {
    reasoning_limits.push("Only structural interpretation — no diagnosis or prediction.");
  }

  return {
    overall_confidence: mapConfidenceToCanonical(trustLevel),
    completeness: adjustedCompleteness,
    reasoning_limits,
  };
}

function buildTrustLayer(response: CompileSource): FinalOutputContract["trust_layer"] {
  if (response.trust_layer_engine_layer?.trust_layer) {
    return response.trust_layer_engine_layer.trust_layer;
  }

  const fallback = createEmptyTrustLayer();
  for (const event of response.events_created) {
    fallback.known.push({
      statement: event.raw_input.slice(0, 160),
      source: event.source === "document" ? "uploaded document" : "caregiver input",
      source_type: event.source === "document" ? "document" : "caregiver_input",
      source_event_id: event.id,
    });
  }
  for (const assumption of response.behavior_interpretation_layer?.decision_trace_assumptions ?? []) {
    fallback.assumed.push({
      statement: assumption,
      reasoning_basis: "Behavior interpretation — labeled assumption",
      source_engine: "behavior_interpretation_engine",
    });
  }
  for (const unknown of response.what_is_uncertain.slice(0, 5)) {
    fallback.unknown.push({ statement: unknown, drives_clarification: true });
  }
  if (response.continuity_decay_layer) {
    fallback.recency.freshness_score =
      response.continuity_decay_layer.continuity_confidence_pct / 100;
    fallback.recency.last_updated_at =
      response.context.events[response.context.events.length - 1]?.ingestion_time ?? null;
  }
  fallback.confidence = Math.min(
    0.85,
    fallback.recency.freshness_score * 0.6 + (fallback.known.length > 0 ? 0.25 : 0.1),
  );
  return fallback;
}

/** Compile all pipeline layers into the single canonical output schema. */
export function compileFromSituationResponse(
  response: CompileSource,
): FinalOutputContract {
  const entryCompiled = compileWithEntryBehavior(response);
  if (entryCompiled) {
    return entryCompiled;
  }

  const happening = buildWhatIsHappening(response);

  if (!happening.trim() && response.events_created.length === 0) {
    return buildDegradedOutput({
      reason: "No structured events could be extracted from this input.",
      questions: response.what_needs_clarification,
      unknowns: response.what_is_uncertain,
    });
  }

  const attentionCount = response.priority_layer?.attention_events.length ?? 0;
  const hasFailures = (response.failure_resilience_layer?.failures.length ?? 0) > 0;
  const behaviorEscalation = response.behavior_interpretation_layer?.escalation.risk_elevation;

  const draft: FinalOutputContract = {
    what_is_happening: happening || "Situation recorded — structured meaning pending review.",
    what_matters_now: buildWhatMattersNow(response),
    what_to_ask_next: buildWhatToAskNext(response),
    risk_level: mapRiskToCanonical(
      behaviorEscalation === "high" ? "high" : behaviorEscalation === "medium" ? "medium" : undefined,
      attentionCount,
      hasFailures,
    ),
    what_can_wait: buildWhatCanWait(response),
    follow_up_items: buildFollowUpItems(response),
    decision_trace: buildDecisionTrace(response),
    confidence_state: buildConfidenceState(response),
    trust_layer: buildTrustLayer(response),
    transparency_panel:
      response.care_transparency_layer?.panel ?? createEmptyTransparencyPanel(),
  };

  if (
    response.crisis_mode_interaction_layer?.crisis_mode &&
    !(
      response.is_first_situation &&
      response.crisis_mode_interaction_layer.urgency_level !== "critical"
    )
  ) {
    return validateFinalOutput(applyCrisisOverlay(draft, response.crisis_mode_interaction_layer));
  }

  return validateFinalOutput(draft);
}

export function compileAndValidate(output: unknown): FinalOutputContract {
  return validateFinalOutput(extractFinalOutputPayload(output));
}
