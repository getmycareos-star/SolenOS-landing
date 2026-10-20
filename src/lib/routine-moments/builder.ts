// src/lib/routine-moments/builder.ts
import { RoutineMomentObservation, RoutineMomentRecord, RoutineBaseline } from './types';
import { ConfidenceLevel } from './types';

/**
 * Create a routine moment observation from raw input.
 * @param params Observation parameters.
 * @returns Validated routine moment observation.
 */
export function createRoutineMomentObservation(params: {
  routine_name: string;
  observation_text: string;
  observed_at: string; // ISO timestamp
  person_id: string;
  observation_data?: Record<string, any>;
  evidence_id?: string;
  care_event_id?: string;
  confidence?: number;
}): RoutineMomentObservation {
  // Validate required fields
  if (!params.routine_name.trim()) {
    throw new Error('routine_name is required');
  }
  if (!params.observation_text.trim()) {
    throw new Error('observation_text is required');
  }
  if (!params.person_id.trim()) {
    throw new Error('person_id is required');
  }
  if (!params.observed_at) {
    throw new Error('observed_at is required');
  }

  // Validate ISO timestamp (basic check)
  const date = new Date(params.observed_at);
  if (isNaN(date.getTime())) {
    throw new Error('observed_at must be a valid ISO timestamp');
  }

  return {
    routine_name: params.routine_name.trim(),
    observation_text: params.observation_text.trim(),
    observed_at: params.observed_at,
    person_id: params.person_id,
    observation_data: params.observation_data,
    evidence_id: params.evidence_id,
    care_event_id: params.care_event_id,
    confidence: params.confidence,
  };
}

/**
 * Validate a routine moment observation.
 * @param observation The observation to validate.
 * @returns True if valid, throws error if invalid.
 */
export function validateRoutineMomentObservation(observation: RoutineMomentObservation): boolean {
  if (!observation.routine_name || !observation.routine_name.trim()) {
    throw new Error('routine_name is required and must not be empty');
  }
  if (!observation.observation_text || !observation.observation_text.trim()) {
    throw new Error('observation_text is required and must not be empty');
  }
  if (!observation.person_id || !observation.person_id.trim()) {
    throw new Error('person_id is required and must not be empty');
  }
  if (!observation.observed_at) {
    throw new Error('observed_at is required');
  }
  const date = new Date(observation.observed_at);
  if (isNaN(date.getTime())) {
    throw new Error('observed_at must be a valid ISO timestamp');
  }
  // Additional validation can be added here
  return true;
}

/**
 * Create a routine moment record from an observation (e.g., after storing).
 * @param observation The observation that was stored.
 * @param id The generated ID.
 * @param version The version number.
 * @param created_by_caregiver_id The ID of the caregiver who created the record.
 * @returns Routine moment record.
 */
export function createRoutineMomentRecord(
  observation: RoutineMomentObservation,
  id: string,
  version: number,
  created_by_caregiver_id: string
): RoutineMomentRecord {
  const now = new Date().toISOString();
  return {
    id,
    version,
    person_id: observation.person_id,
    routine_name: observation.routine_name,
    observation_text: observation.observation_text,
    observation_data: observation.observation_data,
    observed_at: observation.observed_at,
    evidence_id: observation.evidence_id,
    care_event_id: observation.care_event_id,
    confidence: observation.confidence,
    status: 'active',
    created_at: now,
    updated_at: now,
    created_by_caregiver_id,
  };
}

/**
 * Create a routine moment record from an API response.
 * @param apiResponse The response from the backend API.
 * @returns Routine moment record.
 */
export function createRoutineMomentFromApi(apiResponse: any): RoutineMomentRecord {
  // Assuming the API response matches our RoutineMomentRecord interface
  return apiResponse as RoutineMomentRecord;
}

/**
 * Validate that a routine moment record has all required fields.
 * @param record The record to validate.
 * @returns True if valid.
 */
