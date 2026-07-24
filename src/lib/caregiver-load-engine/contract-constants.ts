/**
 * Caregiver Load Engine — master product module for Dementia Entry Market.
 * SolenOS IS: caregiver load detection and reduction — NOT education or disease management.
 */

export const CAREGIVER_LOAD_ENGINE_IDENTITY =
  "Caregiver Load Engine detects and reduces caregiver burden across five load dimensions";

export const CAREGIVER_LOAD_ENGINE_NORTH_STAR =
  "Primary unmet need = burden reduction, not more information. Primary user = caregiver.";

export const CAREGIVER_LOAD_ENGINE_ONE_LINE_TRUTH =
  "Caregiver language → signal detection → load scoring → burden statements → action reduction.";

export const CAREGIVER_LOAD_ENGINE_PIPELINE_POSITION =
  "Input → Context → CAREGIVER LOAD ENGINE → CLI / Emotional Load / Priority → Decision → burden-first output";

/** What SolenOS must NEVER become (MVP). */
export const CAREGIVER_LOAD_ENGINE_ANTI_PATTERNS = [
  "medical diagnosis or symptom checker as primary output",
  "disease encyclopedia or neuroscience education",
  "care plan generator as MVP deliverable",
  "clinical decision support as MVP deliverable",
  "leading with dementia tips when load is detected",
  "replacing caregiver with information dumps",
] as const;

export const CAREGIVER_LOAD_ENGINE_FORBIDDEN = [
  "LLM classification for MVP signal detection",
  "pathology education (plaques, tau, hippocampus)",
  "WHO statistics or end-of-life physiology in product logic",
  "mutating STATE or BELIEF from load engine",
  ...CAREGIVER_LOAD_ENGINE_ANTI_PATTERNS,
] as const;

export const LOAD_DIMENSION_HIT = 0.35;

export const LOAD_FIRST_EMOTIONAL_SCORE_THRESHOLD = 42;
export const LOAD_FIRST_BURNOUT_THRESHOLD = 0.48;
export const LOAD_FIRST_MIN_SIGNAL_CATEGORIES = 2;

export const DEPENDENCY_LOAD_PATTERNS = {
  supervision: [
    /\b(can'?t leave (?:him|her|them) alone|never alone|constant supervision|watch(?:ing)? (?:him|her|them) (?:all|every)|eyes on (?:him|her|them))\b/i,
    /\b(afraid (?:he|she|they) will wander|wandering risk|follow(?:s|ing) me everywhere|shadow(?:s|ing) me)\b/i,
    /\b(24\s*\/\s*7 supervision|always (?:watching|monitoring)|can'?t turn (?:my )?back)\b/i,
  ],
  assistance: [
    /\b(help(?:s|ing)? (?:him|her|them) (?:dress|eat|bathe|toilet|walk)|dress(?:ing)?|bathing|feeding|toileting)\b/i,
    /\b(can'?t (?:do|manage) (?:basic )?(?:daily|everyday)|activities of daily living|adl\b|needs help with everything)\b/i,
    /\b(lost (?:the )?ability to|can no longer|used to be able to|increasing(?:ly)? dependent)\b/i,
  ],
  increasingDependency: [
    /\b(getting worse|declining|more dependent|needs more help|less independent|losing skills)\b/i,
    /\b(each (?:week|month) (?:is )?harder|progressively|stage (?:is )?advancing)\b/i,
  ],
} as const;

export const BURNOUT_FORMULA_WEIGHTS = {
  emotional: 0.28,
  cognitive: 0.22,
  sleep: 0.24,
  uncertainty: 0.16,
  dependency: 0.1,
} as const;

export const BURNOUT_ACUTE_FLOOR = 0.72;
export const BURNOUT_RISING_THRESHOLD = 0.55;
export const BURNOUT_CRITICAL_THRESHOLD = 0.75;

export const ACTION_REDUCTION_LIMITS = {
  loadFirst: 1,
  acuteBurnout: 1,
  sleepProtection: 2,
  interactionLoad: 2,
  moderate: 3,
  normal: 4,
} as const;

export const LOAD_FIRST_MINIMAL_ACTION =
  "When ready, share one care detail that would help the picture — no multi-step plan required right now.";

export const LOAD_FIRST_SAFE_TO_IGNORE =
  "Non-urgent care technique research, appointment scheduling that can wait 24 hours, and any task that does not address immediate safety can be ignored today.";
