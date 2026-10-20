export const COGNITIVE_LOAD_REDUCTION_IDENTITY =
  "a deterministic cognitive decomposition engine that converts unstructured caregiver input into fixed semantic roles under uncertainty";

export const COGNITIVE_LOAD_REDUCTION_ONE_LINE_TRUTH =
  "In SolenOS, clarity is created by separating meaning into strict, non-overlapping cognitive roles — not by adding intelligence or interpretation";

export const COGNITIVE_LOAD_REDUCTION_SUCCESS_METRIC =
  "User cognitive load decreases immediately after output — instant understanding with no re-reading.";

export const COGNITIVE_LOAD_REDUCTION_FAILURE_MODEL =
  "SolenOS fails when any inferred information appears, sections overlap in meaning, interpretation expands beyond input, prioritization includes reasoning, explanation leaks outside what_is_happening, or output feels conversational.";

export const COGNITIVE_LOAD_STRICT_SCHEMA = [
  "what_is_happening",
  "what_matters_now",
  "what_to_ask_next",
  "risk_level",
  "what_can_wait",
  "follow_up_items",
] as const;

export const COGNITIVE_LOAD_VALIDATION_PIPELINE = [
  "JSON schema validation",
  "Input grounding validation",
  "No-inference validation",
  "Semantic role isolation check",
  "Uncertainty separation check",
  "Urgency classification check",
  "Deterministic consistency check",
  "Cognitive load minimization check",
] as const;
