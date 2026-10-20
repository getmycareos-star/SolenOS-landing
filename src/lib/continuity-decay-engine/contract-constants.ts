/** Continuity Decay Engine — confidence in CareContext freshness, not patient health. */



export const CONTINUITY_DECAY_IDENTITY =

  "SolenOS distinguishes reality, known reality, and confidence — never mistaking old information for current understanding.";



export const DECAY_ENGINE_BOUNDARY =

  "Model how trustworthy the CareContext remains over time — never infer health status or caregiver performance.";



export const DECAY_PROHIBITED = [

  "assume no update means no change",

  "fixed inactivity thresholds ignoring family rhythm",

  "generic nag reminders without context",

  "reset entire CareContext confidence on single confirmation",

  "conflate confidence with medical severity",

  "diagnose from stale information gaps",

  "hidden refresh reasoning",

] as const;



export const FRESHNESS_TIERS = ["long_lived", "medium_lived", "short_lived"] as const;



/** Days until confidence meaningfully decays — per information type. */

export const FRESHNESS_WINDOW_DAYS: Record<(typeof FRESHNESS_TIERS)[number], number> = {

  long_lived: 365,

  medium_lived: 60,

  short_lived: 7,

};



export const CONFIDENCE_GAP_THRESHOLD = 60;



export const DECAY_PIPELINE_STAGES = [

  "freshness_assessment",

  "object_confidence",

  "family_rhythm",

  "expected_follow_ups",

  "continuity_gaps",

  "refresh_planner",

  "priority_influence",

  "confidence_recovery",

] as const;



export const REFRESH_QUESTION_TEMPLATES = [

  "Has medication changed since your last update?",

  "Any falls or safety incidents?",

  "Any hospital visits or discharge changes?",

  "Any new symptoms or concerns?",

  "Has sleep or daily routine changed?",

  "Anything worrying you today?",

] as const;


