/** SolenOS Cognitive Compression Engine — Final System Spec (immutable identity). */

export const COGNITIVE_COMPRESSION_SYSTEM_TYPE =
  "a deterministic cognitive compression engine for irreversible, high-uncertainty responsibility contexts (ops analyze path under SolenOS / Living Care Record identity)";

/** Canonical alias for final system spec exports. */
export const SYSTEM_TYPE = COGNITIVE_COMPRESSION_SYSTEM_TYPE;

export const COGNITIVE_COMPRESSION_ONE_LINE_TRUTH =
  "SolenOS reduces cognitive and emotional load from uncertainty and responsibility loops — it does not deepen understanding, expand reasoning, optimize decisions, generate plans, or simulate alternatives.";

/** Canonical alias for final system spec exports. */
export const ONE_LINE_TRUTH = COGNITIVE_COMPRESSION_ONE_LINE_TRUTH;

export const COGNITIVE_COMPRESSION_SUCCESS_DEFINITION =
  "Cognitive and emotional load from uncertainty and responsibility loops decreases immediately after output — without deepening understanding, expanding reasoning, or reopening guilt replay.";

/** Canonical alias for final system spec exports. */
export const SUCCESS_DEFINITION = COGNITIVE_COMPRESSION_SUCCESS_DEFINITION;

export const COGNITIVE_COMPRESSION_PRODUCT_GUARANTEE =
  "ONLY reduce cognitive/emotional load from uncertainty and responsibility loops";

export const COGNITIVE_COMPRESSION_FORBIDDEN_USES = [
  "increase understanding depth",
  "expand reasoning",
  "optimize decisions",
  "generate plans",
  "simulate alternatives",
] as const;

export const PRIMARY_USER_PROBLEMS = [
  "uncertainty replay",
  "guilt reconstruction",
  "retrospective simulation",
  "inability to cognitively close decisions",
  "emotional reprocessing",
] as const;

export const CORE_TRANSFORMATIONS = [
  "COMPRESS UNCERTAINTY",
  "INTERRUPT GUILT REPLAY LOOPS",
  "SURFACE ONLY ACTION-RELEVANT CHANGE",
] as const;

/** Canonical alias — exactly three allowed operations. */
export const THREE_OPERATIONS = CORE_TRANSFORMATIONS;

export const FORBIDDEN_OPERATIONS = [
  ...COGNITIVE_COMPRESSION_FORBIDDEN_USES,
  "validate guilt narratives",
  "expand emotional analysis",
  "multi-path reasoning",
  "speculative branching",
  "alternative simulation",
] as const;

export const FORBIDDEN_SYSTEM_TYPES = [
  "chatbot",
  "assistant",
  "planner",
  "tracker",
  "decision engine",
  "care platform",
] as const;

/**
 * Total word count across all text fields by risk_level.
 * Runtime accepts legacy uppercase (LOW|MEDIUM|HIGH|CRITICAL) via normalizeRiskLevel;
 * canonical enum values are lowercase.
 */
export const VERBOSITY_TOTAL_WORD_LIMITS = {
  low: 80,
  medium: 80,
  high: 120,
  critical: 60,
} as const;

export const ANTI_REASSURANCE_FORBIDDEN = [
  "probably fine",
  "don't worry",
  "this is common",
  "false certainty",
] as const;
