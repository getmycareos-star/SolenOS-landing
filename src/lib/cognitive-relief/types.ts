/** Cognitive Relief Modules — types separate from prioritization engine. */

import type { CareContextType } from "../care-contexts/types";
import type { DementiaContext } from "../care-contexts/dementia/types";

export const SUMMARY_AUDIENCES = [
  "new_doctor",
  "family_member",
  "aide",
  "custom",
] as const;
export type SummaryAudience = (typeof SUMMARY_AUDIENCES)[number];

export const CHECKIN_PERIODS = ["daily", "weekly"] as const;
export type CheckinPeriod = (typeof CHECKIN_PERIODS)[number];

export const EVENT_LOG_CATEGORIES = ["symptom", "incident", "decision"] as const;
export type EventLogCategory = (typeof EVENT_LOG_CATEGORIES)[number];

export type KeyDate = {
  label: string;
  date: string;
};

export type CareTeamMember = {
  name: string;
  role: string;
  contact: string;
};

export type TaggedEventLogEntry = {
  category: EventLogCategory;
  tag: string;
  date: string;
  raw_entry_id: string;
};

export type LocationIndexEntry = {
  label: string;
  physical_or_digital_location: string;
  last_confirmed: string;
};

/** Persistent care record per care recipient — spec shape. */
export type CareRecipientProfileData = {
  care_recipient_basics: string;
  known_conditions: string[];
  current_medications: string[];
  key_dates: KeyDate[];
  care_team: CareTeamMember[];
  tagged_event_log: TaggedEventLogEntry[];
  location_index: LocationIndexEntry[];
};

export type CareRecipientProfileRecord = {
  id: string;
  case_id: string | null;
  caregiver_id: string;
  profile: CareRecipientProfileData;
  care_context: CareContextType;
  dementia_context: DementiaContext | null;
  last_checkin_at: string | null;
  checkin_period: CheckinPeriod | null;
  optional_budget: number | null;
  created_at: string;
  updated_at: string;
};

export type PatternContext = {
  seen_before: boolean;
  frequency: number;
  last_occurrence: string | null;
  note: string;
};

export type IngestEntryResult = {
  profile: CareRecipientProfileRecord;
  pattern_context: PatternContext | null;
  tags_added: TaggedEventLogEntry[];
};

export type GeneratedSummary = {
  audience: SummaryAudience;
  scope: string;
  content: string;
  generated_at: string;
};

export type CheckinOutput = {
  period: CheckinPeriod;
  resolved_since_last: string[];
  still_open_brief: string[];
  closing_statement: string;
  generated_at: string;
};

export type SharedViewResult = {
  token: string;
  recipient_label: string;
  expires_at: string;
  view_url_path: string;
  payload: Record<string, unknown>;
};

export type PoolRunwayEntry = {
  pool: string;
  estimated_depletion_window: string;
  confidence: "low" | "medium";
  assumptions_used: string[];
};

export type PoolRunwayView = {
  runways: PoolRunwayEntry[];
  optional_budget: number | null;
  generated_at: string;
  disclaimer: string;
};

export const DEFAULT_PROFILE: CareRecipientProfileData = {
  care_recipient_basics: "",
  known_conditions: [],
  current_medications: [],
  key_dates: [],
  care_team: [],
  tagged_event_log: [],
  location_index: [],
};
