/** MVP Surface Area — smallest product that validates the continuity thesis. */

export const MVP_SURFACE_IDENTITY =
  "The first usable version of SolenOS is a continuity engine — not an AI assistant, care platform, or medical application.";

export const MVP_CORE_THESIS =
  "Convert fragmented situations into an organized, evolving understanding of a care journey while reducing mental and cognitive overload.";

export const MVP_FIRST_SCREEN_PROMPT = "What is happening right now?";

export const MVP_NON_GOALS = [
  "predictive intelligence",
  "advanced pattern detection",
  "complex graph visualizations",
  "causal reasoning",
  "automated recommendations",
  "long-term forecasting",
  "comprehensive dashboards",
] as const;

export const MVP_SYSTEM_STATES = ["empty", "active_continuity"] as const;

export const AHA_MOMENT_SECTIONS = [
  "what_i_understood",
  "what_is_uncertain",
  "what_needs_clarification",
  "what_changed",
  "what_will_be_tracked",
] as const;

/** Post-entry priority engine order — replaces static recent-items logic. */
export const POST_ENTRY_PRIORITY_ORDER = [
  "urgency_changes",
  "increasing_uncertainty",
  "newly_added_events",
  "unresolved_critical_questions",
  "time_sensitive_follow_ups",
] as const;

export const MVP_SUCCESS_CRITERIA = [
  "capture_situation_under_one_minute",
  "structured_continuity_visible",
  "known_and_unknown_explicit",
  "return_context_regained",
  "frictionless_ongoing_capture",
] as const;

export const POST_ENTRY_SYSTEM_DEFINITION =
  "An event-driven continuity system that continuously aligns an evolving CareContext with real-world changes through structured updates, document ingestion, and uncertainty resolution.";
