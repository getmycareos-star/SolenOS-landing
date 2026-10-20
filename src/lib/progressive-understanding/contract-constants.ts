/**
 * Progressive Understanding Engine — first-class SolenOS component.
 * Storage creates memory. Continuity links events. This layer creates understanding.
 * Not a UI feature. Not a prompt. Not another LLM call.
 */

export const PROGRESSIVE_UNDERSTANDING_IDENTITY =
  "Progressive Understanding Engine — updates evolving understanding of an Active Care Situation whenever new information arrives.";

export const PROGRESSIVE_UNDERSTANDING_PURPOSE =
  "Every caregiver response must answer: what changed in our understanding since the last update — not merely echo what was just typed.";

export const PROGRESSIVE_UNDERSTANDING_CHAIN = [
  "input",
  "capture",
  "care_context",
  "active_care_situation",
  "progressive_understanding",
  "care_reality_state",
  "living_care_record",
  "timeline",
] as const;

export const PROGRESSIVE_UNDERSTANDING_EFFECTS = [
  "opens_situation",
  "answers_uncertainty",
  "strengthens_pattern",
  "introduces_new_dimension",
  "changes_what_matters",
  "invalidates_understanding",
  "continues_gathering",
] as const;

export type ProgressiveUnderstandingEffect =
  (typeof PROGRESSIVE_UNDERSTANDING_EFFECTS)[number];

export const PROGRESSIVE_UNDERSTANDING_NEVER = [
  "restart_template_per_message",
  "regenerate_what_matters_from_scratch_without_prior",
  "llm_call_for_understanding_delta",
  "chat_reply_to_latest_message_alone",
] as const;
