/**
 * Care Moment — In-the-moment capture (Phase 2 — FUTURE).
 * Bridges to moment-of-need-engine; NOT emergency medical tool.
 */

export const CARE_MOMENT_IDENTITY =
  "Something is happening. Help me understand and preserve what matters.";

export const CARE_MOMENT_ENTRY_LABELS = [
  "Something is happening",
  "Capture a care moment",
] as const;

export const CARE_MOMENT_INPUT_METHODS = [
  "voice",
  "text",
  "photo",
  "message_capture",
] as const;

/** Every Care Moment must answer these — engine contract. */
export const CARE_MOMENT_RESPONSE_FRAMEWORK = [
  "what_changed",
  "what_do_we_know",
  "why_might_this_matter",
  "what_should_be_remembered",
  "what_questions_to_consider",
] as const;

export type CareMomentResponseSection = (typeof CARE_MOMENT_RESPONSE_FRAMEWORK)[number];

export const CARE_MOMENT_FLOW = [
  "real_world_event",
  "care_moment_capture",
  "event_extraction",
  "compare_previous_understanding",
  "detect_change",
  "update_care_reality",
  "improve_future_understanding",
] as const;

export const CARE_MOMENT_BOUNDARIES = {
  must: [
    "preserve_observations",
    "identify_changes",
    "connect_context",
    "highlight_missing_information",
    "improve_decision_confidence",
    "almost_no_effort_entry",
  ],
  must_not: [
    "diagnose_conditions",
    "prescribe_actions",
    "create_unnecessary_fear",
    "present_uncertainty_as_certainty",
    "require_forms_or_categories",
    "medical_chatbot_responses",
  ],
} as const;

export const CARE_MOMENT_SUCCESS_METRIC =
  "Did SolenOS help the caregiver understand an uncertain moment better than they could alone?";

/** Maps future Care Moment sections → implemented moment-of-need sections. */
export const CARE_MOMENT_TO_MOMENT_OF_NEED_MAP = {
  what_changed: "what_changed",
  what_do_we_know: "what_we_know",
  why_might_this_matter: "possible_context",
  what_should_be_remembered: "derived",
  what_questions_to_consider: "questions_worth_tracking",
} as const;

export type CareMomentBrief = {
  status: "FUTURE";
  input_method: (typeof CARE_MOMENT_INPUT_METHODS)[number];
  sections: Partial<Record<CareMomentResponseSection, string>>;
  care_event_ids: string[];
  uncertainties: string[];
};
