/**
 * MVP Response Behavior — Care Reality Object + reasoning pipeline contract.
 * SoT: docs/02-product/solenos-mvp-response-behavior.md
 *
 * Examples in docs are EVALUATION ONLY — never keyword→template maps.
 */

import type { CareRealityExtractionResult } from "../care-reality-extraction";
import { extractCareRealityFromText } from "../care-reality-extraction";
import type { CareRealitySituationModel } from "../care-reality-intelligence/situation-model";
import { buildCareRealitySituationModel } from "../care-reality-intelligence/situation-model";
import type { ActiveCareSituation } from "../active-care-situation/types";
import type { CareRealityState } from "../care-reality-state/types";

export const MVP_RESPONSE_BEHAVIOR_PURPOSE =
  "Convert messy caregiver input into a Care Reality Object, then orient — never keyword templates or medical advice.";

/** Pipeline steps — every input. */
export const MVP_RESPONSE_PIPELINE = [
  "identify_care_recipient",
  "identify_event_or_observation",
  "identify_change",
  "connect_to_care_reality",
  "identify_unknowns",
  "generate_understanding_response",
] as const;

export type MvpResponsePipelineStep = (typeof MVP_RESPONSE_PIPELINE)[number];

/** Engine-only confidence — never % in caregiver UI. */
export type CareRealityObjectConfidence = "low" | "medium" | "high";

/**
 * Structured Care Reality Object — the MVP breakthrough.
 * Response language must project from this, not from raw echo or scenario templates.
 */
export type CareRealityObject = {
  person: string | null;
  events: Array<{ description: string; timeframe: string | null }>;
  observations: Array<{ description: string }>;
  changes_detected: string[];
  decisions: Array<{ what: string; why: string | null }>;
  outcomes: Array<{ description: string }>;
  relationships: string[];
  unknowns: string[];
  confidence: CareRealityObjectConfidence;
  /** True when prior pattern is not yet known — never invent baseline. */
  prior_pattern_unknown: boolean;
};

/** Forbidden product conclusions — structural bans, not clinical keyword banks. */
export const MVP_BEHAVIOR_HARD_NEVER = [
  /\bthis means (?:dementia|alzheimer)/i,
  /\bdementia is (?:worsening|progressing)\b/i,
  /\byou (?:have|are experiencing) (?:burnout|depression|anxiety)\b/i,
  /\bi understand how you feel\b/i,
  /\bi'?m here for you\b/i,
  /\bhere is (?:a |your )?summary of (?:your )?document\b/i,
  /\byou should (?:take|start|stop) (?:this |the )?medication\b/i,
] as const;

function confidenceFromExtraction(
  extraction: CareRealityExtractionResult,
): CareRealityObjectConfidence {
  const n =
    extraction.observations.length +
    extraction.events.length +
    extraction.decisions.length;
  if (n >= 3) return "high";
  if (n >= 1) return "medium";
  return "low";
}

/** Map extraction result → Care Reality Object (no situation required). */
export function careRealityObjectFromExtraction(
  extraction: CareRealityExtractionResult,
  person: string | null = null,
  rawText?: string,
): CareRealityObject {
  const beforeAfter =
    extraction.observations.some((o) =>
      /\b(?:used to|before|normally|usually)\b/i.test(o.description + o.raw_fragment),
    ) ||
    extraction.events.some((e) =>
      /\b(?:after|since|now)\b/i.test(e.description + e.raw_fragment),
    );

  const changes: string[] = [];
  if (beforeAfter) {
    for (const o of extraction.observations.slice(0, 2)) {
      changes.push(o.description);
    }
  }

  let observations = extraction.observations.slice(0, 5).map((o) => ({
    description: o.description,
  }));
  let events = extraction.events.slice(0, 5).map((e) => ({
    description: e.description,
    timeframe: e.time,
  }));

  // Never leave a non-empty capture with an empty object — hold a thin observation
  // from the source text (evidence), not a scenario template.
  const trimmed = rawText?.trim() ?? "";
  if (
    observations.length === 0 &&
    events.length === 0 &&
    extraction.decisions.length === 0 &&
    trimmed.length >= 12
  ) {
    const snippet = trimmed.length > 160 ? `${trimmed.slice(0, 157)}…` : trimmed;
    observations = [{ description: snippet }];
  }

  return {
    person,
    events,
    observations,
    changes_detected: changes,
    decisions: extraction.decisions.slice(0, 5).map((d) => ({
      what: d.description,
      why: d.why,
    })),
    outcomes: extraction.outcomes.slice(0, 5).map((o) => ({
      description: o.description,
    })),
    relationships: extraction.relationships.slice(0, 5).map((r) => r.evidence_note),
    unknowns: extraction.unknowns.slice(0, 5).map((u) => u.question),
    confidence: confidenceFromExtraction(extraction),
    prior_pattern_unknown: changes.length === 0,
  };
}

/**
 * Project Care Reality Situation Model → Care Reality Object.
 */
export function toCareRealityObject(
  model: CareRealitySituationModel,
): CareRealityObject {
  const priorUnknown =
    !model.baseline?.trim() && model.observed_changes.length === 0;
  return {
    person: model.person,
    events: model.events.map((description) => ({
      description,
      timeframe: null,
    })),
    observations: model.observed_changes.length
      ? model.observed_changes.map((description) => ({ description }))
      : model.timeline.slice(0, 3).map((description) => ({ description })),
    changes_detected: model.observed_changes.slice(0, 5),
    decisions: model.decisions.map((what) => ({ what, why: null })),
    outcomes: model.outcomes.map((description) => ({ description })),
    relationships: [],
    unknowns: model.unknowns.slice(0, 5),
    confidence: model.confidence,
    prior_pattern_unknown: priorUnknown,
  };
}

