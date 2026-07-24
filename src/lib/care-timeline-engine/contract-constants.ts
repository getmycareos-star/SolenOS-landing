/** Care Timeline Engine — chronological, deduplicated medical truth over time. */

export const CARE_TIMELINE_ENGINE_IDENTITY =
  "Build a state-driven Care Timeline Engine that converts unstructured caregiver inputs into deduplicated medical facts, chronological events, and a continuously evolving patient state.";

export const CARE_TIMELINE_DEFINING_PRINCIPLE =
  "The Care Record is a continuously mutating truth object — events are state drivers, not logs.";

export const TIMELINE_EVENT_TYPES = [
  "medication_started",
  "medication_changed",
  "symptom_reported",
  "doctor_instruction",
  "appointment",
  "test_result",
  "care_note",
] as const;

export const MEDICAL_FACT_TYPES = ["medication", "condition", "symptom"] as const;

export const FACT_STATUSES = ["active", "resolved", "unknown"] as const;

export const SOURCE_CHANNELS = ["whatsapp", "voice", "pdf", "manual"] as const;

export const CARE_TIMELINE_RULES = [
  "chronological_ordering",
  "semantic_deduplication",
  "every_input_mutates_record",
  "contradictions_become_anomalies",
  "evidence_trail_required",
  "pure_state_reducer",
] as const;

export const DEDUP_WINDOW_MS = 72 * 60 * 60 * 1000;

export const RECENT_EVENT_DAYS = 7;

export const MEDICATION_PATTERN =
  /\b(metformin|insulin|aspirin|lisinopril|atorvastatin|warfarin|medication|medicine|prescription)\b/i;

export const DOSAGE_PATTERN = /\b(\d+(?:\.\d+)?\s*(?:mg|mcg|g|units?|ml))\b/i;

export const MED_START_PATTERN = /\b(started|prescribed|began|initiated|new)\b/i;

export const MED_CHANGE_PATTERN = /\b(changed|increased|decreased|reduced|adjusted|dose)\b/i;

export const TASK_INTENT_PATTERN =
  /\b(book|schedule|refill|follow[- ]?up|take (?:him|her|them) to|call|confirm|monitor)\b/i;
