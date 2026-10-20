/**
 * Routine Moments Service — business logic for routine moment operations.
 * 
 * Handles baseline establishment, change detection, and integration with
 * other SolenOS systems like CareContext, Outcome Memory, etc.
 */

import type {
  RoutineMomentRecord,
  RoutineMomentObservation,
  RoutineMomentChange,
  RoutineBaseline,
  RoutineMomentType,
  RoutineObservationState,
  AssistanceLevel,
  ParticipationLevel,
  RoutineFrequency,
  ConfidenceLevel,
  SourceType
} from "./types";
import {
  createRoutineMomentObservation,
  createRoutineBaseline,
  createRoutineMomentChange,
  createRoutineMomentRecord,
  validateRoutineMomentObservation,
  validateRoutineMomentRecord
} from "./builder";
import { getRoutineMomentsStore } from "./store";

/**
 * Establish or update a baseline for a routine moment based on observations.
 * 
 * Implements the specification requirement that "Baseline must be earned from evidence."
 */
export function establishBaselineFromObservations(
  personId: string,
  routineType: RoutineMomentType,
  observations: RoutineMomentObservation[]
): RoutineBaseline {
  // Filter to only observations for this person and routine type
  const relevantObservations = observations.filter(
    obs => obs.person_id === personId && obs.routine_type === routineType
  );
  
  if (relevantObservations.length === 0) {
    // No observations - baseline not established
    return createRoutineBaseline({
      is_established: false,
      confidence: "unknown",
      evidence_ids: []
    });
  }
  
  // Separate occurrences from non-occurrences
  const occurrences = relevantObservations.filter(
    obs => obs.observation_state === "occurred"
  );
  
  const missedOccurrences = relevantObservations.filter(
    obs => obs.observation_state === "missed"
  );
  
  const notObserved = relevantObservations.filter(
    obs => obs.observation_state === "not_observed"
  );
  
  // Calculate frequency based on occurrences
  const totalDays = calculateDateRange(relevantObservations);
  const frequency = calculateFrequency(occurrences.length, totalDays);
  
  // Calculate typical time window if relevant
  const typicalTimeWindow = calculateTypicalTimeWindow(occurrences);
  
  // Calculate typical assistance level if relevant
  const typicalAssistanceLevel = calculateTypicalAssistanceLevel(occurrences);
  
  // Calculate typical participation level if relevant
  const typicalParticipationLevel = calculateTypicalParticipationLevel(occurrences);
  
  // Determine confidence based on number and consistency of observations
  const confidence = calculateBaselineConfidence(
    occurrences.length,
    missedOccurrences.length,
    notObserved.length,
    totalDays
  );
  
  // Collect evidence IDs
  const evidenceIds = [
    ...relevantObservations.map(obs => obs.raw_evidence_id).filter(Boolean),
    ...relevantObservations.map(obs => obs.care_event_id).filter(Boolean)
  ];
  
  // Create pattern description
  const patternDescription = createPatternDescription(
    routineType,
    occurrences.length,
    missedOccurrences.length,
    frequency,
    typicalTimeWindow,
    typicalAssistanceLevel,
    typicalParticipationLevel
  );
  
  return createRoutineBaseline({
    is_established: confidence !== "unknown" && occurrences.length > 0,
    pattern_description: patternDescription,
    frequency,
    typical_time_window: typicalTimeWindow,
    typical_assistance_level: typicalAssistanceLevel,
    typical_participation_level: typicalParticipationLevel,
    confidence,
    evidence_ids: evidenceIds,
    baseline_period: {
      start_date: getEarliestDate(relevantObservations),
      end_date: getLatestDate(relevantObservations)
    },
    last_updated_at: new Date().toISOString()
  });
}

/**
 * Detect changes in routine moment patterns by comparing recent observations
 * against an established baseline.
 * 
 * Implements the specification requirement for detecting:
 * "This normally happens. Something about that pattern changed."
 */
