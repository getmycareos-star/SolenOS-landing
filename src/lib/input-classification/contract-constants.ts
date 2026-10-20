/** Input Classification Control System — surface-signal routing only. */

export const INPUT_CLASSIFICATION_IDENTITY =
  "a behavioral control system, not an interpretation or reasoning system";

export const INPUT_CLASSIFICATION_ONE_LINE_TRUTH =
  "In SolenOS, classification is not understanding — it is constraint selection for a deterministic cognitive decompression engine.";

export const INPUT_CLASSIFICATION_PIPELINE = [
  "INPUT RECEIVED",
  "INPUT CLASSIFICATION",
  "BEHAVIOR PROFILE SELECTION",
  "SAFETY CONSTRAINT APPLICATION",
  "STRUCTURED OUTPUT GENERATION",
] as const;

export const INPUT_MODES = [
  "medical_document",
  "emotional_narrative",
  "administrative_legal",
  "crisis_urgent",
] as const;

export type InputMode = (typeof INPUT_MODES)[number];

export const INPUT_CLASSIFICATION_FORBIDDEN = [
  "intelligence layer",
  "reasoning engine",
  "diagnostic system",
  "sentiment analyzer",
  "personalization model",
  "user profiling tool",
  "behavioral predictor",
] as const;

export const INPUT_CLASSIFICATION_ALLOWED_EFFECTS = [
  "verbosity limits",
  "escalation sensitivity",
  "uncertainty strictness",
  "prioritization aggressiveness",
  "emotional acknowledgment intensity",
] as const;

export const INPUT_CLASSIFICATION_FORBIDDEN_EFFECTS = [
  "change output schema",
  "change semantic structure",
  "change section meanings",
  "introduce new logic paths",
] as const;

export const LOW_CONFIDENCE_DEFAULT_MODE: InputMode = "emotional_narrative";

export const LOW_CONFIDENCE_THRESHOLD = 0.55;

export const INPUT_CLASSIFICATION_FAILURE_MODEL =
  "SolenOS fails when the classifier infers diagnosis, emotional state beyond explicit text, hidden intent, medical conditions, urgency from ambiguity, or constructs narratives.";
