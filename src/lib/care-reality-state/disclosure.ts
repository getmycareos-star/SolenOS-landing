import type { ProgressiveUnderstandingEffect } from "../progressive-understanding/contract-constants";
import type { UnderstandingStage } from "../active-care-situation/types";
import type {
  CareRealityDisclosureStage,
  ResponseEvolutionEvaluation,
} from "./types";
import { COGNITIVE_LOAD_PRIMARY_QUESTIONS } from "./contract-constants";

/**
 * Progressive disclosure for caregiver UI.
 * Soft notes stay early until 3+ observations — note #2 must not unlock Clarity.
 * Hard / high-consequence situations (incident theme) unlock Clarity faster once
 * more context is linked (≥2 obs) — oriented without panic UI or kind-template quizzes.
 */
export function disclosureStageFor(
  understandingStage: UnderstandingStage,
  observationCount: number,
  _patternLabel: string | null,
  opts?: {
    theme?: string | null;
    relation?: string | null;
    resolvedUncertaintyCount?: number;
  },
): CareRealityDisclosureStage {
  const hardSafetyFaster =
    opts?.theme === "incident" &&
    observationCount >= 2 &&
    (opts.relation === "answers_uncertainty" ||
      opts.relation === "updates_active" ||
      opts.relation === "adds_context" ||
      (opts.resolvedUncertaintyCount ?? 0) > 0);

  if (hardSafetyFaster) {
    if (observationCount >= 3 || understandingStage === "synthesizing") {
      return "established";
    }
    return "growing";
  }

  if (observationCount >= 4 || (understandingStage === "synthesizing" && observationCount >= 3)) {
    return "established";
  }
  if (observationCount >= 3) {
    return "growing";
  }
  return "early";
}

export function evaluateResponseEvolution(params: {
  relation: string;
  effect: ProgressiveUnderstandingEffect;
  resolvedCount: number;
  priorSummary: string | null;
  nextSummary: string | null;
  priorMatters: string | null;
  nextMatters: string | null;
  patternLabel: string | null;
  priorPattern: string | null;
}): ResponseEvolutionEvaluation {
  const {
    relation,
    effect,
    resolvedCount,
    priorSummary,
    nextSummary,
    priorMatters,
    nextMatters,
    patternLabel,
    priorPattern,
  } = params;

  const invalidates =
    effect === "invalidates_understanding" ||
    (Boolean(priorSummary) &&
      Boolean(nextSummary) &&
      priorSummary !== nextSummary &&
      (effect === "introduces_new_dimension" ||
        effect === "changes_what_matters" ||
        (Boolean(patternLabel) && patternLabel !== priorPattern)));

  return {
    updates_active_situation: relation !== "opens_new",
    answers_previous_uncertainty:
      resolvedCount > 0 || effect === "answers_uncertainty",
    strengthens_existing_hypothesis:
      effect === "strengthens_pattern" ||
      (Boolean(patternLabel) && patternLabel === priorPattern),
    introduces_new_pattern:
      Boolean(patternLabel) &&
      patternLabel !== priorPattern &&
      relation !== "opens_new",
    changes_what_matters_now:
      effect === "changes_what_matters" ||
      (Boolean(nextMatters) && nextMatters !== priorMatters && relation !== "opens_new"),
    invalidates_previous_understanding: invalidates,
  };
}

export function primaryScreenQuestionFor(
  disclosure: CareRealityDisclosureStage,
): string {
  switch (disclosure) {
    case "early":
      return COGNITIVE_LOAD_PRIMARY_QUESTIONS[0]!;
    case "growing":
      return COGNITIVE_LOAD_PRIMARY_QUESTIONS[1]!;
    case "established":
      return COGNITIVE_LOAD_PRIMARY_QUESTIONS[2]!;
    default:
      return COGNITIVE_LOAD_PRIMARY_QUESTIONS[3]!;
  }
}

/** Which LCR sections the caregiver UI may show at this disclosure stage. */
export type DisclosurePlan = {
  stage: CareRealityDisclosureStage;
  show_confirmation: boolean;
  show_what_changed: boolean;
  show_current_understanding: boolean;
  show_insufficiency: boolean;
  show_connection: boolean;
  show_situation_summary: boolean;
  show_pattern: boolean;
  show_what_matters_now: boolean;
  show_questions: boolean;
  max_questions: number;
  show_remembered: boolean;
  show_evidence: boolean;
  /**
   * Response Contract risk_level as human attention — never scores/%.
   * Early + low stays quiet; medium/high always may show.
   */
  show_attention_level: boolean;
  primary_question: string;
};

export function buildDisclosurePlan(
  stage: CareRealityDisclosureStage,
): DisclosurePlan {
  const primary_question = primaryScreenQuestionFor(stage);
  if (stage === "early") {
    return {
      stage,
      show_confirmation: true,
      show_what_changed: false,
      show_current_understanding: true,
      show_insufficiency: true,
      show_connection: false,
      show_situation_summary: false,
      show_pattern: false,
      show_what_matters_now: false,
      show_questions: true,
      max_questions: 1,
      show_remembered: false,
      show_evidence: false,
      // Low stays quiet on first capture; medium/high override in build-response.
      show_attention_level: false,
      primary_question,
    };
  }
  if (stage === "growing") {
    return {
      stage,
      show_confirmation: true,
      show_what_changed: true,
      show_current_understanding: true,
      show_insufficiency: false,
      show_connection: false,
      show_situation_summary: true,
      show_pattern: false,
      show_what_matters_now: true,
      show_questions: true,
      max_questions: 1,
      show_remembered: false,
      // L2 — light related evidence (UI still caps by maturity).
      show_evidence: true,
      show_attention_level: true,
      primary_question,
    };
  }
  return {
    stage,
    show_confirmation: true,
    show_what_changed: true,
    show_current_understanding: true,
    show_insufficiency: false,
    show_connection: false,
    show_situation_summary: true,
    show_pattern: false,
    show_what_matters_now: true,
    show_questions: true,
    max_questions: 1,
    show_remembered: true,
    show_evidence: true,
    show_attention_level: true,
    primary_question,
  };
}
