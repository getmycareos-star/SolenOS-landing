/**
 * Care Moment Engine — Phase 2 FUTURE capability.
 * Implements the Care Moment response framework.
 * NOT an emergency tool, NOT a diagnosis, NOT a chatbot.
 */

import {
  CARE_MOMENT_RESPONSE_FRAMEWORK,
  CARE_MOMENT_IDENTITY,
  CARE_MOMENT_BOUNDARIES,
  CARE_MOMENT_TO_MOMENT_OF_NEED_MAP,
  type CareMomentBrief,
  type CareMomentResponseSection,
} from "./care-moment";
import {
  buildEvidenceObject,
  buildEvidencedConclusion,
  type EvidenceObject,
} from "../evidence-preservation";
import {
  processMomentOfNeed,
  MOMENT_OF_NEED_RULES,
  MOMENT_OF_NEED_DEFINING_PRINCIPLE,
  type ProcessMomentOfNeedInput,
  type MomentOfNeedResult,
} from "../moment-of-need-engine";
import type { CanonicalCareEvent } from "../situation-entry/types";

export type CareMomentEngineInput = {
  raw_input: string;
  events_created: CanonicalCareEvent[];
  all_events: CanonicalCareEvent[];
  baseline?: any;
  care_reality_profile?: any;
  behavior?: any;
  what_is_uncertain: string[];
  as_of?: string;
};

export type CareMomentEngineResult = {
  active: boolean;
  triggered: boolean;
  identity: string;
  sections: Record<string, string[]>;
  evidence_objects: EvidenceObject[];
  uncertainties: string[];
  care_event_ids: string[];
  confidence: "low" | "medium" | "high";
  rules_upheld: string[];
};

function collectCareEventIds(input: CareMomentEngineInput): string[] {
  const ids = new Set<string>();
  for (const e of input.events_created) ids.add(e.id);
  for (const e of input.all_events) ids.add(e.id);
  return [...ids];
}

function buildWhatChanged(input: CareMomentEngineInput): string[] {
  const lines: string[] = [];
  const raw = input.raw_input.trim();
  if (raw) lines.push(`Current observation: "${raw}"`);
  for (const e of input.events_created) {
    lines.push(`New event recorded (${e.id}): ${e.raw_input.slice(0, 120)}`);
  }
  for (const d of input.baseline?.deviations ?? []) {
    lines.push(
      `Deviation from baseline (${d.deviation_type}): ${d.observation.slice(0, 100)} — compared to: ${d.compared_to_baseline}`,
    );
  }
  if (lines.length === 0) lines.push("No changes detected from available information.");
  return lines;
}

function buildWhatDoWeKnow(input: CareMomentEngineInput): string[] {
  const lines: string[] = [];
  for (const f of input.baseline?.baseline_facts ?? []) {
    lines.push(
      `Baseline fact (${f.domain.replace(/_/g, " ")}): ${f.label} — ${f.observation_count} prior observation(s)`,
    );
  }
  for (const entry of input.care_reality_profile?.profile.sections.what_helped ?? []) {
    lines.push(`Previously helped: ${entry.label}`);
  }
  for (const entry of input.care_reality_profile?.profile.sections.known_changes ?? []) {
    lines.push(`Prior change recorded: ${entry.label}`);
  }
  for (const pattern of input.behavior?.longitudinal_patterns ?? []) {
    lines.push(`Historical pattern: ${pattern.label} (${pattern.confidence} confidence, ${pattern.observation_count} observations)`);
  }
  if (lines.length === 0) lines.push("Insufficient prior information — baseline not yet established.");
  return lines;
}

