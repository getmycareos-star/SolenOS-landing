/** Caregiver Reality Model — care journey events, not medical-only. */

export const CARE_JOURNEY_IDENTITY =
  "Care journey continuity — medical, legal, financial, family, and administrative events together.";

export const CARE_JOURNEY_BOUNDARY =
  "The caregiver carries the entire journey; SolenOS preserves continuity across all of it.";

export const CARE_JOURNEY_CATEGORIES = [
  "medical",
  "legal",
  "financial",
  "caregiving",
  "administrative",
  "family",
  "other",
] as const;

export type CareJourneyCategory = (typeof CARE_JOURNEY_CATEGORIES)[number];

export type CareJourneyAttachment = {
  id: string;
  name: string;
  mime_type?: string;
  url?: string;
};

export type CareJourneyEvent = {
  event_id: string;
  case_id: string | null;
  caregiver_id: string;
  category: CareJourneyCategory;
  title: string;
  description: string;
  event_date: string;
  source: string;
  attachments: CareJourneyAttachment[];
  metadata: Record<string, unknown>;
  created_at: string;
};

export type CreateCareJourneyEventInput = {
  case_id?: string | null;
  caregiver_id?: string;
  category?: CareJourneyCategory;
  title?: string;
  description: string;
  event_date?: string;
  source?: string;
  attachments?: CareJourneyAttachment[];
  metadata?: Record<string, unknown>;
};

export type CareJourneyTimelineEntry = CareJourneyEvent;

export type CareJourneySearchResult = {
  query: string;
  matches: CareJourneyTimelineEntry[];
  total: number;
};
