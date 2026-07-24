/** SolenOS event-sourced continuity — system implementation contract. */

export const SITUATION_ENTRY_IDENTITY =
  "An event-sourced continuity system that converts messy real-world situations into structured CareEvents.";

export const CARE_CONTEXT_ROOT_ID = "CareContextRoot";

export const EXTRACTED_TYPES = [
  "incident",
  "observation",
  "document_fact",
  "financial_issue",
  "coordination_issue",
  "behavioral_change",
  "administrative_issue",
  "follow_up",
  "decision",
  "unprocessed_input",
  "unparsed_raw",
  "contact_event",
  "correction",
  "unknown",
] as const;

export const TRACKING_DIMENSIONS = [
  "mobility",
  "appetite",
  "stability",
  "daily_functioning",
  "coordination",
  "recovery",
  "financial_stability",
  "administrative_status",
] as const;

export const SITUATION_ENTRY_PROHIBITED = [
  "summarize instead of structure",
  "infer causes",
  "guess missing information",
  "medical diagnosis language",
  "predictive alerts",
  "pattern detection at entry",
] as const;
