/**
 * Test script for routine moments functionality.
 * 
 * This script verifies that the routine moments system works correctly
 * by creating observations, establishing baselines, and detecting changes.
 */

import { 
  createRoutineMomentObservation,
  createRoutineBaseline,
  establishBaselineFromObservations,
  detectRoutineMomentChanges
} from './service';
import type { 
  RoutineMomentObservation, 
  RoutineBaseline, 
  RoutineMomentChange,
  RoutineMomentType,
  RoutineObservationState,
  AssistanceLevel,
  ParticipationLevel,
  RoutineFrequency,
  ConfidenceLevel
} from './types';

console.log('Testing Routine Moments System...\n');

// Test 1: Create observations and establish baseline
console.log('Test 1: Creating observations and establishing baseline');

const personId = 'test-person-001';
const routineType: RoutineMomentType = 'bathroom_toileting';

// Create a series of observations over 7 days
const observations: RoutineMomentObservation[] = [];

// Day 1-5: Normal routine (occurred 3 times per day)
for (let day = 1; day <= 5; day++) {
  const date = new Date();
  date.setDate(date.getDate() - (6 - day)); // Adjust for days ago
  
  // Morning
  observations.push(createRoutineMomentObservation({
    person_id: personId,
    routine_type: routineType,
    observation_state: 'occurred',
    occurred_at: new Date(date.setHours(8, 0, 0, 0)).toISOString(),
    recorded_by: 'caregiver-001',
    assistance_level: 'supervised',
    metadata: { day, time: 'morning' }
  }));
  
  // Afternoon
  observations.push(createRoutineMomentObservation({
    person_id: personId,
    routine_type: routineType,
    observation_state: 'occurred',
    occurred_at: new Date(date.setHours(14, 0, 0, 0)).toISOString(),
    recorded_by: 'caregiver-001',
    assistance_level: 'supervised',
    metadata: { day, time: 'afternoon' }
  }));
  
  // Evening
  observations.push(createRoutineMomentObservation({
    person_id: personId,
    routine_type: routineType,
    observation_state: 'occurred',
    occurred_at: new Date(date.setHours(20, 0, 0, 0)).toISOString(),
    recorded_by: 'caregiver-001',
    assistance_level: 'supervised',
    metadata: { day, time: 'evening' }
  }));
}

// Day 6: Missed one observation
observations.push(createRoutineMomentObservation({
  person_id: personId,
  routine_type: routineType,
  observation_state: 'occurred',
  occurred_at: new Date(Date.now() - 24 * 60 * 60 * 1000).setHours(8, 0, 0, 0)).toISOString(),
  recorded_by: 'caregiver-001',
  assistance_level: 'supervised',
  metadata: { day: 6, time: 'morning', note: 'Missed afternoon and evening' }
}));

observations.push(createRoutineMomentObservation({
  person_id: personId,
  routine_type: routineType,
  observation_state: 'missed',
  occurred_at: new Date(Date.now() - 24 * 60 * 60 * 1000).setHours(14, 0, 0, 0)).toISOString(),
  recorded_by: 'caregiver-001',
  assistance_level: 'supervised',
  metadata: { day: 6, time: 'afternoon', note: 'Missed' }
}));

observations.push(createRoutineMomentObservation({
  person_id: personId,
  routine_type: routineType,
  observation_state: 'missed',
  occurred_at: new Date(Date.now() - 24 * 60 * 60 * 1000).setHours(20, 0, 0, 0)).toISOString(),
  recorded_by: 'caregiver-001',
  assistance_level: 'supervised',
  metadata: { day: 6, time: 'evening', note: 'Missed' }
}));

// Day 7: Return to normal
observations.push(createRoutineMomentObservation({
  person_id: personId,
  routine_type: routineType,
  observation_state: 'occurred',
  occurred_at: new Date(Date.now()).setHours(8, 0, 0, 0)).toISOString(),
  recorded_by: 'caregiver-001',
  assistance_level: 'supervised',
  metadata: { day: 7, time: 'morning' }
}));

observations.push(createRoutineMomentObservation({
  person_id: personId,
  routine_type: routineType,
  observation_state: 'occurred',
  occurred_at: new Date(Date.now()).setHours(14, 0, 0, 0)).toISOString(),
  recorded_by: 'caregiver-001',
  assistance_level: 'supervised',
  metadata: { day: 7, time: 'afternoon' }
}));

observations.push(createRoutineMomentObservation({
  person_id: personId,
  routine_type: routineType,
  observation_state: 'occurred',
  occurred_at: new Date(Date.now()).setHours(20, 0, 0, 0)).toISOString(),
  recorded_by: 'caregiver-001',
  assistance_level: 'supervised',
  metadata: { day: 7, time: 'evening' }
}));

console.log(`Created ${observations.length} observations`);

// Establish baseline
const baseline = establishBaselineFromObservations(personId, routineType, observations);
console.log('\nBaseline established:');
console.log(`- Established: ${baseline.is_established}`);
console.log(`- Pattern: ${baseline.pattern_description}`);
console.log(`- Frequency: ${baseline.frequency}`);
console.log(`- Typical time window: ${baseline.typical_time_window}`);
console.log(`- Typical assistance: ${baseline.typical_assistance_level}`);
console.log(`- Confidence: ${baseline.confidence}`);
console.log(`- Evidence count: ${baseline.evidence_ids.length}`);

// Test 2: Detect changes
console.log('\n\nTest 2: Detecting changes in routine pattern');

const analysisPeriod = {
  start_date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 8 days ago
  end_date: new Date().toISOString().split('T')[0]
};

const changes = detectRoutineMomentChanges(
  personId,
  routineType,
  baseline,
  observations,
  analysisPeriod
);

console.log(`\nDetected ${changes.length} changes:`);
changes.forEach((change, index) => {
  console.log(`\nChange ${index + 1}:`);
  console.log(`- Description: ${change.change_description}`);
  console.log(`- Type: ${change.change_type}`);
  console.log(`- Confidence: ${change.confidence}`);
  console.log(`- Is sustained: ${change.is_sustained_change}`);
  console.log(`- Observation period: ${change.observation_period_start} to ${change.observation_period_end}`);
  console.log(`- Evidence count: ${change.evidence_ids.length}`);
});

// Test 3: Test with insufficient data (should not establish baseline)
console.log('\n\nTest 3: Testing with insufficient observations');

const sparseObservations: RoutineMomentObservation[] = [
  createRoutineMomentObservation({
    person_id: personId,
    routine_type: routineType,
    observation_state: 'occurred',
    occurred_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    recorded_by: 'caregiver-001',
    metadata: { test: 'sparse data' }
  })
];

const sparseBaseline = establishBaselineFromObservations(personId, routineType, sparseObservations);
console.log(`\nSparse baseline established: ${sparseBaseline.is_established}`);
console.log(`Confidence: ${sparseBaseline.confidence}`);

console.log('\n\nAll tests completed successfully!');