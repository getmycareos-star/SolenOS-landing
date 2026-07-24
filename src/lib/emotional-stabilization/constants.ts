export type EmotionalStabilizationViolationCode =
  | "missing_emotional_acknowledgment"
  | "therapeutic_simulation"
  | "dependency_framing"
  | "emotional_exaggeration"
  | "factual_only_on_distress";

export const EMOTIONAL_STABILIZATION_VIOLATION_CODES: readonly EmotionalStabilizationViolationCode[] =
  [
    "missing_emotional_acknowledgment",
    "therapeutic_simulation",
    "dependency_framing",
    "emotional_exaggeration",
    "factual_only_on_distress",
  ] as const;

/** Layer 1 — brief grounded acknowledgment markers. */
export const EMOTIONAL_ACKNOWLEDGMENT_MARKERS =
  /\b(makes sense to feel|understandable to feel|can feel overwhelming|feel worried|feel stressed|feel unsettled|feel overwhelmed|many .* feel|it's understandable|it is understandable|this can feel)\b/i;

export const FORBIDDEN_THERAPEUTIC_PATTERNS = [
  /\bi'?m here for you\b/i,
  /\bi'?m always here\b/i,
  /\byou are not alone\b/i,
  /\byou're not alone\b/i,
  /\beverything will be okay\b/i,
  /\beverything is going to be okay\b/i,
  /\byou can lean on me\b/i,
  /\bi know exactly how you feel\b/i,
  /\blean on me\b/i,
] as const;

export const FORBIDDEN_DEPENDENCY_PATTERNS = [
  /\b(count on me|depend on me|i'?ll always be|always here for you)\b/i,
] as const;

export const EMOTIONAL_EXAGGERATION_PATTERNS = [
  /\b(deeply devastated|completely shattered|utterly hopeless|totally alone)\b/i,
] as const;

/** Max characters for acknowledgment portion (first sentence) when emotional input present. */
export const MAX_EMOTIONAL_ACKNOWLEDGMENT_CHARS = 140;

export interface EmotionalStabilizationResult {
  valid: boolean;
  violations: EmotionalStabilizationViolationCode[];
  emotional_input: boolean;
}
