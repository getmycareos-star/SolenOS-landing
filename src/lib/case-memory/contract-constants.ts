/**
 * Case-centered care memory — contract invariants.
 * SolenOS product identity: Case is the product; chat is only an input channel.
 */

export const CASE_MEMORY_LAYER_IDENTITY =
  "Case-centered care memory infrastructure that generates structured decision snapshots grounded in selective case history — NOT conversation memory, chatbots, or reminder apps";

export const CASE_MEMORY_LAYER_ONE_LINE_TRUTH =
  "Memory → intervention compression: store facts/events/interventions/outcomes on Case; selectively recall; Pattern Response Policy compresses history into action.";

export const CASE_MEMORY_LAYER_PIPELINE_POSITION =
  "after Input / early Context — identify Case → extract facts → update Case/Timeline → selective recall → Pattern Response Policy → influence fixed output assembly (before or alongside Memory Influence)";

export const CASE_MEMORY_LAYER_FORBIDDEN = [
  "storing or retrieving conversations as primary memory",
  "dumping full case history into every response",
  "scanning entire timeline on every input",
  "narrating past event dates for education when strong pattern match (State C)",
  "becoming a chatbot, reminder app, task manager, document vault, or health prediction engine",
  "attaching primary continuity to user session instead of Case",
] as const;

/** Product identity anti-patterns — SolenOS is NOT these. */
export const CASE_MEMORY_ANTI_PATTERNS = [
  "chatbot",
  "AI assistant",
  "reminder app",
  "task manager",
  "document storage",
  "health prediction engine",
  "conversation memory",
] as const;

/** Fixed Decision Snapshot keys — NON-NEGOTIABLE. No extra fields. */
export const CASE_DECISION_SNAPSHOT_KEYS = [
  "what_is_happening",
  "what_matters_now",
  "what_to_ask_next",
  "risk_level",
  "what_can_wait",
  "follow_up_items",
] as const;

export const CASE_RISK_LEVELS = ["low", "medium", "high"] as const;

export const PATTERN_MATCH_STRENGTHS = ["none", "weak", "strong"] as const;

export const PATTERN_RESPONSE_STATES = ["A", "B", "C"] as const;

/** Top-N selective recall bound. */
export const CASE_SELECTIVE_RECALL_MAX = 5;

/** Minimum similarity score for weak pattern (State B). */
export const CASE_WEAK_MATCH_THRESHOLD = 0.35;

/** Minimum similarity score for strong pattern (State C). */
export const CASE_STRONG_MATCH_THRESHOLD = 0.72;

/**
 * Situation vs Case mapping (ADR-001 preserved).
 * Case = long-lived care recipient product entity.
 * Situation = runtime STATE root for active episodes (attaches to Case).
 */
export const CASE_VS_SITUATION_MAPPING = {
  caseRole: "long-lived care recipient product spine — Profile, Conditions, Timeline, Understanding",
  situationRole:
    "runtime STATE root entity (ADR-001) — active|resolved|archived episodes and demands attach to a Case",
  rule: "Everything durable attaches to Case; Situations are operational episodes on that Case",
} as const;

export const CASE_EVENT_TYPES = [
  "symptom",
  "behavior",
  "medication",
  "wandering",
  "agitation",
  "sleep",
  "fall",
  "appointment",
  "provider",
  "facility",
  "document",
  "intervention",
  "outcome",
  "general",
  "condition_noted",
] as const;

export const CASE_INPUT_WORKFLOW = [
  "New Input",
  "Identify Case",
  "Extract Facts",
  "Update Case",
  "Update Timeline",
  "Update Understanding",
] as const;