export function validateRoutineMomentRecord(record: RoutineMomentRecord): boolean {
  // Reuse the observation validation for the relevant fields
  const observation: RoutineMomentObservation = {
    routine_name: record.routine_name,
    observation_text: record.observation_text,
    observed_at: record.observed_at,
    person_id: record.person_id,
    observation_data: record.observation_data,
    evidence_id: record.evidence_id,
    care_event_id: record.care_event_id,
    confidence: record.confidence,
  };
  validateRoutineMomentObservation(observation);
  // Additional record-specific validation
  if (!record.id) {
    throw new Error('id is required');
  }
  if (record.version === undefined) {
    throw new Error('version is required');
  }
  if (!record.status) {
    throw new Error('status is required');
  }
  if (!record.created_at) {
    throw new Error('created_at is required');
  }
  if (!record.updated_at) {
    throw new Error('updated_at is required');
  }
  if (!record.created_by_caregiver_id) {
    throw new Error('created_by_caregiver_id is required');
  }
  return true;
}

/**
 * Create an empty baseline for a routine (when no observations are available).
 * @param routineName The name of the routine.
 * @param personId The ID of the person.
 * @returns An empty baseline.
 */
export function createEmptyBaseline(routineName: string, personId: string): RoutineBaseline {
  return {
    routine_name: routineName,
    person_id: personId,
    frequency_per_week: 0,
    average_time_of_day: '00:00',
    assistance_level_distribution: {},
    participation_level_distribution: {},
    consistency_score: 0,
    last_updated: new Date().toISOString(),
    sample_size: 0,
  };
}

/**
 * Merge two baselines (e.g., when updating with new observations).
 * @param baseline1 First baseline.
 * @param baseline2 Second baseline (usually newer).
 * @param weight Weight for the second baseline (0 to 1). Default 0.5.
 * @returns Merged baseline.
 */
export function mergeBaselines(
  baseline1: RoutineBaseline,
  baseline2: RoutineBaseline,
  weight: number = 0.5
): RoutineBaseline {
  if (baseline1.routine_name !== baseline2.routine_name) {
    throw new Error('Cannot merge baselines for different routines');
  }
  if (baseline1.person_id !== baseline2.person_id) {
    throw new Error('Cannot merge baselines for different persons');
  }

  // Simple weighted averaging for numeric fields
  const merged: RoutineBaseline = {
    routine_name: baseline1.routine_name,
    person_id: baseline1.person_id,
    frequency_per_week: baseline1.frequency_per_week * (1 - weight) + baseline2.frequency_per_week * weight,
    average_time_of_day: baseline2.average_time_of_day, // Use the newer one for simplicity
    assistance_level_distribution: {},
    participation_level_distribution: {},
    consistency_score: baseline1.consistency_score * (1 - weight) + baseline2.consistency_score * weight,
    last_updated: new Date().toISOString(),
    sample_size: baseline1.sample_size + baseline2.sample_size,
  };

  // Merge distributions (weighted average of proportions)
  const allAssistanceKeys = new Set([
    ...Object.keys(baseline1.assistance_level_distribution),
    ...Object.keys(baseline2.assistance_level_distribution),
  ]);
  allAssistanceKeys.forEach(key => {
    const val1 = baseline1.assistance_level_distribution[key] || 0;
    const val2 = baseline2.assistance_level_distribution[key] || 0;
    merged.assistance_level_distribution[key] = val1 * (1 - weight) + val2 * weight;
  });

  const allParticipationKeys = new Set([
    ...Object.keys(baseline1.participation_level_distribution),
    ...Object.keys(baseline2.participation_level_distribution),
  ]);
  allParticipationKeys.forEach(key => {
    const val1 = baseline1.participation_level_distribution[key] || 0;
    const val2 = baseline2.participation_level_distribution[key] || 0;
    merged.participation_level_distribution[key] = val1 * (1 - weight) + val2 * weight;
  });

  return merged;
}