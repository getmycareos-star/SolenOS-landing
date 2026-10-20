/** Event Normalization — atomicity, dedup, split, confidence tiers. */

export const NORMALIZER_IDENTITY =
  "Every CareEvent must represent a single, durable, non-ambiguous unit of reality change.";

export const CONFIDENCE_AUTO_COMMIT = 0.85;
export const CONFIDENCE_NEEDS_REVIEW = 0.65;
export const DEDUP_TIME_WINDOW_MS = 48 * 60 * 60 * 1000;

export const ATOMIC_EVENT_TYPES = [
  "medication_started",
  "medication_changed",
  "appointment_occurred",
  "symptom_observed",
  "document_received",
  "financial_claim_rejected",
  "care_instruction_given",
  "incident_occurred",
  "communication_occurred",
  "unprocessed_input",
  "correction",
] as const;

export const NOISE_PATTERNS = [
  { pattern: /\b(feels?\s+tired|a bit tired)\b/i, attach_to: "symptom_observed" },
  { pattern: /\b(a bit better|slightly better|improving)\b/i, attach_to: "symptom_observed" },
  { pattern: /\b(doctor called|nurse called)\b/i, attach_to: "communication_occurred" },
  { pattern: /\b(insurance form received|form received)\b/i, merge_into: "document_received" },
] as const;

export const SPLIT_VERB_PATTERNS = [
  { pattern: /\b(fell|fall|fallen|tripped|slipped)\b/i, type: "incident_occurred" as const },
  { pattern: /\b(hospital|er\b|emergency|admitted)\b/i, type: "appointment_occurred" as const },
  { pattern: /\b(medication|prescribed|dose|medication changed|started)\b/i, type: "medication_changed" as const },
  { pattern: /\b(appointment|visit|saw doctor)\b/i, type: "appointment_occurred" as const },
  { pattern: /\b(claim rejected|insurance rejected|denied)\b/i, type: "financial_claim_rejected" as const },
  { pattern: /\b(received|document|letter|summary)\b/i, type: "document_received" as const },
  { pattern: /\b(instruction|must|should|monitor|watch for)\b/i, type: "care_instruction_given" as const },
  { pattern: /\b(confus\w*|symptom|pain|appetite|eating)\b/i, type: "symptom_observed" as const },
];