/**
 * Build Care Reality Object from messy text (+ optional held situation).
 * General extraction — never example-specific branches.
 */
export function buildCareRealityObject(params: {
  rawText: string;
  situation?: ActiveCareSituation | null;
  crs?: CareRealityState | null;
  careKey?: string;
  extraction?: CareRealityExtractionResult | null;
  person?: string | null;
}): CareRealityObject {
  const extraction =
    params.extraction ??
    extractCareRealityFromText({
      rawText: params.rawText,
      source: "caregiver",
    });

  if (params.situation) {
    const model = buildCareRealitySituationModel({
      latestRawText: params.rawText,
      situation: params.situation,
      crs: params.crs ?? null,
      careKey: params.careKey,
    });
    const fromModel = toCareRealityObject(model);
    // Fill thin model fields from extraction
    if (fromModel.events.length === 0 && extraction.events.length > 0) {
      fromModel.events = extraction.events.slice(0, 5).map((e) => ({
        description: e.description,
        timeframe: e.time,
      }));
    }
    if (fromModel.observations.length === 0 && extraction.observations.length > 0) {
      fromModel.observations = extraction.observations.slice(0, 5).map((o) => ({
        description: o.description,
      }));
    }
    if (fromModel.decisions.length === 0 && extraction.decisions.length > 0) {
      fromModel.decisions = extraction.decisions.slice(0, 5).map((d) => ({
        what: d.description,
        why: d.why,
      }));
    }
    if (fromModel.unknowns.length === 0 && extraction.unknowns.length > 0) {
      fromModel.unknowns = extraction.unknowns.slice(0, 5).map((u) => u.question);
    }
    if (
      fromModel.relationships.length === 0 &&
      extraction.relationships.length > 0
    ) {
      fromModel.relationships = extraction.relationships
        .slice(0, 5)
        .map((r) => r.evidence_note);
    }
    return fromModel;
  }

  const object = careRealityObjectFromExtraction(
    extraction,
    params.person ?? null,
    params.rawText,
  );

  // Discourse: caregiver uncertainty → preserve unknown (never invent answers)
  if (
    object.unknowns.length === 0 &&
    /\b(?:don'?t know|not sure|unclear|confused about|can'?t remember)\b/i.test(
      params.rawText,
    )
  ) {
    object.unknowns = ["What specifically is unclear or missing right now?"];
  }

  return object;
}

export type ReasoningPatternEval = {
  passed: boolean;
  failures: string[];
  object: CareRealityObject;
};

/**
 * Structural evaluation of reasoning — never exact wording match to doc examples.
 * Use novel paraphrases in verify scripts.
 */
export function evaluateCareRealityReasoning(params: {
  rawText: string;
  object: CareRealityObject;
  /** When true, expect change or explicit prior-unknown (not fake baseline). */
  expectChangeOrPriorUnknown?: boolean;
  caregiverFacingBlob?: string;
}): ReasoningPatternEval {
  const failures: string[] = [];
  const { object, rawText } = params;
  const blob = (params.caregiverFacingBlob ?? "").toLowerCase();

  const hasSubstance =
    object.events.length > 0 ||
    object.observations.length > 0 ||
    object.changes_detected.length > 0 ||
    object.decisions.length > 0 ||
    Boolean(object.person) ||
    rawText.trim().length < 12;

  if (!hasSubstance && rawText.trim().length >= 12) {
    failures.push(
      "Care Reality Object empty — no event/observation/change extracted",
    );
  }

  if (params.expectChangeOrPriorUnknown !== false) {
    const hasChangeSignal =
      object.changes_detected.length > 0 ||
      object.prior_pattern_unknown ||
      object.events.length > 0 ||
      object.observations.length > 0;
    if (!hasChangeSignal && rawText.trim().length >= 20) {
      failures.push("Missing change signal or prior-unknown flag");
    }
  }

  if (
    object.unknowns.length === 0 &&
    /don'?t know|unclear|confused about|not sure/i.test(rawText) &&
    rawText.trim().length >= 40
  ) {
    failures.push("Caregiver signaled uncertainty but unknowns empty");
  }

  for (const pattern of MVP_BEHAVIOR_HARD_NEVER) {
    if (blob && pattern.test(blob)) {
      failures.push(`Hard-never pattern in caregiver output: ${pattern}`);
    }
  }

  return {
    passed: failures.length === 0,
    failures,
    object,
  };
}

/**
 * Illustration phrases that must NOT appear as product if/else templates in src/.
 * Detection of these strings as branch conditions = failure.
 */
export const EXAMPLE_MUST_NOT_BE_PRODUCT_BRANCHES = [
  "asking where his wife is every evening",
  "old medication list still has the previous ones",
  "sister thinks mom is fine living alone",
  "emergency room twice this month",
  "walked everywhere by herself",
  "forgets meals and leaves food sitting",
  "decided not to put mom in a facility",
  "doctor says dad should walk more",
  "hiding things from her",
  "live three hours away and my brother",
] as const;