function buildWhyMightThisMatter(input: CareMomentEngineInput): string[] {
  const lines: string[] = [];
  for (const insight of input.care_reality_profile?.profile.relationship_insights ?? []) {
    lines.push(`Relationship context: ${insight}`);
  }
  const medEvents = input.all_events.filter((e) =>
    /\b(medication|med|dose|prescription)\b/i.test(e.raw_input),
  );
  if (medEvents.length > 0) {
    const recent = medEvents[medEvents.length - 1]!;
    lines.push(
      `Medication context: ${recent.raw_input.slice(0, 100)} — may be relevant to discuss with care team`,
    );
  }
  for (const hypothesis of input.behavior?.hypotheses.slice(0, 2) ?? []) {
    lines.push(
      `Possible context (${hypothesis.confidence} confidence): ${hypothesis.interpretation} — ${hypothesis.uncertainty_note}`,
    );
  }
  if (input.care_reality_profile?.profile.possible_context) {
    lines.push(`Profile context: ${input.care_reality_profile.profile.possible_context}`);
  }
  if (lines.length === 0) {
    lines.push("Insufficient linked context — add prior observations to strengthen understanding.");
  }
  return lines;
}

function buildWhatShouldBeRemembered(input: CareMomentEngineInput): string[] {
  const lines: string[] = [];
  for (const e of input.events_created) {
    lines.push(`Event ${e.id}: ${e.raw_input.slice(0, 120)}`);
  }
  for (const d of input.baseline?.deviations ?? []) {
    if (d.is_unusual_for_person) {
      lines.push(`Notable deviation: ${d.observation.slice(0, 100)} (${d.deviation_type})`);
    }
  }
  for (const f of input.baseline?.baseline_facts ?? []) {
    if (f.trajectory && f.trajectory !== "stable") {
      lines.push(`Baseline trajectory (${f.domain.replace(/_/g, " ")}): ${f.trajectory}`);
    }
  }
  if (lines.length === 0) lines.push("Nothing notable to remember from this moment.");
  return lines;
}

function buildWhatQuestionsToConsider(input: CareMomentEngineInput): string[] {
  const lines: string[] = [];
  for (const item of input.behavior?.investigation_checklist.slice(0, 3) ?? []) {
    lines.push(item.item);
  }
  for (const q of input.behavior?.escalation.suggested_actions.slice(0, 2) ?? []) {
    lines.push(q);
  }
  for (const u of input.what_is_uncertain.slice(0, 3)) {
    lines.push(`Clarify: ${u}`);
  }
  if (lines.length === 0) lines.push("What triggered this moment? What was different today?");
  return lines;
}

export function buildCareMomentResponseSections(
  input: CareMomentEngineInput,
): Record<string, string[]> {
  return {
    what_changed: buildWhatChanged(input),
    what_do_we_know: buildWhatDoWeKnow(input),
    why_might_this_matter: buildWhyMightThisMatter(input),
    what_should_be_remembered: buildWhatShouldBeRemembered(input),
    what_questions_to_consider: buildWhatQuestionsToConsider(input),
  };
}

export function projectCareMomentToMomentOfNeed(
  careMoment: CareMomentEngineResult,
): MomentOfNeedResult {
  const map = CARE_MOMENT_TO_MOMENT_OF_NEED_MAP;
  const sections: Record<string, string[]> = {
    what_changed: careMoment.sections[map.what_changed] ?? [],
    what_we_know: careMoment.sections[map.what_do_we_know] ?? [],
    possible_context: careMoment.sections[map.why_might_this_matter] ?? [],
    questions_worth_tracking: careMoment.sections[map.what_questions_to_consider] ?? [],
  };

  return {
    active: careMoment.active,
    triggered: careMoment.triggered,
    trigger_reasons: careMoment.triggered ? ["care_moment_triggered"] : [],
    sections,
    change_type: null,
    helplessness_reduction_goal:
      "Reduce helplessness through better understanding — not organization.",
    human_support: careMoment.uncertainties.length > 0
      ? [
          {
            kind: "uncertainty",
            message: `${careMoment.uncertainties.length} area(s) remain uncertain — evidence is incomplete`,
          },
        ]
      : [
          {
            kind: "clarity",
            message: "Observation connected to existing care context — review sections below",
          },
        ],
    confidence: careMoment.confidence,
    data_freshness: careMoment.triggered ? new Date().toISOString() : new Date().toISOString(),
    rules_upheld: [...MOMENT_OF_NEED_RULES],
    defining_principle: MOMENT_OF_NEED_DEFINING_PRINCIPLE,
  };
}

