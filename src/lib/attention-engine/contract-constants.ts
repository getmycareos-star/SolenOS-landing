/**
 * Attention Engine — Behavioral Specification v1.
 * SolenOS IS: Caregiver Load Detection and Attention Prioritization System.
 * NOT: medical advisor, dementia diagnosis, care-plan generator.
 */

export const ATTENTION_ENGINE_IDENTITY =
  "Attention Engine classifies situations into Now / Watch / Later from load signals and safety — never medical diagnosis";

export const ATTENTION_ENGINE_ONE_LINE_TRUTH =
  "What matters now? What can wait? What might become serious? How overloaded am I becoming?";

export const ATTENTION_ENGINE_PIPELINE_POSITION =
  "Caregiver Load Engine → ATTENTION ENGINE → Priority Engine → Decision → Behavioral Response shaping";

export const BEHAVIORAL_SPEC_V1_PRINCIPLES = [
  "caregiver_load_detection_not_medical_advice",
  "attention_prioritization_now_watch_later",
  "load_aware_framing_over_education",
  "calm_non_alarming_copy",
  "progressive_dependency_not_dementia_diagnosis",
] as const;

export const BEHAVIORAL_SPEC_ANTI_PATTERNS = [
  "dementia explanations or disease education when load signals present",
  "ten tips or care plan generation as primary output",
  "symptom checker or medical diagnosis framing",
  "alarming or panic-inducing language",
  "modeling dementia medically instead of caregiver overload",
] as const;

/**
 * B2B2C future note — document only, no MVP build.
 * Caregiver Risk Infrastructure for employers/insurers: burnout, productivity,
 * absenteeism detection from aggregated load signals.
 */
export const B2B2C_FUTURE_NOTE =
  "Future B2B2C: Caregiver Risk Infrastructure — aggregate burnout/load tiers for employer and insurer partners. Not MVP.";

export const ATTENTION_CLASS_HIT = 0.4;

/** Class A — safety, wandering, sudden change, acute confusion */
export const ATTENTION_CLASS_A_PATTERNS = {
  wandering: [
    /\b(wander(?:ing|ed|s)?|left (?:the )?(?:house|home|building)|got lost|missing since|elopement)\b/i,
    /\b(afraid (?:he|she|they) will wander|wandering risk|door alarm)\b/i,
  ],
  suddenChange: [
    /\b(sudden(?:ly)? (?:change|confusion|decline|worse)|overnight change|changed overnight|much worse today)\b/i,
    /\b(acute (?:change|decline|confusion)|rapid(?:ly)? (?:worsening|decline|change))\b/i,
  ],
  acuteConfusion: [
    /\b(severe confusion|acute confusion|doesn't know where (?:he|she|they) (?:is|are)|not recognizing)\b/i,
    /\b(agitated and confused|suddenly confused|new confusion)\b/i,
  ],
  safety: [
    /\b(fell and (?:hit|hurt|injured)|uncontrolled bleeding|can't wake|not breathing|choking)\b/i,
    /\b(emergency|911|call (?:an )?ambulance|needs (?:immediate )?(?:help|attention))\b/i,
  ],
} as const;

/** Class B — increasing repetition, gradual behavior change */
export const ATTENTION_CLASS_B_PATTERNS = {
  repetition: [
    /\b(same (?:thing|question|concern)|every (?:five|few) minutes|answered (?:ten|the same) times?)\b/i,
    /\b(asks? the same|keeps? asking|over and over|again and again|repeatedly)\b/i,
  ],
  gradualChange: [
    /\b(getting (?:worse|harder)|more (?:confused|agitated|dependent)|gradual(?:ly)? (?:change|decline))\b/i,
    /\b(each (?:week|month) (?:is )?harder|slowly (?:worsening|declining)|increasing(?:ly)?)\b/i,
  ],
} as const;

/** Class C — non-urgent tasks, routine activities */
export const ATTENTION_CLASS_C_PATTERNS = {
  routine: [
    /\b(routine|usual day|normal day|regular schedule|nothing urgent|no rush)\b/i,
    /\b(can wait|not urgent|whenever|no hurry|later this week)\b/i,
  ],
  nonUrgent: [
    /\b(appointment (?:next week|later)|schedule (?:when|later)|research (?:when|later))\b/i,
    /\b(wondering about|curious about|general question|just checking)\b/i,
  ],
} as const;

export const BURNOUT_TIER_THRESHOLDS = {
  low: 0.35,
  moderate: 0.55,
  high: 0.75,
} as const;
