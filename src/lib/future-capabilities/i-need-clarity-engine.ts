/**
 * I Need Clarity / Confidence Collapse Support — Phase 2.
 * Regains understanding when certainty disappears — NOT generic chat.
 */

import {
  I_NEED_CLARITY_IDENTITY,
  I_NEED_CLARITY_RESPONSE_SECTIONS,
  CONFIDENCE_COLLAPSE_MOMENT_TYPES,
  type ConfidenceCollapseMomentType,
  COLLAPSE_MOMENT_GOALS,
  CONFIDENCE_COLLAPSE_BOUNDARIES,
  type ConfidenceCollapseSupportBrief,
} from "./confidence-collapse-moments";
import { buildEvidenceObject, buildEvidencedConclusion, type EvidenceObject } from "../evidence-preservation";
import { processMomentOfNeed, type ProcessMomentOfNeedInput, type MomentOfNeedResult } from "../moment-of-need-engine";
import type { CanonicalCareEvent } from "../situation-entry/types";

export type IClarityEngineInput = {
  raw_input: string;
  collapse_type: ConfidenceCollapseMomentType;
  events_created: CanonicalCareEvent[];
  all_events: CanonicalCareEvent[];
  baseline?: any;
  what_is_uncertain: string[];
  as_of?: string;
};

export type IClarityEngineResult = {
  active: boolean;
  identity: string;
  moment_type: ConfidenceCollapseMomentType;
  goal: string;
  sections: Record<string, string[]>;
  evidence_event_ids: string[];
  uncertainties: string[];
  rules_upheld: string[];
  confidence: "low" | "medium" | "high";
};

const COLLAPSE_PATTERNS: Record<ConfidenceCollapseMomentType, RegExp> = {
  medical_uncertainty: /\b(i don't know|not sure|what does|what if|could it be|is it (?:serious|important))\b/i,
  sudden_behavior_change: /\b(sudden|new|started|different from usual|not normal|never done this)\b/i,
  family_disagreement: /\b(family|sibling|brother|sister|disagree|someone said|but they said)\b/i,
  is_this_important: /\b(is this important|should I worry|is it serious|does it matter)\b/i,
  forgot_what_doctor_said: /\b(what did the doctor say|forgot|doctor said|physician mentioned|what was the plan)\b/i,
  something_feels_different: /\b(something feels|feels different|not right|off|wrong|something's not)\b/i,
};

export function detectConfidenceCollapseMoment(
  raw_input: string,
  _all_events: CanonicalCareEvent[],
): ConfidenceCollapseMomentType | null {
  for (const type of CONFIDENCE_COLLAPSE_MOMENT_TYPES) {
    if (COLLAPSE_PATTERNS[type].test(raw_input)) return type;
  }
  return null;
}

function buildSections(input: IClarityEngineInput): Record<string, string[]> {
  const sections: Record<string, string[]> = {
    what_changed: [],
    what_we_know: [],
    what_may_be_relevant: [],
    what_is_unclear: [],
    what_to_consider_next: [],
  };

  if (input.events_created.length > 0) {
    for (const e of input.events_created.slice(0, 3)) {
      sections.what_changed.push(`${e.extracted_type}: ${e.raw_input.slice(0, 120)}`);
    }
  } else if (input.raw_input.trim()) {
    sections.what_changed.push(`Reported: ${input.raw_input.trim().slice(0, 120)}`);
  }

  for (const f of input.baseline?.baseline_facts ?? []) {
    sections.what_we_know.push(`Baseline (${f.domain}): ${f.label}`);
  }
  for (const e of input.all_events.slice(-3)) {
    sections.what_we_know.push(`Prior: ${e.extracted_type} — ${e.raw_input.slice(0, 80)}`);
  }
  if (sections.what_we_know.length === 0) {
    sections.what_we_know.push("Limited prior context — this may be the first observation.");
  }

  for (const d of input.baseline?.deviations ?? []) {
    sections.what_may_be_relevant.push(`Difference from usual: ${d.observation}`);
  }
  for (const h of (input as any).behavior?.hypotheses.slice(0, 2) ?? []) {
    sections.what_may_be_relevant.push(`Possible connection: ${h.interpretation}`);
  }
  if (sections.what_may_be_relevant.length === 0) {
    sections.what_may_be_relevant.push("No strong connections yet — more context would help.");
  }

  for (const u of input.what_is_uncertain.slice(0, 3)) {
    sections.what_is_unclear.push(u);
  }
  if (sections.what_is_unclear.length === 0) {
    sections.what_is_unclear.push("What specifically feels unclear to you?");
  }

  sections.what_to_consider_next.push("When did this begin?");
  sections.what_to_consider_next.push("Has this happened before?");
  sections.what_to_consider_next.push("What responses have helped previously?");
  for (const q of input.what_is_uncertain.slice(0, 2)) {
    sections.what_to_consider_next.push(`Clarify: ${q}`);
  }

  return sections;
}

export function processIClarityRequest(input: IClarityEngineInput): IClarityEngineResult {
  const asOf = input.as_of ?? new Date().toISOString();
  const sections = buildSections(input);
  const evidenceEventIds = input.events_created.map((e) => e.id);

  const clarityMomentInput: ProcessMomentOfNeedInput = {
    raw_input: input.raw_input,
    events_created: input.events_created,
    all_events: input.all_events,
    baseline: input.baseline,
    care_reality_profile: undefined,
    care_context_diff: undefined,
    behavior: undefined,
    what_is_uncertain: input.what_is_uncertain,
    as_of: asOf,
  };
  const momentResult = processMomentOfNeed(clarityMomentInput);

  return {
    active: true,
    identity: I_NEED_CLARITY_IDENTITY,
    moment_type: input.collapse_type,
    goal: COLLAPSE_MOMENT_GOALS[input.collapse_type],
    sections,
    evidence_event_ids: evidenceEventIds,
    uncertainties: input.what_is_uncertain,
    rules_upheld: [...CONFIDENCE_COLLAPSE_BOUNDARIES.is],
    confidence: momentResult.confidence,
  };
}

export function buildIClaritySections(input: IClarityEngineInput): Record<string, string[]> {
  return buildSections(input);
}

export function projectIClarityToMomentOfNeed(
  result: IClarityEngineResult,
): MomentOfNeedResult {
  return processMomentOfNeed({
    raw_input: result.sections.what_changed.join("; ") || "I need clarity",
    events_created: [],
    all_events: [],
    baseline: undefined,
    care_reality_profile: undefined,
    care_context_diff: undefined,
    behavior: undefined,
    what_is_uncertain: result.uncertainties,
    as_of: new Date().toISOString(),
  });
}

export function projectIClarity(truth: any): IClarityEngineResult {
  const collapseType = detectConfidenceCollapseMoment(
    truth.what_changed?.join("; ") ?? "",
    [],
  ) ?? "something_feels_different";
  return processIClarityRequest({
    raw_input: truth.what_changed?.join("; ") ?? "",
    collapse_type: collapseType,
    events_created: [],
    all_events: [],
    what_is_uncertain: [],
  });
}

export type { ConfidenceCollapseSupportBrief };