export function detectRoutineMomentChanges(
  personId: string,
  routineType: RoutineMomentType,
  baseline: RoutineBaseline,
  observations: RoutineMomentObservation[],
  analysisPeriod: {
    start_date: string;
    end_date: string;
  }
): RoutineMomentChange[] {
  // If baseline is not established, we can't detect changes
  if (!baseline.is_established) {
    return [];
  }
  
  // Filter observations to the analysis period and person/routine type
  const relevantObservations = observations.filter(
    obs => 
      obs.person_id === personId &&
      obs.routine_type === routineType &&
      isDateInRange(obs.occurred_at, analysisPeriod.start_date, analysisPeriod.end_date)
  );
  
  if (relevantObservations.length === 0) {
    return [];
  }
  
  const changes: RoutineMomentChange[] = [];
  
  // Check for frequency changes
  const frequencyChange = detectFrequencyChange(baseline, routineType, relevantObservations);
  if (frequencyChange) {
    changes.push(frequencyChange);
  }
  
  // Check for timing changes
  const timingChange = detectTimingChange(baseline, routineType, relevantObservations);
  if (timingChange) {
    changes.push(timingChange);
  }
  
  // Check for assistance level changes
  const assistanceChange = detectAssistanceLevelChange(baseline, routineType, relevantObservations);
  if (assistanceChange) {
    changes.push(assistanceChange);
  }
  
  // Check for participation level changes
  const participationChange = detectParticipationLevelChange(baseline, routineType, relevantObservations);
  if (participationChange) {
    changes.push(participationChange);
  }
  
  // Check for consistency changes
  const consistencyChange = detectConsistencyChange(baseline, routineType, relevantObservations);
  if (consistencyChange) {
    changes.push(consistencyChange);
  }
  
  // Mark sustained changes based on persistence over time
  markSustainedChanges(changes, relevantObservations, analysisPeriod);
  
  return changes;
}

/**
 * Create a new routine moment observation from caregiver input.
 */
export function createObservationFromInput(
  input: Omit<
    RoutineMomentObservation,
    "id" | "created_at" | "updated_at" | "metadata"
  > & {
    metadata?: Record<string, unknown>;
  }
): RoutineMomentObservation {
  const observation = createRoutineMomentObservation(input);
  validateRoutineMomentObservation(observation);
  return observation;
}

/**
 * Get or create a routine moment record for a person and routine type.
 */
export async function getOrCreateRoutineMomentRecord(
  personId: string,
  routineType: RoutineMomentType
): Promise<RoutineMomentRecord> {
  const store = getRoutineMomentsStore();
  const existingRecords = store.getForPersonAndType(personId, routineType);
  
  if (existingRecords.length > 0) {
    // Return the most recent record
    return existingRecords[0]; // Assuming sorted by updated_at descending
  }
  
  // Create a new record
  const newRecord = createRoutineMomentRecord({
    person_id: personId,
    routine_type: routineType
  });
  
  await store.save(newRecord);
  return newRecord;
}

/**
 * Add an observation to a routine moment record.
 */
export async function addObservationToRoutineMoment(
  personId: string,
  routineType: RoutineMomentType,
  observation: RoutineMomentObservation
): Promise<RoutineMomentRecord> {
  const store = getRoutineMomentsStore();
  // Get or create the routine moment record
  let record = await getOrCreateRoutineMomentRecord(personId, routineType);
  
  // Add the observation
  record.observations.push(observation);
  
  // Re-establish baseline based on all observations
  const allObservations = [
    ...store.getForPerson(personId)
      .flatMap(r => r.observations)
      .filter(o => o.person_id === personId && o.routine_type === routineType),
    observation
  ];
  
  record.baseline = establishBaselineFromObservations(personId, routineType, allObservations);
  
  // Detect changes
  const analysisPeriod = {
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 30 days ago
    end_date: new Date().toISOString().split("T")[0]
  };
  
  record.changes = detectRoutineMomentChanges(
    personId,
    routineType,
    record.baseline,
    allObservations,
    analysisPeriod
  );
  
  // Update timestamp
  record.updated_at = new Date().toISOString();
  
  // Validate and save
  validateRoutineMomentRecord(record);
  await store.save(record);
  
  return record;
}

