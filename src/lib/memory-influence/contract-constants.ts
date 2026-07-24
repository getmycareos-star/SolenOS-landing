/** Memory Influence Layer — weighted inference influence, NOT truth storage. */

export const MEMORY_INFLUENCE_LAYER_IDENTITY =
  "a weighted inference influence store that biases interpretation before reasoning without storing truth, chat history, or merging Care Context or Care Profile";

export const MEMORY_INFLUENCE_LAYER_ONE_LINE_TRUTH =
  "Memory stores influence signals, not truth — it biases interpretation and never determines facts or overrides real-time context.";

export const MEMORY_INFLUENCE_LAYER_PIPELINE_POSITION =
  "MEMORY INFLUENCE LAYER — after Care Context Layer; before pre-reasoning grounding and Care Profile Layer";

export const MEMORY_INFLUENCE_LAYER_FORBIDDEN = [
  "truth storage or fact assertion",
  "chat history persistence",
  "database retrieval as conclusions",
  "merge Care Context events into memory",
  "merge Care Profile identity into memory",
  "override real-time situational context",
  "override explicit user input",
  "LLM prompt decoration with raw memory facts",
  "single-instance events as long-term memory",
] as const;

export const MEMORY_UPDATE_CONDITIONS = [
  "REPEATED_PATTERN",
  "USER_CONFIRMED",
  "HIGH_CONFIDENCE",
] as const;

export const MEMORY_CATEGORIES = [
  "identity",
  "patterns",
  "operational",
  "emotional",
] as const;

/** Minimum confidence for CONDITION C (system confidence > threshold). */
export const MEMORY_INFERENCE_CONFIDENCE_THRESHOLD = 0.75;

/** Minimum occurrences for CONDITION A (repeated pattern). */
export const MEMORY_SIGNAL_REPEAT_THRESHOLD = 3;

export const MEMORY_VISIBILITY_LEVELS = ["hidden", "summary", "full"] as const;
