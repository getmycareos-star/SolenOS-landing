/**
 * Routine Moments Builder — helper functions for creating routine moment data.
 * 
 * Provides factory functions for creating routine moment observations,
 * baselines, and change detections with proper defaults and validation.
 */

import type {
  RoutineMomentObservation,
  RoutineBaseline,
  RoutineMomentChange,
  RoutineMomentType,
  RoutineObservationState,
  AssistanceLevel,
  ParticipationLevel,
  RoutineFrequency,
  ConfidenceLevel,
  SourceType
} from "./types";

/**
 * Create a routine moment observation with sensible defaults.
 */
export function createRoutineMomentObservation(
  input: Omit<
    RoutineMomentObservation,
    "id" | "created_at" | "updated_at" | "metadata"
  > & {
    metadata?: Record<string, unknown>;
  }
): RoutineMomentObservation {
  const now = new Date().toISOString();
  const id = `rmo_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    id,
    created_at: now,
    updated_at: now,
    metadata: input.metadata ?? {},
    ...input
  };
}

/**
 * Create a routine baseline with sensible defaults.
 */
export function createRoutineBaseline(
  input: Partial<RoutineBaseline> = {}
): RoutineBaseline {
  const now = new Date().toISOString();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  return {
    is_established: input.is_established ?? false,
    pattern_description: input.pattern_description,
    frequency: input.frequency,
    typical_time_window: input.typical_time_window,
    typical_assistance_level: input.typical_assistance_level,
    typical_participation_level: input.typical_participation_level,
    confidence: input.confidence ?? "unknown",
    evidence_ids: input.evidence_ids ?? [],
    baseline_period: input.baseline_period ?? {
      start_date: thirtyDaysAgo.toISOString().split("T")[0],
      end_date: new Date().toISOString().split("T")[0]
    },
    last_updated_at: input.last_updated_at ?? now,
  };
}

/**
 * Create a routine moment change detection result.
 */
export function createRoutineMomentChange(
  input: Omit<
    RoutineMomentChange,
    "id" | "created_at" | "updated_at" | "metadata"
  > & {
    metadata?: Record<string, unknown>;
  }
): RoutineMomentChange {
  const now = new Date().toISOString();
  const id = `rmc_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    id,
    created_at: now,
    updated_at: now,
    metadata: input.metadata ?? {},
    ...input
  };
}

/**
 * Create a complete routine moment record.
 */
export function createRoutineMomentRecord(
  input: Omit<
    RoutineMomentRecord,
    "id" | "created_at" | "updated_at" | "metadata" | "baseline" | "observations" | "changes"
  > & {
    metadata?: Record<string, unknown>;
    baseline?: Partial<RoutineBaseline>;
    observations?: RoutineMomentObservation[];
    changes?: RoutineMomentChange[];
  }
): RoutineMomentRecord {
  const now = new Date().toISOString();
  const id = `rmr_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    id,
    created_at: now,
    updated_at: now,
    metadata: input.metadata ?? {},
    baseline: input.baseline ?? createRoutineBaseline(),
    observations: input.observations ?? [],
    changes: input.changes ?? [],
    ...input
  };
}

/**
 * Validate a routine moment observation.
 * Returns true if valid, throws error if invalid.
 */
export function validateRoutineMomentObservation(
  observation: RoutineMomentObservation
): boolean {
  // Basic validation
  if (!observation.person_id) {
    throw new Error("person_id is required");
  }
  
  if (!observation.routine_type) {
    throw new Error("routine_type is required");
  }
  
  if (!observation.observation_state) {
    throw new Error("observation_state is required");
  }
  
  if (!observation.recorded_by) {
    throw new Error("recorded_by is required");
  }
  
  if (!observation.source) {
    throw new Error("source is required");
  }
  
  if (!observation.occurred_at) {
    throw new Error("occurred_at is required");
  }
  
  // Validate occurred_at is a valid ISO timestamp
  const occurredAtDate = new Date(observation.occurred_at);
  if (isNaN(occurredAtDate.getTime())) {
    throw new Error("occurred_at must be a valid ISO timestamp");
  }
  
  return true;
}

/**
 * Validate a routine moment record.
 * Returns true if valid, throws error if invalid.
 */
export function validateRoutineMomentRecord(
  record: RoutineMomentRecord
): boolean {
  // Basic validation
  if (!record.person_id) {
    throw new Error("person_id is required");
  }
  
  if (!record.routine_type) {
    throw new Error("routine_type is required");
  }
  
  // Validate baseline
  if (!record.baseline) {
    throw new Error("baseline is required");
  }
  
  if (typeof record.baseline.is_established !== "boolean") {
    throw new Error("baseline.is_established must be a boolean");
  }
  
  // Validate observations
  for (const observation of record.observations) {
    validateRoutineMomentObservation(observation);
  }
  
  // Validate changes
  for (const change of record.changes) {
    // Basic change validation
    if (!change.person_id) {
      throw new Error("change.person_id is required");
    }
    
    if (!change.routine_type) {
      throw new Error("change.routine_type is required");
    }
    
    if (!change.change_description) {
      throw new Error("change.change_description is required");
    }
    
    if (!change.change_type) {
      throw new Error("change.change_type is required");
    }
    
    if (!change.observation_period_start) {
      throw new Error("change.observation_period_start is required");
    }
    
    if (!change.observation_period_end) {
      throw new Error("change.observation_period_end is required");
    }
    
    if (!change.confidence) {
      throw new Error("change.confidence is required");
    }
  }
  
  return true;
}