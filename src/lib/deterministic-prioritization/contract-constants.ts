/**
 * Deterministic Prioritization Engine — contract invariants.
 * Relationship to Priority Contract (ADR-003):
 * - Priority Contract ranks SITUATIONS (risk×time×completion).
 * - This engine ranks ISSUES extracted from unstructured input, then compresses
 *   into the fixed 6-field Decision Snapshot.
 * Both are deterministic; neither is LLM-overridable at formula/sort.
 */

export const DETERMINISTIC_PRIORITIZATION_IDENTITY =
  "SolenOS Deterministic Prioritization Engine — cognitive compression: caregiver chaos → fixed 6-field decision summary via inspectable score formula";

export const DETERMINISTIC_PRIORITIZATION_ONE_LINE_TRUTH =
  "Extract issues → HIGH_IMPACT signal → deterministic score → internal buckets → compress to exactly six public fields (never expose DO_FIRST / SAFE_TO_DELAY / WATCH_CLOSELY).";

export const DETERMINISTIC_PRIORITIZATION_PIPELINE_POSITION =
  "after Priority Engine facade / before final SolenOS assembly — compression owns Decision Snapshot text when engine runs";

export const DETERMINISTIC_PRIORITIZATION_FORBIDDEN = [
  "chatbot / conversational follow-ups",
  "journal, notes, reminders, or task-manager surfaces",
  "exposing DO_FIRST / SAFE_TO_DELAY / WATCH_CLOSELY in public JSON",
  "LLM overriding the priorityScore formula or sort order",
  "claiming medical, financial, or legal authority",
  "extra fields beyond the six Decision Snapshot keys in public compress output",
] as const;

/** Dimension weights — NON-NEGOTIABLE formula coefficients. */
export const SCORE_WEIGHTS = {
  safety: 3,
  time: 2,
  cost: 2,
  reversibility: 1,
  relief: 1,
} as const;

/** Max priorityScore = 3*3 + 3*2 + 3*2 + 3*1 + 3*1 */
export const MAX_PRIORITY_SCORE = 27;

/** Public Decision Snapshot keys — EXACTLY six. */
export const DECISION_SNAPSHOT_KEYS = [
  "what_is_happening",
  "what_matters_now",
  "what_to_ask_next",
  "risk_level",
  "what_can_wait",
  "follow_up_items",
] as const;

/** Forbidden public tokens (internal buckets must not leak). */
export const FORBIDDEN_PUBLIC_BUCKET_STRINGS = [
  "DO_FIRST",
  "SAFE_TO_DELAY",
  "WATCH_CLOSELY",
  "DO FIRST",
  "SAFE TO DELAY",
  "WATCH CLOSELY",
] as const;

/** Classification share targets. */
export const CLASSIFY_TOP_FRACTION = 0.2;
export const CLASSIFY_MIDDLE_FRACTION = 0.5;
export const CLASSIFY_BOTTOM_FRACTION = 0.3;

/** Max actions surfaced in what_matters_now. */
export const MAX_MATTERS_NOW_ACTIONS = 3;

/**
 * vs Priority Contract:
 * Deterministic Prioritization = issue-level ranking + schema compression.
 * Priority Contract = situation-level ranking (CRITICAL×NOW override).
 */
export const VS_PRIORITY_CONTRACT =
  "Deterministic Prioritization compresses extracted issues into the Decision Snapshot; Priority Contract still ranks Situations for DERIVED priority / action selection.";
