/** Core state correction + data integrity — continuously repairable event graph. */

export const INTEGRITY_IDENTITY =
  "A continuously corrected event-sourced reality model with explicit uncertainty and user-authoritative truth resolution.";

export const TRUST_LOOP =
  "Input → Extraction → Event → User Correction → Graph Update → Improved Future Extraction";

export const CARE_EVENT_STATUSES = [
  "committed",
  "provisional",
  "unparsed_raw",
  "invalidated",
  "superseded",
] as const;

export const CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;

export const TRUTH_SOURCE_PRIORITY = [
  "user_correction",
  "validated_document",
  "ai_inference",
] as const;

export const INTEGRITY_CORRECTION_TYPES = [
  "modify",
  "invalidate",
  "split",
  "clarify",
  "supersede",
] as const;
