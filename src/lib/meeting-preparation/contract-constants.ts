/** Meeting Preparation Engine — restore context before every caregiving conversation. */

export const MEETING_PREPARATION_IDENTITY =
  "Care continuity system that reconstructs fragmented caregiving history into structured pre-meeting context automatically.";

export const MEETING_PREPARATION_BOUNDARY =
  "Preparation is not summarization — it restores context from the Care Journey only. Never invent facts.";

export const MEETING_TYPES = [
  "medical",
  "legal",
  "financial",
  "care_coordination",
  "family",
  "other",
] as const;

export const MEETING_STATUSES = [
  "scheduled",
  "completed",
  "cancelled",
  "proposed_meeting",
] as const;

export const MEETING_SOURCES = ["manual", "calendar", "document_inferred"] as const;

/** Hours before meeting datetime when preparation pack generation is triggered. */
export const PREPARATION_WINDOWS_HOURS: Record<
  (typeof MEETING_TYPES)[number],
  number
> = {
  medical: 48,
  legal: 72,
  financial: 48,
  family: 24,
  care_coordination: 24,
  other: 24,
};

export const MONITORING_KEYWORDS = [
  "mobility",
  "appetite",
  "sleep",
  "confusion",
  "weight",
  "mood",
  "pain",
  "financial",
  "home care",
] as const;

export const PROPOSED_MEETING_PATTERNS = [
  /\bfollow[- ]?up in (\d+) days?\b/i,
  /\bschedule (?:an? )?appointment\b/i,
  /\breturn visit recommended\b/i,
  /\bfollow[- ]?up appointment\b/i,
  /\bsee (?:Dr|doctor|specialist) (?:in|within)\b/i,
] as const;
