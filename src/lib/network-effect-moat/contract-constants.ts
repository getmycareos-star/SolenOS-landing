/** Network effect & data moat — compounding continuity, not AI. */

export const NETWORK_EFFECT_MOAT_IDENTITY =
  "The moat is continuously compounding continuity data — not AI.";

export const COMPOUNDING_ASSET_TYPES = [
  "care_history",
  "relationships",
  "continuity",
  "user_corrections",
  "resolved_uncertainty",
] as const;

export const NON_COMPOUNDING_TYPES = [
  "llm_response",
  "chat_conversation",
  "summary",
  "prompt",
  "uploaded_file_unstructured",
  "ai_generated_text",
] as const;

export const INTERACTION_OUTCOME_TYPES = [
  "new_care_event",
  "refined_care_event",
  "resolved_uncertainty",
  "new_relationship",
  "corrected_fact",
  "completed_follow_up",
  "new_entity",
  "updated_timeline",
] as const;

export const ENRICHMENT_ACTION_TYPES = [
  "link_to_existing_event",
  "enrich_entity",
  "resolve_uncertainty",
  "strengthen_relationship",
  "update_timeline",
  "close_follow_up",
] as const;

export const MATURITY_STAGES = [
  "early",
  "building",
  "established",
  "journey",
] as const;

export const MATURITY_MESSAGES: Record<(typeof MATURITY_STAGES)[number], string> = {
  early: "SolenOS understands today's situation.",
  building: "SolenOS remembers everything that has happened.",
  established: "SolenOS understands how everything connects.",
  journey: "SolenOS preserves the continuity of an entire care journey.",
};

export const ENTITY_MATCH_THRESHOLD = 0.6;
export const EVENT_MATCH_WINDOW_DAYS = 90;
