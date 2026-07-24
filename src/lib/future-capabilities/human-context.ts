/**
 * Person-Specific Human Context — Care Reality Profile extension (principle + layers).
 * Preserves lived experience — not medical diagnosis.
 */

export const HUMAN_CONTEXT_IDENTITY =
  "SolenOS understands my loved one — not just their condition.";

export const HUMAN_CONTEXT_PRINCIPLE =
  "The Care Reality Profile must capture who this person is, what works, what creates difficulty, and how they respond — from caregiver observations and documented outcomes.";

/** Human context layers — map to profile sections where implemented. */
export const HUMAN_CONTEXT_LAYERS = [
  "communication_patterns",
  "what_calms",
  "what_causes_distress",
  "preferred_routines",
  "important_relationships",
  "previous_successful_approaches",
  "previous_failed_approaches",
] as const;

export type HumanContextLayer = (typeof HUMAN_CONTEXT_LAYERS)[number];

/** Bridge: human context layer → care_reality_profile_engine PROFILE_SECTIONS */
export const HUMAN_CONTEXT_TO_PROFILE_SECTION = {
  communication_patterns: "family_observations",
  what_calms: "what_helped",
  what_causes_distress: "what_did_not_help",
  preferred_routines: "important_routines",
  important_relationships: "family_observations",
  previous_successful_approaches: "what_helped",
  previous_failed_approaches: "what_did_not_help",
} as const;

export const HUMAN_CONTEXT_BOUNDARIES = {
  is: ["preserving_lived_experience", "person_specific_patterns", "response_history"],
  is_not: [
    "medical_diagnosis_of_behavior",
    "reducing_person_to_condition",
    "symptom_category_labels",
    "generic_dementia_explanations",
  ],
} as const;

export const HUMAN_CONTEXT_WRONG_VS_RIGHT = {
  wrong: "Resistance to care can occur in dementia.",
  right:
    "Based on previous interactions, this person has responded better when choices were offered instead of direct instructions.",
} as const;

export type HumanContextInsight = {
  layer: HumanContextLayer;
  insight: string;
  source_event_ids: string[];
  confidence: "low" | "medium" | "high";
};
