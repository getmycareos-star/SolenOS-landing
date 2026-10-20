/**
 * Routine Moments — Recurring patterns of everyday care and daily functioning
 * that become meaningful when they change over time.
 * 
 * Based on the specification: Routine Moments represent the recurring patterns
 * of everyday care and daily functioning that become meaningful when they 
 * change over time.
 */

import type { CareEventRecord } from "../care-events/types";
import type { RawEvidence } from "../raw-evidence/types";
export type { ConfidenceLevel, SourceType } from "../entities/types";

/**
 * The type/category of a routine moment.
 * Based on specification examples but designed to be extensible.
 */
export const ROUTINE_MOMENT_TYPES = [
  "bathroom_toileting",
  "eating",
  "drinking",
  "sleeping",
  "waking",
  "mobility",
  "morning_routine",
  "evening_routine",
  "bathing",
  "dressing",
  "feeding",
  "exercise_physical_therapy",
  "communication",
  "social_interaction",
  "home_environment",
  "caregiver_availability",
  "custom"
] as const;

export type RoutineMomentType = typeof ROUTINE_MOMENT_TYPES[number];

/**
 * The observed state of a routine moment occurrence.
 */
export const ROUTINE_OBSERVATION_STATE = [
  "occurred",
  "missed",
  "not_observed"
] as const;

export type RoutineObservationState = typeof ROUTINE_OBSERVATION_STATE[number];

/**
 * Assistance level where relevant (for activities like dressing, bathing, etc.)
 */
export const ASSISTANCE_LEVEL = [
  "independent",
  "supervised",
  "partial_assistance",
  "full_assistance",
  "unknown"
] as const;

export type AssistanceLevel = typeof ASSISTANCE_LEVEL[number];

/**
 * Participation vs occurrence distinction.
 */
export const PARTICIPATION_LEVEL = [
  "independent_participation",
  "assisted_participation",
  "non_participation",
  "unknown"
] as const;

export type ParticipationLevel = typeof PARTICIPATION_LEVEL[number];

/**
 * Frequency patterns.
 */
export const ROUTINE_FREQUENCY = [
  "once",
  "multiple_times",
  "daily",
  "weekly",
  "irregular",
  "unknown"
] as const;

export type RoutineFrequency = typeof ROUTINE_FREQUENCY[number];

/**
 * Baseline pattern for a routine moment.
 * Represents what normally happens based on evidence.
 */
export type RoutineBaseline = {
  /** Whether a baseline has been established */
  is_established: boolean;
  
  /** The established pattern description */
  pattern_description?: string;
  
  /** Frequency of the pattern */
  frequency?: RoutineFrequency;
  
  /** Typical time window (if applicable) */
  typical_time_window?: string;
  
  /** Typical assistance level (if applicable) */
  typical_assistance_level?: AssistanceLevel;
  
  /** Typical participation level (if applicable) */
  typical_participation_level?: ParticipationLevel;
  
  /** Confidence in the baseline */
  confidence: ConfidenceLevel;
  
  /** Evidence IDs supporting the baseline */
  evidence_ids: string[];
  
  /** Time period over which baseline was established */
  baseline_period: {
    start_date: string; // ISO date string
    end_date: string;   // ISO date string
  };
  
  /** When the baseline was last updated */
  last_updated_at: string; // ISO timestamp
};

/**
 * A single observation of a routine moment.
 * Represents a specific occurrence or non-occurrence at a point in time.
 */
export type RoutineMomentObservation = {
  /** Unique identifier */
  id: string;
  
  /** The person receiving care */
  person_id: string;
  
  /** The routine moment type */
  routine_type: RoutineMomentType;
  
  /** What was observed */
  observation_state: RoutineObservationState;
  
  /** When the observation was made */
  occurred_at: string; // ISO timestamp
  
  /** Who recorded the observation */
  recorded_by: string; // caregiver_id
  
  /** Source of the observation */
  source: SourceType;
  
  /** Additional context about the observation */
  context?: string;
  
  /** Assistance level observed (if relevant) */
  assistance_level?: AssistanceLevel;
  
  /** Participation level observed (if relevant) */
  participation_level?: ParticipationLevel;
  
  /** Duration where relevant (e.g., for sleeping) */
  duration_minutes?: number;
  
  /** Raw evidence supporting this observation */
  raw_evidence_id?: string;
  
  /** Associated care event (if any) */
  care_event_id?: string;
  
  /** Metadata */
  metadata: Record<string, unknown>;
  
  /** Timestamps */
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
};

