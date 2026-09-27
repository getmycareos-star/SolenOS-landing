/**
 * Care Moment Engine — Phase 2 in-the-moment understanding.
 * Bridges to moment-of-need-engine; NOT emergency medical tool, NOT chatbot.
 */

import {
  CARE_MOMENT_RESPONSE_FRAMEWORK,
  CARE_MOMENT_IDENTITY,
  CARE_MOMENT_BOUNDARIES,
  CARE_MOMENT_TO_MOMENT_OF_NEED_MAP,
  type CareMomentBrief,
  type CareMomentResponseSection,
} from "./care-moment";
import { processMomentOfNeed, type ProcessMomentOfNeedInput, type MomentOfNeedResult } from "../moment-of-need-engine";
import { buildEvidenceObject, buildEvidencedConclusion, type EvidenceObject } from "../evidence-preservation";
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

function buildSections(input: CareMomentEngineInput): Record<string, string[]> {
  const sections: Record<string, string[]> = {
    what_changed: [],
    what_do_we_know: [],
    why_might_this_matter: [],
    what_should_be_remembered: [],
    what_questions_to_consider: [],
  };

  if (input.events_created.length > 0) {
    for (const e of input.events_created.slice(0, 3)) {
      sections.what_changed.push(`${e.extracted_type}: ${e.raw_input.slice(0, 120)}`);
    }
  } else if (input.raw_input.trim()) {
    sections.what_changed.push(`Observation: ${input.raw_input.trim().slice(0, 120)}`);
  }

  for (const d of input.baseline?.baseline_facts ?? []) {
    sections.what_do_we_know.push(`Baseline (${d.domain}): ${d.label}`);
  }
  for (const e of input.care_reality_profile?.profile?.sections?.what_helped ?? []) {
    sections.what_do_we_know.push(`Previously helped: ${e.label}`);
  }
  for (const p of input.behavior?.longitudinal_patterns ?? []) {
    sections.what_do_we_know.push(`Pattern: ${p.label}`);
  }

  for (const insight of input.care_reality_profile?.profile?.relationship_insights ?? []) {
    sections.why_might_this_matter.push(insight);
  }
  for (const h of input.behavior?.hypotheses.slice(0, 2) ?? []) {
    sections.why_might_this_matter.push(`Possible context: ${h.interpretation}`);
  }
  if (sections.why_might_this_matter.length === 0) {
    sections.why_might_this_matter.push("More context would help understand significance.");
  }

  for (const e of input.all_events.slice(-3)) {
    sections.what_should_be_remembered.push(`${e.extracted_type}: ${e.raw_input.slice(0, 80)}`);
  }

  for (const item of input.behavior?.investigation_checklist.slice(0, 3) ?? []) {
    sections.what_questions_to_consider.push(item.item);
  }
  for (const q of input.what_is_uncertain.slice(0, 2)) {
    sections.what_questions_to_consider.push(`Clarify: ${q}`);
  }
  if (sections.what_questions_to_consider.length === 0) {
    sections.what_questions_to_consider.push("What else has changed recently?");
  }

  return sections;
}

function buildEvidenceObjects(input: CareMomentEngineInput): EvidenceObject[] {
  const objs: EvidenceObject[] = [];
  if (input.events_created.length > 0) {
    objs.push(buildEvidenceObject({
      event_ids: input.events_created.map((e) => e.id),
      timeline_labels: input.events_created.map((e) => `${e.extracted_type}: ${e.raw_input.slice(0, 60)}`),
      observation_type: "direct",
      confidence_score: 0.7,
      source_reliability_score: 0.8,
      reasoning_summary: `Care moment captured from ${input.events_created.length} new observation(s)`,
      what_would_increase_confidence: ["Additional caregiver observations", "Clinical confirmation if safety-relevant"],
    }));
  }
  return objs;
}

export function processCareMoment(input: CareMomentEngineInput): CareMomentEngineResult {
  const asOf = input.as_of ?? new Date().toISOString();
  const triggered = input.events_created.length > 0 || input.raw_input.trim().length >= 10;

  if (!triggered) {
    return {
      active: false,
      triggered: false,
      identity: CARE_MOMENT_IDENTITY,
      sections: {
        what_changed: [],
        what_do_we_know: [],
        why_might_this_matter: [],
        what_should_be_remembered: [],
        what_questions_to_consider: [],
      },
      evidence_objects: [],
      uncertainties: [],
      care_event_ids: [],
      confidence: "low",
      rules_upheld: [...CARE_MOMENT_BOUNDARIES.must],
    };
  }

  const sections = buildSections(input);
  const evidenceObjects = buildEvidenceObjects(input);

  const momentInput: ProcessMomentOfNeedInput = {
    raw_input: input.raw_input,
    events_created: input.events_created,
    all_events: input.all_events,
    baseline: input.baseline,
    care_reality_profile: input.care_reality_profile,
    care_context_diff: undefined,
    behavior: input.behavior,
    what_is_uncertain: input.what_is_uncertain,
    as_of: asOf,
  };
  const momentResult = processMomentOfNeed(momentInput);

  const confidence = momentResult.confidence;
  const careEventIds = input.events_created.map((e) => e.id);

  return {
    active: true,
    triggered: true,
    identity: CARE_MOMENT_IDENTITY,
    sections,
    evidence_objects: evidenceObjects,
    uncertainties: input.what_is_uncertain,
    care_event_ids: careEventIds,
    confidence,
    rules_upheld: [...CARE_MOMENT_BOUNDARIES.must],
  };
}

export function buildCareMomentResponseSections(
  input: CareMomentEngineInput,
): Record<string, string[]> {
  return buildSections(input);
}

export function projectCareMomentToMomentOfNeed(
  careMoment: CareMomentEngineResult,
): MomentOfNeedResult {
  return processMomentOfNeed({
    raw_input: careMoment.sections.what_changed.join("; ") || "Care moment captured",
    events_created: [],
    all_events: [],
    baseline: undefined,
    care_reality_profile: undefined,
    care_context_diff: undefined,
    behavior: undefined,
    what_is_uncertain: careMoment.uncertainties,
    as_of: new Date().toISOString(),
  });
}

export function projectCareMoment(truth: any): CareMomentEngineResult {
  return processCareMoment({
    raw_input: truth.what_changed?.join("; ") ?? "",
    events_created: [],
    all_events: [],
    what_is_uncertain: [],
  });
}

export type { CareMomentBrief };