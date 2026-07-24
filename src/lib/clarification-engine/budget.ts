import { CLARIFICATION_BUDGET } from "./contract-constants";
import type { ClarificationQuestion, UncertaintyLevel } from "./types";

export function applyClarificationBudget(
  questions: ClarificationQuestion[],
  level: UncertaintyLevel,
): { questions: ClarificationQuestion[]; budget_max: number; budget_used: number } {
  const budget_max = CLARIFICATION_BUDGET[level];
  const selected = questions.slice(0, budget_max);
  return {
    questions: selected,
    budget_max,
    budget_used: selected.length,
  };
}

export function estimateConfidenceShift(input: {
  missing_count: number;
  questions_selected: number;
  is_vague: boolean;
}): { before: number; after: number } {
  const before = Math.max(
    15,
    85 - input.missing_count * 12 - (input.is_vague ? 15 : 0),
  );
  const reductionPerQuestion = 12;
  const after = Math.min(
    95,
    before + input.questions_selected * reductionPerQuestion,
  );
  return { before: Math.round(before), after: Math.round(after) };
}
