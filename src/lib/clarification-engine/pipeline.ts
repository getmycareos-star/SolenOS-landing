import {
  CLARIFICATION_DEFINING_PRINCIPLE,
  CLARIFICATION_ENGINE_IDENTITY,
} from "./contract-constants";
import { applyClarificationBudget, estimateConfidenceShift } from "./budget";
import {
  detectMissingDimensions,
  estimateUncertaintyLevel,
  isVagueInput,
} from "./detect-missing";
import { prioritizeClarificationQuestions } from "./prioritize-questions";
import { getAdaptiveHints } from "./store";
import type {
  ClarificationEngineResult,
  ClarificationQuestion,
  ProcessClarificationEngineInput,
} from "./types";
import {
  deriveExplicitUnknowns,
  clarificationTargetsFromUnknowns,
} from "../unknowns-engine";
import { DEFAULT_CLINICAL_PROFILE_ID } from "../clinical-profile";

export function processClarificationEngine(
  input: ProcessClarificationEngineInput,
): ClarificationEngineResult {
  const vague = isVagueInput(input.raw_input);
  const missing_dimensions = detectMissingDimensions({
    raw_input: input.raw_input,
    events_created: input.events_created,
    what_is_uncertain: input.what_is_uncertain,
  });

  const uncertainty_level = estimateUncertaintyLevel(missing_dimensions.length, vague);
  const prioritized = prioritizeClarificationQuestions(missing_dimensions);

  // Explicit Unknowns (disease-agnostic engine + clinical profile) drive purposeful questions.
  const eum = deriveExplicitUnknowns({
    known: input.events_created.map((e) => e.raw_input.slice(0, 80)),
    inferred: [],
    event_texts: [input.raw_input, ...input.events_created.map((e) => e.raw_input)],
    unresolved_clarifications: input.what_is_uncertain,
    related_care_event_ids: input.events_created.map((e) => e.id),
    clinical_profile_id: input.clinical_profile_id ?? DEFAULT_CLINICAL_PROFILE_ID,
  });
  const unknownTargets = clarificationTargetsFromUnknowns(eum.explicit_unknowns, 2);
  const fromUnknowns: ClarificationQuestion[] = unknownTargets.map((u) => ({
    id: `clq_unk_${u.unknown_id}`,
    question: u.clarification_question ?? `Can you clarify: ${u.missing_information}?`,
    category: "change",
    dimension: "progression",
    rationale: u.reason_it_matters,
    priority_rank: u.priority === "critical" ? 0 : 1,
    uncertainty_reduction_score: u.priority === "critical" ? 40 : 32,
  }));

  const merged = [...fromUnknowns, ...prioritized].filter(
    (q, idx, arr) => arr.findIndex((x) => x.question === q.question) === idx,
  );

  const { questions, budget_max } = applyClarificationBudget(merged, uncertainty_level);
  // 1–2 questions max unless caregiver later opts in for more.
  const cappedQuestions = questions.slice(0, Math.min(questions.length, 2));

  const confidence = estimateConfidenceShift({
    missing_count: missing_dimensions.length + unknownTargets.length,
    questions_selected: cappedQuestions.length,
    is_vague: vague,
  });

  const topic = vague ? "behavior_change" : input.events_created[0]?.extracted_type ?? "general";
  const adaptive_hints = getAdaptiveHints(input.caregiver_id, topic);

  const explain_why =
    cappedQuestions.length > 0
      ? [
          "I need a little more information because:",
          ...cappedQuestions.slice(0, 2).map((q) => `• ${q.rationale}`),
        ]
      : [];

  const abandonment_risk: ClarificationEngineResult["abandonment_risk"] =
    cappedQuestions.length >= 2 ? "medium" : "low";

  const triggered =
    uncertainty_level !== "low" ||
    missing_dimensions.length > 0 ||
    unknownTargets.length > 0 ||
    vague;

  return {
    triggered,
    uncertainty_level,
    confidence_before_pct: confidence.before,
    confidence_after_estimated_pct: confidence.after,
    uncertainty_reduced_estimate_pct: confidence.after - confidence.before,
    missing_dimensions,
    questions: cappedQuestions,
    budget_max: Math.min(budget_max, 2),
    budget_used: cappedQuestions.length,
    explain_why,
    adaptive_hints,
    abandonment_risk,
    success_metric: 'Caregiver feels: "It asked exactly what mattered."',
    defining_principle: CLARIFICATION_DEFINING_PRINCIPLE,
  };
}

export { CLARIFICATION_ENGINE_IDENTITY };
