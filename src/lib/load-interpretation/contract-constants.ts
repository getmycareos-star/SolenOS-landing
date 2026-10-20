/**
 * Load-First Interpretation — caregivers report load before they ask for care advice.
 * Heuristic detection on stress-normalizer path; NOT LLM classification (MVP).
 */

export const LOAD_INTERPRETATION_IDENTITY =
  "Load-First Interpretation recognizes caregiver burden from language patterns before care advice shaping";

export const LOAD_INTERPRETATION_ONE_LINE_TRUTH =
  "Caregivers report load (abuse, sleep loss, uncertainty, vigilance, burnout) — recognition-first, minimal intervention second.";

export const LOAD_INTERPRETATION_PIPELINE_POSITION =
  "Input → Classification → Care Context → LOAD INTERPRETATION → CLI / Emotional Load → … → Decision → (loadFirstMode) burden-first output shaping → Human Trust";

export const LOAD_INTERPRETATION_FORBIDDEN = [
  "LLM classification for MVP detection",
  "leading with dementia tips or disease education when loadFirstMode",
  "replacing Caregiver Psychological Load moral injury detection",
  "mutating STATE or BELIEF from load interpretation",
] as const;

/** emotionalLoadScore 0–100 at or above → loadFirstMode candidate */
export const LOAD_FIRST_EMOTIONAL_SCORE_THRESHOLD = 42;

/** burnoutProbability 0–1 at or above → loadFirstMode */
export const LOAD_FIRST_BURNOUT_THRESHOLD = 0.48;

/** Minimum distinct signal categories (score ≥ 0.35) to engage loadFirstMode */
export const LOAD_FIRST_MIN_SIGNAL_CATEGORIES = 2;

/** Per-signal score at or above counts as a category hit */
export const LOAD_SIGNAL_CATEGORY_HIT = 0.35;

/** Boost applied to Emotional Load Signal inputs when load detected */
export const LOAD_EMOTIONAL_BOOST = {
  uncertaintyLoadPerIndex: 28,
  conflictLoadPerEmotional: 22,
  depletionPerSleepRisk: 0.35,
  depletionPerBurnout: 0.25,
  emotionalBiasPerEmotional: 0.18,
} as const;

export const LOAD_SIGNAL_PATTERNS = {
  emotionalLoad: [
    /\b(verbal abuse|yelling|yelled|scream(?:ing|s)?|cruel words|cruel|name[- ]calling|insult(?:s|ed|ing)?|hostile|abusive|harsh words|shout(?:ing|s)?)\b/i,
    /\b(said (?:horrible|awful|mean|hurtful)|being mean to me|attacks me verbally)\b/i,
  ],
  sleepRisk: [
    /\b(sleepless|no sleep|can't sleep|cannot sleep|not sleeping|haven't slept|havent slept|exhausted nights|up all night|waking (?:up )?every|night after night)\b/i,
    /\b(insomnia|sleep deprivation|broken sleep|never get(?:ting)? rest)\b/i,
    /\b(calls? all night|keeps waking (?:me )?up|nighttime (?:care|calls?))\b/i,
  ],
  uncertaintyIndex: [
    /\b(don't know what's next|dont know whats next|don't know what(?:'s| is) next|unpredictable|no idea what(?:'s| is) coming|can't predict|cannot predict)\b/i,
    /\b(every day (?:is )?different|never know (?:what|how)|constant uncertainty|what happens next)\b/i,
    /\b(don't know (?:what to do|if (?:this is )?serious|what happens)|dont know (?:what to do|if))\b/i,
  ],
  cognitiveLoad: [
    /\b(always watching|on edge|vigilant|hypervigilant|can't relax|cannot relax|never (?:off duty|a break)|waiting for (?:the )?next (?:crisis|episode))\b/i,
    /\b(24\/7|round the clock|every minute|can't look away|cannot look away)\b/i,
    /\b(same (?:thing|question|concern)|every (?:five|few) minutes|answered (?:ten|the same) times?|keeps? asking|over and over)\b/i,
  ],
  burnoutProbability: [
    /\b(overwhelmed|stressed|can't cope|cannot cope|breaking down|at my limit|burned out|burnt out|running on empty|no energy left|drowning)\b/i,
    /\b(too much|more than i can handle|can't take (?:it|this) anymore|cannot take (?:it|this) anymore)\b/i,
  ],
} as const;

export const PRIMARY_CONTRIBUTOR_LABELS = {
  emotionalLoad: "verbal conflict and emotional strain",
  sleepRisk: "sleep disruption",
  uncertaintyIndex: "chronic uncertainty",
  cognitiveLoad: "constant vigilance",
  burnoutProbability: "sustained strain in what was shared",
} as const;

export const LOAD_FIRST_MINIMAL_ACTION =
  "When ready, share one care detail that would help the picture — no multi-step plan required right now.";

export const LOAD_FIRST_SAFE_TO_IGNORE =
  "Non-urgent care technique research, appointment scheduling that can wait 24 hours, and any task that does not address immediate safety can be ignored today.";
