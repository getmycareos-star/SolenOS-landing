/** Baseline Intelligence — is this different for this person? */

export const BASELINE_INTELLIGENCE_IDENTITY =
  "SolenOS helps answer: what is happening with this person, compared with what we know about them?";

export const BASELINE_INTELLIGENCE_DEFINING_PRINCIPLE =
  "The meaning of a change depends on the person's own history — not generic medical categories.";

export const BASELINE_DOMAINS = [
  "routine",
  "communication",
  "sleep",
  "appetite",
  "mobility",
  "mood",
  "medication_adherence",
  "social",
] as const;

export const BASELINE_PATTERNS: { domain: (typeof BASELINE_DOMAINS)[number]; pattern: RegExp }[] = [
  { domain: "routine", pattern: /\b(routine|morning|evening|daily|habit|usually|normally)\b/i },
  { domain: "communication", pattern: /\b(ask(?:ing|s)?|repeat(?:ing|s)?|question|talk|conversation|confus)\b/i },
  { domain: "sleep", pattern: /\b(sleep|nap|night|insomnia|restless|awake)\b/i },
  { domain: "appetite", pattern: /\b(appetite|eat(?:ing|s)?|meal|breakfast|lunch|dinner|refus(?:ed|es)?)\b/i },
  { domain: "mobility", pattern: /\b(walk(?:ing|s)?|mobility|fall|unsteady|wheelchair|transfer)\b/i },
  { domain: "mood", pattern: /\b(upset|agitat(?:ed|ion)?|anxious|calm|mood|irritable|happy)\b/i },
  { domain: "medication_adherence", pattern: /\b(medication|med|pill|dose|refus(?:ed|es)?|took|taken)\b/i },
  { domain: "social", pattern: /\b(visit|visitor|family|friend|lonely|withdrawn|social)\b/i },
];

export const BASELINE_INTELLIGENCE_RULES = [
  "compare_against_person_history",
  "never_generic_diagnosis",
  "never_symptom_encyclopedia",
  "surface_deviation_not_category",
  "preserve_uncertainty",
  "evidence_linked_to_events",
] as const;

export const BASELINE_PROHIBITED = [
  "generic dementia education",
  "symptom encyclopedia responses",
  "medical diagnosis from baseline deviation",
  "category-based advice without person history",
] as const;

/** Minimum prior observations before baseline is considered established */
export const BASELINE_MIN_OBSERVATIONS = 2;
