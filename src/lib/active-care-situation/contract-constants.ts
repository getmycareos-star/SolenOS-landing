/**
 * Active Care Situation — temporary continuity while understanding unfolds.
 * Not a chatbot thread. Not a new form per message.
 * CareContext remains the durable spine; this shapes caregiver-facing continuity.
 */

export const ACTIVE_CARE_SITUATION_PURPOSE =
  "Evaluate each input: same situation, update, answers uncertainty, or new event — then grow understanding.";

export const ACTIVE_CARE_SITUATION_WINDOW_MS = 12 * 60 * 60 * 1000; // 12h

export const ACTIVE_CARE_SITUATION_SOFT_KINDS = [
  "behavior_change",
  "appetite",
  "general",
] as const;

export const ACTIVE_CARE_SITUATION_HARD_KINDS = [
  "fall",
  "medication_change",
  "hospital_discharge",
  "appointment",
  "document",
] as const;
