import {
  CARE_STATE_ENGINE_DEFINING_PRINCIPLE,
  CARE_STATE_RULES,
} from "./contract-constants";
import type { CareStateEngineResult, CareStateSnapshot, ProcessCareStateEngineInput } from "./types";
import { deriveExplicitUnknowns } from "../continuity-properties/explicit-unknowns";
import { DEFAULT_CLINICAL_PROFILE_ID } from "../clinical-profile";

function isObservation(text: string): boolean {
  return /\b(seem|seemed|noticed|refused|confused|fell|almost|slept|eating|appetite|worse|better)\b/i.test(
    text,
  );
}

function isMed(text: string): boolean {
  return /\b(med(?:ication|s)?|dose|pharmacy|prescription|pill)\b/i.test(text);
}

function isDecision(text: string): boolean {
  return /\b(decid(?:ed|e|ing)|chose|agreed|will (?:start|stop|change))\b/i.test(text);
}

function isTaskLike(text: string): boolean {
  return /\b(call|schedule|follow[- ]?up|appoint|refill|ask (?:the )?doctor)\b/i.test(text);
}

function isRiskLike(text: string): boolean {
  return /\b(fell|fall|wander|urgent|unsafe|chok|dehydrat|infection|missed dose)\b/i.test(text);
}

export function processCareStateEngine(
  input: ProcessCareStateEngineInput,
): CareStateEngineResult {
  const asOf = input.as_of ?? new Date().toISOString();
  const active = input.all_events.filter(
    (e) => e.status !== "invalidated" && e.status !== "superseded",
  );

  const observations = active
    .filter((e) => isObservation(e.raw_input))
    .map((e) => e.raw_input.slice(0, 140))
    .slice(-8);

  const medications = active
    .filter((e) => isMed(e.raw_input) || e.extracted_type.includes("medication"))
    .map((e) => e.raw_input.slice(0, 120))
    .slice(-6);

  const decisions = active
    .filter((e) => isDecision(e.raw_input))
    .map((e) => e.raw_input.slice(0, 120))
    .slice(-6);

  const tasks = active
    .filter((e) => isTaskLike(e.raw_input))
    .map((e) => e.raw_input.slice(0, 120))
    .slice(-6);

  const risks = active
    .filter((e) => isRiskLike(e.raw_input))
    .map((e) => e.raw_input.slice(0, 120))
    .slice(-6);

  const events = active.map(
    (e) => `${e.extracted_type.replace(/_/g, " ")}: ${e.raw_input.slice(0, 100)}`,
  );

  const unknowns = [
    ...input.what_is_uncertain,
    ...input.what_needs_clarification,
  ].slice(0, 6);

  const diff = input.care_context_diff?.diff.sections;
  const recent_changes = [
    ...(diff?.factual_delta ?? []),
    ...(diff?.directional_change ?? []),
    ...(diff?.newly_important ?? []),
  ].slice(0, 6);

  const needs_attention = [
    ...(input.state_of_care?.summary.sections.what_needs_attention ?? []),
    ...(diff?.lost_confidence ?? []),
    ...risks.slice(0, 2),
  ].slice(0, 5);

  const what_is_stable = [
    ...(input.state_of_care?.summary.sections.what_is_stable ?? []),
    ...(diff?.stabilized ?? []),
  ].slice(0, 5);

  const current_conditions =
    input.state_of_care?.summary.sections.what_is_happening_now.slice(0, 5) ??
    active.slice(-3).map((e) => e.raw_input.slice(0, 120));

  const person_context = [
    `${active.length} CareEvent(s) in Living Care Record`,
    "Evolving understanding of one person's care journey",
  ];

  const confidence_scores = [
    {
      area: "overall_understanding",
      level: (active.length >= 3
        ? "high"
        : active.length >= 1
          ? "medium"
          : "low") as "high" | "medium" | "low",
      note:
        active.length === 0
          ? "Care State forming — awaiting first CareEvent."
          : "Understanding derived from accumulated CareEvents.",
    },
    {
      area: "medications",
      level: (medications.length > 0 ? "medium" : "low") as "high" | "medium" | "low",
      note:
        medications.length > 0
          ? "Medication signals present; adherence may remain unknown."
          : "Medication confirmation missing — blind spot if clinically relevant.",
    },
    {
      area: "unknowns",
      level: (unknowns.length === 0
        ? "high"
        : unknowns.length <= 2
          ? "medium"
          : "low") as "high" | "medium" | "low",
      note:
        unknowns.length === 0
          ? "No explicit gaps surfaced."
          : `${unknowns.length} information gap(s) tracked.`,
    },
  ];

  const change_detected =
    input.care_context_diff?.has_meaningful_change === true || recent_changes.length > 0;

  const current_understanding = change_detected
    ? recent_changes[0] ??
      `Care state updated — ${input.events_created.length} new CareEvent(s); change detected.`
    : current_conditions[0] ??
      (active.length === 0
        ? "Care State forming — awaiting first CareEvent."
        : "Current care understanding derived from CareEvents.");

  const known_facts = [...current_conditions, ...observations].slice(0, 8);
  const inferred_interpretations = [
    ...recent_changes,
    ...(change_detected ? ["CareContext indicates meaningful change"] : []),
  ].slice(0, 6);

  const eum = deriveExplicitUnknowns({
    known: known_facts,
    inferred: inferred_interpretations,
    event_texts: active.map((e) => e.raw_input),
    unresolved_clarifications: unknowns,
    conflict_count: input.care_context_diff?.diff.sections.lost_confidence?.length ?? 0,
    related_care_event_ids: active.map((e) => e.id),
    clinical_profile_id: DEFAULT_CLINICAL_PROFILE_ID,
  });

  const care_state: CareStateSnapshot = {
    care_recipient_id: input.care_recipient_id,
    computed_at: asOf,
    person_context,
    current_conditions,
    events: events.slice(-10),
    observations,
    medications,
    decisions,
    tasks,
    risks,
    unknowns,
    explicit_unknowns: eum.explicit_unknowns,
    known_facts: eum.known,
    inferred_interpretations: eum.inferred,
    confidence_scores,
    recent_changes,
    needs_attention,
    what_is_stable:
      what_is_stable.length > 0
        ? what_is_stable
        : ["No unstable domains forced — monitoring continuity"],
    current_understanding,
  };

  return {
    active: true,
    care_state,
    change_detected,
    rules_upheld: [...CARE_STATE_RULES],
    defining_principle: CARE_STATE_ENGINE_DEFINING_PRINCIPLE,
  };
}
