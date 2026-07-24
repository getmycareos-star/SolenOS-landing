/** Moment-of-Need Engine — transform uncertainty into understanding during the difficult moment. */

export const MOMENT_OF_NEED_IDENTITY =
  "Help me understand what is happening right now.";

export const MOMENT_OF_NEED_DEFINING_PRINCIPLE =
  "Caregivers need support during the difficult moment — not after it.";

export const HELPLESSNESS_REDUCTION_GOAL =
  "Reduce helplessness through better understanding — not organization.";

export const MOMENT_OF_NEED_SECTIONS = [
  "what_changed",
  "what_we_know",
  "possible_context",
  "questions_worth_tracking",
] as const;

export const MOMENT_OF_NEED_RULES = [
  "connect_to_existing_care_reality",
  "show_evidence_not_diagnosis",
  "surface_uncertainty_explicitly",
  "never_recommend_medical_treatment",
  "never_claim_certainty_without_evidence",
  "reduce_interpretation_burden",
  "human_support_when_appropriate",
] as const;

export const MOMENT_OF_NEED_PROHIBITED = [
  "diagnose conditions",
  "recommend medical treatment",
  "replace clinicians",
  "generic dementia FAQ responses",
  "symptom checker behavior",
  "claim certainty where evidence is incomplete",
  "ask anything chatbot UX",
] as const;

/** Future Care Moment capability — Phase 2; see future-capabilities/care-moment.ts */
export const CARE_MOMENT_FUTURE_REF = "src/lib/future-capabilities/care-moment" as const;

export const CHANGE_TYPE_LABELS = {
  new_observation: "New observation compared with prior record",
  repeated_pattern: "Repeated pattern in care history",
  escalation: "Escalation from prior baseline",
  return_of_previous: "Return of a previously recorded issue",
} as const;

export const TRACKING_QUESTIONS = [
  "When did this begin?",
  "Does it happen at a specific time of day?",
  "Is anything different on those days?",
  "Has this happened before?",
  "What responses have helped previously?",
] as const;

/** Patterns that indicate a real-time moment-of-need input */
export const MOMENT_TRIGGER_PATTERNS = [
  /\b(today|right now|this morning|this evening|just now|keeps?|again today)\b/i,
  /\b(noticed|happening|started|refused|won't|can't|confused|asking)\b/i,
];