/**
 * Change detection result for a routine moment.
 * Represents an assessment of whether and how a routine pattern has changed.
 */
export type RoutineMomentChange = {
  /** Unique identifier */
  id: string;
  
  /** The person receiving care */
  person_id: string;
  
  /** The routine moment type */
  routine_type: RoutineMomentType;
  
  /** What changed */
  change_description: string;
  
  /** Type of change */
  change_type: 
    | "frequency_increase"
    | "frequency_decrease"
    | "timing_shift_earlier"
    | "timing_shift_later"
    | "assistance_increase"
    | "assistance_decrease"
    | "participation_change"
    | "consistency_change"
    | "new_interruption"
    | "new_dependence"
    | "environmental_change"
    | "caregiver_availability_change"
    | "other";
  
  /** Period over which change was observed */
  observation_period: {
    start_date: string; // ISO date string
    end_date: string;   // ISO date string
  };
  
  /** Confidence in the change detection */
  confidence: ConfidenceLevel;
  
  /** Evidence IDs supporting the change detection */
  evidence_ids: string[];
  
  /** Whether this represents a sustained change vs temporary deviation */
  is_sustained_change: boolean;
  
  /** Metadata */
  metadata: Record<string, unknown>;
  
  /** Timestamps */
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
};

/**
 * Input for creating a routine moment observation.
 */
export type CreateRoutineMomentObservationInput = {
  /** The person receiving care */
  person_id: string;
  
  /** The routine moment type */
  routine_type: RoutineMomentType;
  
  /** What was observed */
  observation_state: RoutineObservationState;
  
  /** When the observation was made */
  occurred_at?: string; // ISO timestamp (defaults to now)
  
  /** Who recorded the observation */
  recorded_by: string; // caregiver_id
  
  /** Source of the observation */
  source?: SourceType; // defaults to user_input
  
  /** Additional context about the observation */
  context?: string;
  
  /** Assistance level observed (if relevant) */
  assistance_level?: AssistanceLevel;
  
  /** Participation level observed (if relevant) */
  participation_level?: ParticipationLevel;
  
  /** Duration where relevant (e.g., for sleeping) */
  duration_minutes?: number;
  
  /** Raw evidence supporting this observation */
  raw_evidence_id?: string;
  
  /** Associated care event (if any) */
  care_event_id?: string;
  
  /** Metadata */
  metadata?: Record<string, unknown>;
};

/**
 * Input for detecting changes in routine moment patterns.
 */
export type DetectRoutineMomentChangeInput = {
  /** The person receiving care */
  person_id: string;
  
  /** The routine moment type */
  routine_type: RoutineMomentType;
  
  /** Time period to analyze for changes */
  analysis_period: {
    start_date: string; // ISO date string
    end_date: string;   // ISO date string
  };
  
  /** Optional baseline to compare against (if not provided, will be computed) */
  baseline?: RoutineBaseline;
  
  /** Metadata */
  metadata?: Record<string, unknown>;
};

/**
 * Complete routine moment record that includes baseline and observations.
 */
export type RoutineMomentRecord = {
  /** Unique identifier */
  id: string;
  
  /** The person receiving care */
  person_id: string;
  
  /** The routine moment type */
  routine_type: RoutineMomentType;
  
  /** Current baseline understanding */
  baseline: RoutineBaseline;
  
  /** Recent observations */
  observations: RoutineMomentObservation[];
  
  /** Detected changes (if any) */
  changes: RoutineMomentChange[];
  
  /** Metadata */
  metadata: Record<string, unknown>;
  
  /** Timestamps */
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
};