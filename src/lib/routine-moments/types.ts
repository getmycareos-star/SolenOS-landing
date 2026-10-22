// src/lib/routine-moments/types.ts
export interface RoutineMomentData {
  [key: string]: any;
}

export interface RoutineMomentRecord {
  id: string;
  version: number;
  person_id: string;
  routine_name: string;
  observation_text: string;
  observation_data?: RoutineMomentData;
  observed_at: string; // ISO timestamp
  evidence_id?: string;
  care_event_id?: string;
  confidence?: number;
  status: string;
  created_at: string;
  updated_at: string;
  created_by_caregiver_id: string;
}

export interface RoutineMomentObservation {
  routine_name: string;
  observation_text: string;
  observation_data?: RoutineMomentData;
  observed_at: string; // ISO timestamp
  evidence_id?: string;
  care_event_id?: string;
  confidence?: number;
  person_id: string;
}

export interface RoutineMomentChange {
  field: string;
  previous_value: any;
  current_value: any;
  change_type: 'update' | 'correction' | 'insertion' | 'deletion';
  detected_at: string; // ISO timestamp
  confidence: number;
}

export interface RoutineBaseline {
  routine_name: string;
  person_id: string;
  frequency_per_week: number;
  average_time_of_day?: string; // ISO time string
  assistance_level_distribution: Record<string, number>;
  participation_level_distribution: Record<string, number>;
  consistency_score: number | null;
  last_updated: string; // ISO timestamp
  sample_size: number;
}

export enum ConfidenceLevel {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  UNKNOWN = 'unknown',
}