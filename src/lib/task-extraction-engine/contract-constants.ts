/** Task Extraction System — derived actionable work from care events. */

export const TASK_EXTRACTION_IDENTITY =
  "Tasks are ALWAYS derived from events — never manually created as primary source.";

export const TASK_EXTRACTION_DEFINING_PRINCIPLE =
  "Convert care intent into actionable work extracted from timeline events.";

export const TASK_STATUSES = ["open", "done"] as const;

export const TASK_INTENT_PATTERNS = [
  { pattern: /\b(take (?:him|her|them) to (?:lab|doctor|clinic|hospital))\b/i, kind: "transport" },
  { pattern: /\b(refill|pick up) (?:meds|medication|prescription)\b/i, kind: "medication_refill" },
  { pattern: /\b(follow[- ]?up with|see) (?:cardiolog\w*|doctor|specialist)\b/i, kind: "follow_up" },
  { pattern: /\b(book|schedule) (?:scan|appointment|visit|test)\b/i, kind: "appointment" },
  { pattern: /\b(call|contact) (?:doctor|nurse|pharmacy|insurance)\b/i, kind: "contact" },
  { pattern: /\b(monitor|watch for|check)\b[^.]{0,40}/i, kind: "monitoring" },
] as const;

export const TASK_EXTRACTION_RULES = [
  "derived_only_never_manual_primary",
  "source_event_required",
  "open_by_default",
] as const;
