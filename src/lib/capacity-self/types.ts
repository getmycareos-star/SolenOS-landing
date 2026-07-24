import type { PrioritizedItem } from "../prioritization-engine/types";

export const CONTEXT_TYPES = [
  "phone_call",
  "home_repair",
  "medical",
  "financial",
  "errand",
  "other",
] as const;
export type ContextType = (typeof CONTEXT_TYPES)[number];

export const CAPACITY_LEVELS = ["low", "medium", "high"] as const;
export type CapacityLevel = (typeof CAPACITY_LEVELS)[number];

export const ITEM_SUBJECTS = ["care_recipient", "caregiver"] as const;
export type ItemSubject = (typeof ITEM_SUBJECTS)[number];

export const ITEM_STATUSES = ["open", "resolved"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

/** Unified care item — same schema for caregiver and care recipient. */
export type CareItem = PrioritizedItem & {
  context_type: ContextType;
  subject: ItemSubject;
  status: ItemStatus;
  resolved_at: string | null;
  /** Low-effort scoring for capacity-matched suggestions (1 = smallest lift). */
  effort_score: number;
};

export type BatchViewGroup = {
  context_type: ContextType;
  label: string;
  items: CareItem[];
};

export type BatchViewResult = {
  view: "batch";
  groups: BatchViewGroup[];
  /** High-decay items outside current batch — still visible, not hidden. */
  outside_batch_high_risk: CareItem[];
  generated_at: string;
};

export type CapacityMatchedSuggestion = {
  label: "capacity_matched_suggestion";
  item: CareItem;
  note: string;
  /** Top priority item remains visible separately — never replaced. */
  top_priority_item: CareItem | null;
};

export type CapacitySessionState = {
  caregiver_id: string;
  capacity: CapacityLevel | null;
  updated_at: string | null;
};

export type ResolvedItemRecord = {
  id: string;
  description: string;
  subject: ItemSubject;
  context_type: ContextType;
  resolved_at: string;
  raw_entry_id: string | null;
};

export type CaregiverSelfProfileData = {
  caregiver_basics: string;
  known_conditions: string[];
  current_medications: string[];
  key_dates: { label: string; date: string }[];
  care_team: { name: string; role: string; contact: string }[];
  tagged_event_log: {
    category: "symptom" | "incident" | "decision";
    tag: string;
    date: string;
    raw_entry_id: string;
  }[];
  open_item_descriptions: string[];
};

export type CaregiverSelfProfileRecord = {
  id: string;
  caregiver_id: string;
  profile: CaregiverSelfProfileData;
  session_capacity: CapacityLevel | null;
  resolved_items: ResolvedItemRecord[];
  created_at: string;
  updated_at: string;
};

export type FactualReflection = {
  period: "weekly";
  period_start: string;
  period_end: string;
  lines: string[];
  generated_at: string;
};

export type CapacitySelfSessionResult = {
  batch_view: BatchViewResult;
  capacity_suggestion: CapacityMatchedSuggestion | null;
  factual_reflection: FactualReflection | null;
  caregiver_items: CareItem[];
  care_recipient_items: CareItem[];
};

export const DEFAULT_CAREGIVER_SELF_PROFILE: CaregiverSelfProfileData = {
  caregiver_basics: "",
  known_conditions: [],
  current_medications: [],
  key_dates: [],
  care_team: [],
  tagged_event_log: [],
  open_item_descriptions: [],
};
