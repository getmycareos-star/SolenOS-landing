import { CLARIFICATION_CATEGORIES, CLARIFICATION_TEMPLATES } from "./contract-constants";
import type { ClarificationCategory, ClarificationQuestion, MissingDimension } from "./types";

const DIMENSION_CATEGORY: Partial<Record<MissingDimension, ClarificationCategory>> = {
  timeline: "time",
  progression: "time",
  symptoms: "behavior",
  frequency: "behavior",
  severity: "severity",
  safety_impact: "severity",
  triggers: "change",
  medication_context: "medication",
  environment_context: "environment",
};

const DIMENSION_PRIORITY: Record<MissingDimension, number> = {
  timeline: 1,
  progression: 2,
  symptoms: 3,
  severity: 4,
  safety_impact: 5,
  frequency: 6,
  triggers: 7,
  medication_context: 8,
  environment_context: 9,
};

export function prioritizeClarificationQuestions(
  missingDimensions: MissingDimension[],
): ClarificationQuestion[] {
  const sorted = [...missingDimensions].sort(
    (a, b) => (DIMENSION_PRIORITY[a] ?? 99) - (DIMENSION_PRIORITY[b] ?? 99),
  );

  const questions: ClarificationQuestion[] = [];
  const seen = new Set<string>();

  for (const dimension of sorted) {
    let matched = false;
    for (const category of CLARIFICATION_CATEGORIES) {
      const t = CLARIFICATION_TEMPLATES[category].find((x) => x.dimension === dimension);
      if (!t || seen.has(t.question)) continue;
      seen.add(t.question);
      questions.push({
        id: `clq_${dimension}_${questions.length}`,
        question: t.question,
        category,
        dimension,
        rationale: t.rationale,
        priority_rank: DIMENSION_PRIORITY[dimension] ?? 99,
        uncertainty_reduction_score: Math.max(10, 35 - (DIMENSION_PRIORITY[dimension] ?? 10) * 3),
      });
      matched = true;
      break;
    }
    if (!matched) {
      const fallback = CLARIFICATION_TEMPLATES.change[0]!;
      if (!seen.has(fallback.question)) {
        seen.add(fallback.question);
        questions.push({
          id: `clq_${dimension}_${questions.length}`,
          question: fallback.question,
          category: "change",
          dimension,
          rationale: fallback.rationale,
          priority_rank: DIMENSION_PRIORITY[dimension] ?? 99,
          uncertainty_reduction_score: 20,
        });
      }
    }
  }

  return questions.sort((a, b) => a.priority_rank - b.priority_rank);
}
