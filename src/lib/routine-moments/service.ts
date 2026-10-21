// src/lib/routine-moments/service.ts
import { RoutineMomentRecord, RoutineBaseline, RoutineMomentChange, ConfidenceLevel } from './types';

function calendarDaysBetween(first: Date, last: Date): number {
  const firstDay = Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), first.getUTCDate());
  const lastDay = Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate());
  return (lastDay - firstDay) / (1000 * 60 * 60 * 24);
}

function timeOfDayMilliseconds(observation: RoutineMomentRecord): number {
  const explicitTime = observation.observation_data?.time;
  if (typeof explicitTime === 'string') {
    const match = explicitTime.match(/^(\d{1,2}):(\d{2})$/);
    if (match) {
      const hours = Number(match[1]);
      const minutes = Number(match[2]);
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        return hours * 3600000 + minutes * 60000;
      }
    }
  }
  const date = new Date(observation.observed_at);
  return date.getUTCHours() * 3600000 + date.getUTCMinutes() * 60000 + date.getUTCSeconds() * 1000;
}

/**
 * Establish a baseline for a routine from a list of observations.
 * @param observations List of routine moment observations for a specific routine and person.
 * @returns RoutineBaseline representing the learned pattern.
 */
export function establishBaseline(observations: RoutineMomentRecord[]): RoutineBaseline {
  if (observations.length === 0) {
    throw new Error('Cannot establish baseline from empty observations');
  }

  const routineName = observations[0].routine_name;
  const personId = observations[0].person_id;

  // Sort observations by observed_at ascending for time-based calculations
  const sortedObs = [...observations].sort(
    (a, b) => new Date(a.observed_at).getTime() - new Date(b.observed_at).getTime()
  );

  // Calculate frequency per week
  const firstDate = new Date(sortedObs[0].observed_at);
  const lastDate = new Date(sortedObs[sortedObs.length - 1].observed_at);
  const daysDiff = calendarDaysBetween(firstDate, lastDate);
  const weeksDiff = Math.max(daysDiff / 7, 0.1); // Avoid division by zero
  const frequencyPerWeek = sortedObs.length / weeksDiff;

  // Calculate average time of day (in milliseconds since midnight)
  const timeOfDayMs = sortedObs.map(timeOfDayMilliseconds);
  const avgTimeOfDayMs = timeOfDayMs.reduce((sum, val) => sum + val, 0) / timeOfDayMs.length;
  const avgHours = Math.floor(avgTimeOfDayMs / 3600000);
  const avgMinutes = Math.floor((avgTimeOfDayMs % 3600000) / 60000);
  const avgTimeOfDay = `${avgHours.toString().padStart(2, '0')}:${avgMinutes.toString().padStart(2, '0')}`;

  // Extract assistance_level and participation_level from observation_data if available
  const assistanceLevels: string[] = [];
  const participationLevels: string[] = [];
  sortedObs.forEach(obs => {
    if (obs.observation_data) {
      if (obs.observation_data.assistance_level) {
        assistanceLevels.push(String(obs.observation_data.assistance_level));
      }
      if (obs.observation_data.participation_level) {
        participationLevels.push(String(obs.observation_data.participation_level));
      }
    }
  });

  // Calculate distribution of assistance levels
  const assistanceDist: Record<string, number> = {};
  assistanceLevels.forEach(level => {
    assistanceDist[level] = (assistanceDist[level] || 0) + 1;
  });
  // Convert to proportions
  Object.keys(assistanceDist).forEach(key => {
    assistanceDist[key] = assistanceDist[key] / assistanceLevels.length;
  });

  // Calculate distribution of participation levels
  const participationDist: Record<string, number> = {};
  participationLevels.forEach(level => {
    participationDist[level] = (participationDist[level] || 0) + 1;
  });
  Object.keys(participationDist).forEach(key => {
    participationDist[key] = participationDist[key] / participationLevels.length;
  });

   // Calculate consistency score (inverse of coefficient of variation of time between observations)
   let consistencyScore: number;
   if (sortedObs.length >= 2) {
     const intervals: number[] = [];
     for (let i = 1; i < sortedObs.length; i++) {
       const prev = new Date(sortedObs[i - 1].observed_at);
       const curr = new Date(sortedObs[i].observed_at);
       intervals.push(curr.getTime() - prev.getTime());
     }
     const meanInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
     const variance = intervals.reduce((sum, val) => sum + Math.pow(val - meanInterval, 2), 0) / intervals.length;
     const stdDev = Math.sqrt(variance);
     const cv = stdDev / meanInterval; // coefficient of variation
     consistencyScore = Math.max(0, 1 - cv); // Scale so that 1 is perfectly consistent, 0 is highly variable
     // Ensure it's between 0 and 1
     consistencyScore = Math.min(1, Math.max(0, consistencyScore));
   } else {
     // Not enough data to calculate consistency
     consistencyScore = 0.5; // default middle value
   }

  return {
    routine_name: routineName,
    person_id: personId,
    frequency_per_week: frequencyPerWeek,
    average_time_of_day: avgTimeOfDay,
    assistance_level_distribution: assistanceDist,
    participation_level_distribution: participationDist,
    consistency_score: consistencyScore,
    last_updated: new Date().toISOString(),
    sample_size: sortedObs.length,
  };
}