function buildEvidenceObjects(
  input: CareMomentEngineInput,
  sections: Record<string, string[]>,
): EvidenceObject[] {
  const objects: EvidenceObject[] = [];
  const eventIds = input.events_created.map((e) => e.id);
  const timelineLabels = sections.what_changed.slice(0, 3);

  if (eventIds.length > 0) {
    objects.push(
      buildEvidenceObject({
        event_ids: eventIds,
        timeline_labels: timelineLabels,
        observation_type: "direct",
        confidence_score: 0.7,
        source_reliability_score: 0.75,
        reasoning_summary: `Care moment captured from input: "${input.raw_input.slice(0, 100)}"`,
        what_would_increase_confidence: [
          "Confirm timing of observation",
          "Clarify which caregiver observed this",
        ],
      }),
    );
  }

  const uncertaintyIds = input.what_is_uncertain.map((_, i) => `uncertainty_${i}`);
  if (uncertaintyIds.length > 0) {
    objects.push(
      buildEvidenceObject({
        event_ids: uncertaintyIds,
        timeline_labels: input.what_is_uncertain.slice(0, 3),
        observation_type: "mixed",
        confidence_score: 0.4,
        source_reliability_score: 0.5,
        reasoning_summary: "Uncertainty areas identified during care moment processing",
        what_would_increase_confidence: input.what_is_uncertain.slice(0, 3),
      }),
    );
  }

  return objects;
}

function computeConfidence(input: CareMomentEngineInput): "low" | "medium" | "high" {
  const knowCount = buildWhatDoWeKnow(input).length;
  const hasBaseline = input.baseline?.baseline_established === true;
  if (hasBaseline && knowCount >= 2) return "high";
  if (knowCount >= 1) return "medium";
  return "low";
}

function computeRulesUpheld(input: CareMomentEngineInput): string[] {
  const upheld: string[] = [...CARE_MOMENT_BOUNDARIES.must];
  const text = input.raw_input.toLowerCase();

  const diagnosisPatterns = [
    /\bdiagnos(?:is|osed|ing)\b/i,
    /\bhas (?:diabetes|dementia|alzheimer|depression|cancer|hypertension)\b/i,
    /\bsymptom\b/i,
    /\bmedication (?:for|to treat)\b/i,
  ];
  if (!diagnosisPatterns.some((p) => p.test(text))) {
    upheld.push("no_diagnosis_in_output");
  }

  const prescriptionPatterns = [
    /\bprescribe\b/i,
    /\btake (?:aspirin|insulin|metformin)\b/i,
    /\bdrug (?:dose|interaction)\b/i,
  ];
  if (!prescriptionPatterns.some((p) => p.test(text))) {
    upheld.push("no_prescription_in_output");
  }

  return upheld;
}

export function processCareMoment(
  input: CareMomentEngineInput,
): CareMomentEngineResult {
  const asOf = input.as_of ?? new Date().toISOString();
  const sections = buildCareMomentResponseSections(input);
  const evidenceObjects = buildEvidenceObjects(input, sections);
  const uncertainties = [...input.what_is_uncertain];
  const careEventIds = collectCareEventIds(input);
  const confidence = computeConfidence(input);
  const rulesUpheld = computeRulesUpheld(input);

  const momentInput: ProcessMomentOfNeedInput = {
    raw_input: input.raw_input,
    events_created: input.events_created,
    all_events: input.all_events,
    baseline: input.baseline,
    care_reality_profile: input.care_reality_profile,
    behavior: input.behavior,
    what_is_uncertain: input.what_is_uncertain,
    as_of: asOf,
  };

  processMomentOfNeed(momentInput);

  const triggered =
    input.events_created.length > 0 ||
    (input.baseline?.deviations.length ?? 0) > 0 ||
    input.raw_input.trim().length >= 10;

  return {
    active: triggered,
    triggered,
    identity: CARE_MOMENT_IDENTITY,
    sections,
    evidence_objects: evidenceObjects,
    uncertainties,
    care_event_ids: careEventIds,
    confidence,
    rules_upheld: rulesUpheld,
  };
}

export type { CareMomentBrief, CareMomentResponseSection };