/**
 * Helper function to calculate date range of observations.
 */
function calculateDateRange(observations: RoutineMomentObservation[]): number {
  if (observations.length === 0) return 0;
  
  const dates = observations.map(obs => new Date(obs.occurred_at));
  const earliest = new Date(Math.min(...dates.map(d => d.getTime())));
  const latest = new Date(Math.max(...dates.map(d => d.getTime())));
  
  return Math.ceil((latest.getTime() - earliest.getTime()) / (24 * 60 * 60 * 1000)) + 1;
}

/**
 * Helper function to calculate frequency based on occurrences and days.
 */
function calculateFrequency(occurrenceCount: number, totalDays: number): RoutineFrequency {
  if (totalDays === 0) return "unknown";
  
  const frequencyPerDay = occurrenceCount / totalDays;
  
  if (frequencyPerDay >= 1) return "multiple_times";
  if (frequencyPerDay >= 0.5) return "daily";
  if (frequencyPerDay >= 1/7) return "weekly";
  if (occurrenceCount > 0) return "irregular";
  return "unknown";
}

/**
 * Helper function to calculate typical time window from observations.
 */
function calculateTypicalTimeWindow(observations: RoutineMomentObservation[]): string | undefined {
  if (observations.length === 0) return undefined;
  
  // Extract time of day from timestamps
  const times = observations
    .map(obs => new Date(obs.occurred_at))
    .map(date => date.getHours() * 60 + date.getMinutes()); // minutes since midnight
  
  if (times.length === 0) return undefined;
  
  // Sort times
  times.sort((a, b) => a - b);
  
  // Calculate median time
  const medianIndex = Math.floor(times.length / 2);
  const medianTime = times.length % 2 === 0
    ? (times[medianIndex - 1] + times[medianIndex]) / 2
    : times[medianIndex];
  
  // Convert back to hours/minutes
  const hours = Math.floor(medianTime / 60);
  const minutes = Math.floor(medianTime % 60);
  
  // Create a time window description
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Helper function to calculate typical assistance level.
 */
function calculateTypicalAssistanceLevel(
  observations: RoutineMomentObservation[]
): AssistanceLevel | undefined {
  if (observations.length === 0) return undefined;
  
  // Count assistance levels
  const assistanceCounts: Record<AssistanceLevel, number> = {
    independent: 0,
    supervised: 0,
    partial_assistance: 0,
    full_assistance: 0,
    unknown: 0
  };
  
  for (const obs of observations) {
    if (obs.assistance_level) {
      assistanceCounts[obs.assistance_level] = 
        (assistanceCounts[obs.assistance_level] ?? 0) + 1;
    }
  }
  
  // Find the most common assistance level (excluding unknown if possible)
  let maxCount = 0;
  let typicalLevel: AssistanceLevel | undefined = undefined;
  
  for (const [level, count] of Object.entries(assistanceCounts)) {
    if (level !== "unknown" && count > maxCount) {
      maxCount = count;
      typicalLevel = level as AssistanceLevel;
    }
  }
  
  // If all are unknown, return unknown
  if (typicalLevel === undefined && assistanceCounts.unknown > 0) {
    return "unknown";
  }
  
  return typicalLevel;
}

/**
 * Helper function to calculate typical participation level.
 */
function calculateTypicalParticipationLevel(
  observations: RoutineMomentObservation[]
): ParticipationLevel | undefined {
  if (observations.length === 0) return undefined;
  
  // Count participation levels
  const participationCounts: Record<ParticipationLevel, number> = {
    independent_participation: 0,
    assisted_participation: 0,
    non_participation: 0,
    unknown: 0
  };
  
  for (const obs of observations) {
    if (obs.participation_level) {
      participationCounts[obs.participation_level] = 
        (participationCounts[obs.participation_level] ?? 0) + 1;
    }
  }
  
  // Find the most common participation level (excluding unknown if possible)
  let maxCount = 0;
  let typicalLevel: ParticipationLevel | undefined = undefined;
  
  for (const [level, count] of Object.entries(participationCounts)) {
    if (level !== "unknown" && count > maxCount) {
      maxCount = count;
      typicalLevel = level as ParticipationLevel;
    }
  }
  
  // If all are unknown, return unknown
  if (typicalLevel === undefined && participationCounts.unknown > 0) {
    return "unknown";
  }
  
  return typicalLevel;
}

/**
 * Helper function to calculate baseline confidence.
 */
function calculateBaselineConfidence(
  occurrenceCount: number,
  missedCount: number,
  notObservedCount: number,
  totalDays: number
): ConfidenceLevel {
  const totalObservations = occurrenceCount + missedCount + notObservedCount;
  
  if (totalObservations === 0) return "unknown";
  
  // More observations = higher confidence
  // Consistency of observations = higher confidence
  // More recent observations = higher confidence
  
  const observationDensity = totalObservations / Math.max(totalDays, 1);
  
  if (observationDensity >= 0.8 && totalObservations >= 10) {
    return "high";
  } else if (observationDensity >= 0.5 && totalObservations >= 5) {
    return "medium";
  } else if (totalObservations >= 2) {
    return "low";
  } else {
    return "unknown";
  }
}

/**
 * Helper function to create a pattern description.
 */
function createPatternDescription(
  routineType: RoutineMomentType,
  occurrenceCount: number,
  missedCount: number,
  frequency: RoutineFrequency,
  typicalTimeWindow: string | undefined,
  typicalAssistanceLevel: AssistanceLevel | undefined,
  typicalParticipationLevel: ParticipationLevel | undefined
): string {
  let description = `${routineType.replace(/_/g, ' ')}`;
  
  if (occurrenceCount > 0 || missedCount > 0) {
    description += ` occurs`;
    
    switch (frequency) {
      case "multiple_times":
        description += " multiple times per day";
        break;
      case "daily":
        description += " daily";
        break;
      case "weekly":
        description += " weekly";
        break;
      case "irregular":
        description += " irregularly";
        break;
      case "once":
        description += " once";
        break;
      default:
        description += " with unknown frequency";
    }
    
    if (typicalTimeWindow) {
      description += ` around ${typicalTimeWindow}`;
    }
    
    if (typicalAssistanceLevel && typicalAssistanceLevel !== "unknown") {
      description += ` with ${typicalAssistanceLevel.replace(/_/g, ' ')} assistance`;
    }
    
    if (typicalParticipationLevel && typicalParticipationLevel !== "unknown") {
      description += ` and ${typicalParticipationLevel.replace(/_/g, ' ')} participation`;
    }
  } else {
    description += ` has not been observed`;
  }
  
  if (missedCount > 0) {
    description += ` with ${missedCount} missed occurrence${missedCount === 1 ? '' : 's'}`;
  }
  
  return description;
}

/**
 * Helper function to get the earliest date from observations.
 */
function getEarliestDate(observations: RoutineMomentObservation[]): string {
  if (observations.length === 0) {
    return new Date().toISOString().split("T")[0];
  }
  
  const dates = observations.map(obs => new Date(obs.occurred_at));
  const earliest = new Date(Math.min(...dates.map(d => d.getTime())));
  return earliest.toISOString().split("T")[0];
}

/**
 * Helper function to get the latest date from observations.
 */
function getLatestDate(observations: RoutineMomentObservation[]): string {
  if (observations.length === 0) {
    return new Date().toISOString().split("T")[0];
  }
  
  const dates = observations.map(obs => new Date(obs.occurred_at));
  const latest = new Date(Math.max(...dates.map(d => d.getTime())));
  return latest.toISOString().split("T")[0];
}

/**
 * Helper function to check if a date is in range.
 */
function isDateInRange(dateString: string, startDateString: string, endDateString: string): boolean {
  const date = new Date(dateString);
  const startDate = new Date(startDateString);
  const endDate = new Date(endDateString);
  
  return date >= startDate && date <= endDate;
}

/**
 * Helper function to detect frequency changes.
 */
function detectFrequencyChange(
  baseline: RoutineBaseline,
  routineType: RoutineMomentType,
  observations: RoutineMomentObservation[]
): RoutineMomentChange | null {
  if (observations.length === 0) return null;
  
  // Calculate current frequency
  const totalDays = calculateDateRange(observations);
  const occurrenceCount = observations.filter(o => o.observation_state === "occurred").length;
  const currentFrequency = calculateFrequency(occurrenceCount, totalDays);
  
  // Compare with baseline frequency
  if (baseline.frequency === currentFrequency) {
    return null; // No change
  }
  
  // Determine change type
  let changeType: RoutineMomentChange["change_type"];
  let description: string;
  
  if (
    (baseline.frequency === "daily" && currentFrequency === "weekly") ||
    (baseline.frequency === "multiple_times" && currentFrequency === "daily") ||
    (baseline.frequency === "weekly" && currentFrequency === "irregular")
  ) {
    changeType = "frequency_decrease";
    description = `${baseline.routine_type.replace(/_/g, ' ')} frequency has decreased`;
  } else if (
    (baseline.frequency === "weekly" && currentFrequency === "daily") ||
    (baseline.frequency === "daily" && currentFrequency === "multiple_times") ||
    (baseline.frequency === "irregular" && currentFrequency === "weekly")
  ) {
    changeType = "frequency_increase";
    description = `${baseline.routine_type.replace(/_/g, ' ')} frequency has increased`;
  } else {
    changeType = "frequency_increase"; // Default
    description = `${baseline.routine_type.replace(/_/g, ' ')} frequency has changed`;
  }
  
  // Create change observation
  return createRoutineMomentChange({
    person_id: observations[0].person_id,
    routine_type: observations[0].routine_type,
    change_description: description,
    change_type,
    observation_period_start: getEarliestDate(observations),
    observation_period_end: getLatestDate(observations),
    confidence: calculateBaselineConfidence(
      occurrenceCount,
      observations.filter(o => o.observation_state === "missed").length,
      observations.filter(o => o.observation_state === "not_observed").length,
      totalDays
    ),
    evidence_ids: observations
      .map(o => o.raw_evidence_id)
      .filter(Boolean)
      .concat(observations.map(o => o.care_event_id).filter(Boolean))
  });
}

/**
 * Helper function to detect timing changes.
 */
function detectTimingChange(
  baseline: RoutineBaseline,
  routineType: RoutineMomentType,
  observations: RoutineMomentObservation[]
): RoutineMomentChange | null {
  if (!baseline.typical_time_window || observations.length === 0) return null;
  
  const currentTimeWindow = calculateTypicalTimeWindow(observations);
  if (!currentTimeWindow) return null;
  
  // Simple string comparison - in reality we'd want to compare actual times
  if (baseline.typical_time_window === currentTimeWindow) {
    return null; // No change
  }
  
  // Determine if shift is earlier or later
  const baselineHour = parseInt(baseline.typical_time_window.split(":")[0]);
  const currentHour = parseInt(currentTimeWindow.split(":")[0]);
  
  let changeType: RoutineMomentChange["change_type"];
  let description: string;
  
  if (currentHour < baselineHour) {
    changeType = "timing_shift_earlier";
    description = `${baseline.routine_type.replace(/_/g, ' ')} is occurring earlier than usual`;
  } else if (currentHour > baselineHour) {
    changeType = "timing_shift_later";
    description = `${baseline.routine_type.replace(/_/g, ' ')} is occurring later than usual`;
  } else {
    changeType = "timing_shift_earlier"; // Default
    description = `${baseline.routine_type.replace(/_/g, ' ')} timing has changed`;
  }
  
  // Create change observation
  return createRoutineMomentChange({
    person_id: observations[0].person_id,
    routine_type: observations[0].routine_type,
    change_description: description,
    change_type,
    observation_period_start: getEarliestDate(observations),
    observation_period_end: getLatestDate(observations),
    confidence: calculateBaselineConfidence(
      observations.filter(o => o.observation_state === "occurred").length,
      observations.filter(o => o.observation_state === "missed").length,
      observations.filter(o => o.observation_state === "not_observed").length,
      calculateDateRange(observations)
    ),
    evidence_ids: observations
      .map(o => o.raw_evidence_id)
      .filter(Boolean)
      .concat(observations.map(o => o.care_event_id).filter(Boolean))
  });
}

/**
 * Helper function to detect assistance level changes.
 */
function detectAssistanceLevelChange(
  baseline: RoutineBaseline,
  routineType: RoutineMomentType,
  observations: RoutineMomentObservation[]
): RoutineMomentChange | null {
  if (!baseline.typical_assistance_level || observations.length === 0) return null;
  
  const currentAssistanceLevel = calculateTypicalAssistanceLevel(observations);
  if (!currentAssistanceLevel) return null;
  
  // Compare assistance levels
  const assistanceOrder: AssistanceLevel[] = [
    "independent",
    "supervised",
    "partial_assistance",
    "full_assistance"
  ];
  
  const baselineIndex = assistanceOrder.indexOf(baseline.typical_assistance_level as AssistanceLevel);
  const currentIndex = assistanceOrder.indexOf(currentAssistanceLevel);
  
  if (baselineIndex === currentIndex) {
    return null; // No change
  }
  
  let changeType: RoutineMomentChange["change_type"];
  let description: string;
  
  if (currentIndex > baselineIndex) {
    changeType = "assistance_increase";
    description = `${baseline.routine_type.replace(/_/g, ' ')} assistance level has increased`;
  } else {
    changeType = "assistance_decrease";
    description = `${baseline.routine_type.replace(/_/g, ' ')} assistance level has decreased`;
  }
  
  // Create change observation
  return createRoutineMomentChange({
    person_id: observations[0].person_id,
    routine_type: observations[0].routine_type,
    change_description: description,
    change_type,
    observation_period_start: getEarliestDate(observations),
    observation_period_end: getLatestDate(observations),
    confidence: calculateBaselineConfidence(
      observations.filter(o => o.observation_state === "occurred").length,
      observations.filter(o => o.observation_state === "missed").length,
      observations.filter(o => o.observation_state === "not_observed").length,
      calculateDateRange(observations)
    ),
    evidence_ids: observations
      .map(o => o.raw_evidence_id)
      .filter(Boolean)
      .concat(observations.map(o => o.care_event_id).filter(Boolean))
  });
}

/**
 * Helper function to detect participation level changes.
 */
function detectParticipationLevelChange(
  baseline: RoutineBaseline,
  routineType: RoutineMomentType,
  observations: RoutineMomentObservation[]
): RoutineMomentChange | null {
  if (!baseline.typical_participation_level || observations.length === 0) return null;
  
  const currentParticipationLevel = calculateTypicalParticipationLevel(observations);
  if (!currentParticipationLevel) return null;
  
  // Compare participation levels
  const participationOrder: ParticipationLevel[] = [
    "independent_participation",
    "assisted_participation",
    "non_participation"
  ];
  
  const baselineIndex = participationOrder.indexOf(baseline.typical_participation_level as ParticipationLevel);
  const currentIndex = participationOrder.indexOf(currentParticipationLevel);
  
  if (baselineIndex === currentIndex) {
    return null; // No change
  }
  
  let changeType: RoutineMomentChange["change_type"];
  let description: string;
  
  // For participation, any change is significant
  changeType = "participation_change";
  description = `${baseline.routine_type.replace(/_/g, ' ')} participation level has changed`;
  
  // Create change observation
  return createRoutineMomentChange({
    person_id: observations[0].person_id,
    routine_type: observations[0].routine_type,
    change_description: description,
    change_type,
    observation_period_start: getEarliestDate(observations),
    observation_period_end: getLatestDate(observations),
    confidence: calculateBaselineConfidence(
      observations.filter(o => o.observation_state === "occurred").length,
      observations.filter(o => o.observation_state === "missed").length,
      observations.filter(o => o.observation_state === "not_observed").length,
      calculateDateRange(observations)
    ),
    evidence_ids: observations
      .map(o => o.raw_evidence_id)
      .filter(Boolean)
      .concat(observations.map(o => o.care_event_id).filter(Boolean))
  });
}

/**
 * Helper function to detect consistency changes.
 */
function detectConsistencyChange(
  baseline: RoutineBaseline,
  routineType: RoutineMomentType,
  observations: RoutineMomentObservation[]
): RoutineMomentChange | null {
  if (observations.length < 3) return null; // Need at least 3 observations to assess consistency
  
  // Calculate consistency as percentage of occurrences vs total observations
  const occurrenceCount = observations.filter(o => o.observation_state === "occurred").length;
  const totalCount = observations.length;
  const consistency = occurrenceCount / totalCount;
  
  // Baseline consistency would be based on historical data
  // For now, we'll consider significant changes in consistency
  const baselineConsistency = 0.8; // Assume 80% consistency as baseline
  
  const consistencyChange = Math.abs(consistency - baselineConsistency);
  
  if (consistencyChange < 0.2) {
    return null; // Change not significant enough
  }
  
  let changeType: RoutineMomentChange["change_type"];
  let description: string;
  
  if (consistency < baselineConsistency) {
    changeType = "consistency_change";
    description = `${baseline.routine_type.replace(/_/g, ' ')} has become less consistent`;
  } else {
    changeType = "consistency_change";
    description = `${baseline.routine_type.replace(/_/g, ' ')} has become more consistent`;
  }
  
  // Create change observation
  return createRoutineMomentChange({
    person_id: observations[0].person_id,
    routine_type: observations[0].routine_type,
    change_description: description,
    change_type,
    observation_period_start: getEarliestDate(observations),
    observation_period_end: getLatestDate(observations),
    confidence: "medium", // Medium confidence for consistency changes
    evidence_ids: observations
      .map(o => o.raw_evidence_id)
      .filter(Boolean)
      .concat(observations.map(o => o.care_event_id).filter(Boolean))
  });
}

/**
 * Helper function to mark changes as sustained based on persistence.
 */
function markSustainedChanges(
  changes: RoutineMomentChange[],
  observations: RoutineMomentObservation[],
  analysisPeriod: {
    start_date: string;
    end_date: string;
  }
): void {
  // For now, we'll mark changes as sustained if they persist over multiple observations
  // In a more sophisticated implementation, we'd look at trends over time
  
  for (const change of changes) {
    // Count how many observations support this change
    const supportingObservations = observations.filter(obs => {
      // Simple heuristic: if observation differs from baseline in the changed aspect
      // This is simplified - real implementation would be more specific to change type
      return obs.observation_state === "occurred"; // Just a placeholder
    });
    
    // If we have enough supporting observations, mark as sustained
    if (supportingObservations.length >= 3) {
      change.is_sustained_change = true;
    }
  }
}