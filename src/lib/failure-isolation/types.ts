/**
 * Failure-isolation categories — exactly one per failure event.
 * Priority order for fixes: model → prompt → ux → input
 */
export type FailureCategory = "model" | "prompt" | "ux" | "input";

export type FailureSeverity = "critical" | "high" | "low";

export const FAILURE_PRIORITY_ORDER: FailureCategory[] = [
  "model",
  "prompt",
  "ux",
  "input",
];

export const FAILURE_SEVERITY: Record<FailureCategory, FailureSeverity> = {
  model: "critical",
  prompt: "critical",
  ux: "high",
  input: "low",
};

export interface IsolatedFailure {
  category: FailureCategory;
  severity: FailureSeverity;
  description: string;
}

export function createIsolatedFailure(
  category: FailureCategory,
  description: string,
): IsolatedFailure {
  return {
    category,
    severity: FAILURE_SEVERITY[category],
    description,
  };
}

/** MVP validation metrics — product truth, not engineering telemetry. */
export const MVP_VALIDATION_CRITERIA = {
  comprehension_seconds: 10,
  cognitive_load_reduced: true,
  voluntary_return: true,
} as const;

/** Changes must improve one of these — otherwise invalid per spec. */
export const VALID_CHANGE_TARGETS = [
  "structural_correctness",
  "output_clarity",
  "cognitive_load_reduction",
  "validation_stability",
] as const;

export type ValidChangeTarget = (typeof VALID_CHANGE_TARGETS)[number];
