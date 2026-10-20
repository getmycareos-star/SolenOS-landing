import type { EVENT_TIME_TYPES, RETIMING_REASONS } from "./contract-constants";

export type EventTimeType = (typeof EVENT_TIME_TYPES)[number];
export type RetimingReason = (typeof RETIMING_REASONS)[number];

/** When the situation occurred in reality — may be uncertain. */
export type EventTime = {
  type: EventTimeType;
  start?: string;
  end?: string;
  confidence: number;
};

export type CareEventTime = {
  event_time: EventTime;
  ingestion_time: string;
};

export type CareEventTimeCorrection = {
  id: string;
  original_event_id: string;
  previous_event_time: EventTime;
  updated_event_time: EventTime;
  reason: RetimingReason;
  corrected_at: string;
};

export type ParseEventTimeResult = {
  event_time: EventTime;
  clarification_question: string | null;
};

export type DualTimelineView = {
  temporal_order: string[];
  ingestion_order: string[];
};