/**
 * Detect changes in routine observations compared to a baseline.
 * @param observations Recent observations to check for changes.
 * @param baseline The established baseline.
 * @returns Array of detected changes.
 */
export function detectChanges(
  observations: RoutineMomentRecord[],
  baseline: RoutineBaseline
): RoutineMomentChange[] {
  const changes: RoutineMomentChange[] = [];

  if (observations.length === 0) {
    return changes;
  }

  const routineName = observations[0].routine_name;
  if (routineName !== baseline.routine_name) {
    // This shouldn't happen if we are checking the same routine
    return changes;
  }

   // Check frequency change
   const firstDate = new Date(observations[0].observed_at);
   const lastDate = new Date(observations[observations.length - 1].observed_at);
   const daysDiff = calendarDaysBetween(firstDate, lastDate);
   const weeksDiff = Math.max(daysDiff / 7, 0.1);
   const currentFrequency = observations.length / weeksDiff;
   const frequencyChange = Math.abs(currentFrequency - baseline.frequency_per_week) / baseline.frequency_per_week;
   if (frequencyChange > 0.2) { // 20% change threshold
     changes.push({
       field: 'frequency_per_week',
       previous_value: baseline.frequency_per_week,
       current_value: currentFrequency,
       change_type: 'update',
       detected_at: new Date().toISOString(),
       confidence: Math.min(0.9, frequencyChange), // Higher change -> higher confidence
     });
   }

   // Check time of day change
   const timeOfDayMs = observations.map(timeOfDayMilliseconds);
   const avgTimeOfDayMs = timeOfDayMs.reduce((sum, val) => sum + val, 0) / timeOfDayMs.length;
   const avgHours = Math.floor(avgTimeOfDayMs / 3600000);
   const avgMinutes = Math.floor((avgTimeOfDayMs % 3600000) / 60000);
   const currentTimeOfDay = `${avgHours.toString().padStart(2, '0')}:${avgMinutes.toString().padStart(2, '0')}`;
   // Convert time strings to minutes since midnight for comparison
   const baselineTimeOfDay = baseline.average_time_of_day;
   if (baselineTimeOfDay) {
     const baselineMinutes = parseInt(baselineTimeOfDay.split(':')[0]) * 60 + parseInt(baselineTimeOfDay.split(':')[1]);
     const currentMinutes = avgHours * 60 + avgMinutes;
     const timeDiffMinutes = Math.abs(currentMinutes - baselineMinutes);
     const timeChangeThreshold = 30; // 30 minutes threshold
     if (timeDiffMinutes > timeChangeThreshold) {
       changes.push({
         field: 'average_time_of_day',
         previous_value: baselineTimeOfDay,
         current_value: currentTimeOfDay,
         change_type: 'update',
         detected_at: new Date().toISOString(),
         confidence: Math.min(0.9, timeDiffMinutes / 60), // Scale confidence by hours difference
       });
     }
   }

  // Check assistance level distribution change
  const assistanceLevels: string[] = [];
  observations.forEach(obs => {
    if (obs.observation_data && obs.observation_data.assistance_level) {
      assistanceLevels.push(String(obs.observation_data.assistance_level));
    }
  });
  const currentAssistanceDist: Record<string, number> = {};
  assistanceLevels.forEach(level => {
    currentAssistanceDist[level] = (currentAssistanceDist[level] || 0) + 1;
  });
  Object.keys(currentAssistanceDist).forEach(key => {
    currentAssistanceDist[key] = currentAssistanceDist[key] / assistanceLevels.length;
  });

   // Compare distributions
   const allAssistanceKeys = new Set([
     ...Object.keys(baseline.assistance_level_distribution),
     ...Object.keys(currentAssistanceDist),
   ]);
   allAssistanceKeys.forEach(key => {
     const baselineVal = baseline.assistance_level_distribution[key] || 0;
     const currentVal = currentAssistanceDist[key] || 0;
     const change = Math.abs(currentVal - baselineVal);
     if (change > 0.2) { // 20% change threshold
       changes.push({
          field: `assistance_level_distribution.${key}`,
          previous_value: baselineVal,
          current_value: currentVal,
          change_type: 'update',
          detected_at: new Date().toISOString(),
          confidence: Math.min(0.9, change),
        });
     }
    });



  // Check participation level distribution change
  const participationLevels: string[] = [];
  observations.forEach(obs => {
    if (obs.observation_data && obs.observation_data.participation_level) {
      participationLevels.push(String(obs.observation_data.participation_level));
    }
  });
  const currentParticipationDist: Record<string, number> = {};
  participationLevels.forEach(level => {
    currentParticipationDist[level] = (currentParticipationDist[level] || 0) + 1;
  });
  Object.keys(currentParticipationDist).forEach(key => {
    currentParticipationDist[key] = currentParticipationDist[key] / participationLevels.length;
  });

   const allParticipationKeys = new Set([
     ...Object.keys(baseline.participation_level_distribution),
     ...Object.keys(currentParticipationDist),
   ]);
  allParticipationKeys.forEach(key => {
    const baselineVal = baseline.participation_level_distribution[key] || 0;
    const currentVal = currentParticipationDist[key] || 0;
    const change = Math.abs(currentVal - baselineVal);
    if (change > 0.2) {
      changes.push({
         field: `participation_level_distribution.${key}`,
         previous_value: baselineVal,
         current_value: currentVal,
         change_type: 'update',
         detected_at: new Date().toISOString(),
         confidence: Math.min(0.9, change),
       });
    }
  });

  // Check consistency score change
  if (observations.length >= 2) {
    const intervals: number[] = [];
    for (let i = 1; i < observations.length; i++) {
      const prev = new Date(observations[i - 1].observed_at);
      const curr = new Date(observations[i].observed_at);
      intervals.push(curr.getTime() - prev.getTime());
    }
    const meanInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const variance = intervals.reduce((sum, val) => sum + Math.pow(val - meanInterval, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / meanInterval;
    const currentConsistencyScore = Math.max(0, 1 - cv);
    const consistencyChange = Math.abs(currentConsistencyScore - baseline.consistency_score);
    if (consistencyChange > 0.2) {
       changes.push({
         field: 'consistency_score',
         previous_value: baseline.consistency_score,
         current_value: currentConsistencyScore,
         change_type: 'update',
         detected_at: new Date().toISOString(),
         confidence: Math.min(0.9, consistencyChange),
       });
    }
  }

  return changes;
}

