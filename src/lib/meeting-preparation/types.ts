import type { MEETING_SOURCES, MEETING_STATUSES, MEETING_TYPES } from "./contract-constants";

export type MeetingType = (typeof MEETING_TYPES)[number];
export type MeetingStatus = (typeof MEETING_STATUSES)[number];
export type MeetingSource = (typeof MEETING_SOURCES)[number];

export type PreparationPack = {
  meeting_id: string;
  generated_at: string;
  what_changed: string[];
  timeline_since_last_meeting: string[];
  outstanding_followups: string[];
  unanswered_questions: string[];
  items_being_monitored: string[];
  decisions_made: string[];
  suggested_discussion_topics: string[];
  last_similar_meeting_at: string | null;
  events_in_scope: number;
};

export type MeetingOutcome = {
  decisions_made: string[];
  advice_received: string[];
  responsibilities_assigned: string[];
  follow_up_actions: string[];
  new_questions: string[];
  documents_received: string[];
  deadlines_created: string[];
  notes?: string;
};

export type CaregivingMeeting = {
  id: string;
  title: string;
  type: MeetingType;
  datetime: string;
  status: MeetingStatus;
  source: MeetingSource;
  caregiver_id: string;
  case_id: string | null;
  linked_events: string[];
  preparation_generated: boolean;
  preparation_pack: PreparationPack | null;
  requires_user_confirmation: boolean;
  preparation_window_hours: number;
  outcome: MeetingOutcome | null;
  created_at: string;
  updated_at: string;
};

export type CreateMeetingInput = {
  title: string;
  type: MeetingType;
  datetime: string;
  caregiver_id?: string;
  case_id?: string | null;
  source?: MeetingSource;
  linked_events?: string[];
};

export type ProposedMeetingInput = {
  title: string;
  type: MeetingType;
  datetime: string;
  caregiver_id?: string;
  case_id?: string | null;
  source_text_excerpt: string;
  linked_events?: string[];
};

export type CompleteMeetingInput = {
  meeting_id: string;
  outcome: MeetingOutcome;
};

export type MeetingPreparationLayerPayload = {
  identity: string;
  boundary: string;
  meeting_id: string;
  meeting_title: string;
  meeting_type: MeetingType;
  meeting_datetime: string;
  preparation_pack: PreparationPack;
};
