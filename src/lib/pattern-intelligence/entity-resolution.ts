/**
 * Entity Resolution for Pattern Recognition in SolenOS
 * Implements sophisticated entity resolution to determine whether 
 * repeated observations refer to the same underlying phenomenon,
 * as specified in point 8 of the pattern recognition specification.
 */

import type { JourneyGraphEvent } from "../care-journey-graph/types";
import type { SupportingEvidence } from "./pattern-models";
import type { EvidenceRelation } from "../event-identity/contract-constants";
import { temporalSortKey } from "../time-model";
import { parseEventTimeFromText } from "../time-model";

/**
 * Entity Resolution Result
 */
export type EntityResolutionResult = {
  /** Whether the observations refer to the same underlying phenomenon */
  same_phenomenon: boolean;
  /** Confidence in the resolution (0-1) */
  confidence: number;
  /** Reasoning for the resolution */
  reasoning: string[];
  /** Suggested evidence relation if same phenomenon */
  suggested_relation?: EvidenceRelation;
  /** Alternative interpretations if phenomena might be different */
  alternative interpretations: {
    description: string;
    confidence: number;
  }[];
};

/**
 * Normalized observation characteristics for comparison
 */
export type NormalizedObservation = {
  /** Core phenomenon characteristics */
  phenomenon_type: string; // e.g., "weight_measurement", "medication_taken"
  phenomenon_value?: number | string; // The measured/observed value
  phenomenon_unit?: string; // Unit of measurement
  /** Contextual factors */
  context_factors: string[]; // Relevant contextual elements
  /** Temporal markers */
  temporal_markers: string[]; // Time-related indicators
  /** Subject information */
  subject_id: string; // Person the observation is about
  observer_id: string; // Who made the observation
};

/**
 * Extract normalized characteristics from an observation
 */
export function normalizeObservation(
  event: JourneyGraphEvent
): NormalizedObservation {
  const description = event.description.toLowerCase();
  
  // Extract phenomenon type and value
  let phenomenon_type = "unknown";
  let phenomenon_value: number | string | undefined;
  let phenomenon_unit: string | undefined;
  
  // Weight measurements
  if (description.match(/\b(weight|weigh|kg|lbs|pounds)\b/)) {
    phenomenon_type = "weight_measurement";
    const weightMatch = description.match(/(\d+(?:\.\d+)?)\s*(kg|kgs|lbs|pounds?)/i);
    if (weightMatch) {
      phenomenon_value = parseFloat(weightMatch[1]);
      phenomenon_unit = weightMatch[2].toLowerCase();
    }
  }
  
  // Medication intake
  if (description.match(/\b(took|took|taking|medication|pill|dose)\b/)) {
    phenomenon_type = "medication_intake";
    const medMatch = description.match(/(\d+(?:\.\d+)?)\s*(mg|milligrams?|g|grams?)/i);
    if (medMatch) {
      phenomenon_value = parseFloat(medMatch[1]);
      phenomenon_unit = medMatch[2].toLowerCase();
    }
  }
  
  // Blood pressure
  if (description.match(/\b(blood pressure|bp|systolic|diastolic)\b/)) {
    phenomenon_type = "blood_pressure";
    const bpMatch = description.match(/(\d+)\s*\/\s*(\d+)/);
    if (bpMatch) {
      phenomenon_value = {
        systolic: parseInt(bpMatch[1]),
        diastolic: parseInt(bpMatch[2])
      };
      phenomenon_unit = "mmHg";
    }
  }
  
  // Temperature
  if (description.match(/\b(temperature|temp|fever|celsius|fahrenheit|°c|°f)\b/)) {
    phenomenon_type = "temperature";
    const tempMatch = description.match(/(\d+(?:\.\d+)?)\s*(°c|°f|celsius|fahrenheit)/i);
    if (tempMatch) {
      phenomenon_value = parseFloat(tempMatch[1]);
      phenomenon_unit = tempMatch[2].toLowerCase().replace("°", "");
    }
  }
  
  // Pain levels
  if (description.match(/\b(pain|hurt|ache|sore)\b/)) {
    phenomenon_type = "pain_report";
    const painMatch = description.match(/\b(pain|hurt|ache|sore)\s*[:\-]?\s*(\d+)/i);
    if (painMatch) {
      phenomenon_value = parseInt(painMatch[2]);
      phenomenon_unit = "scale_0_10";
    } else {
      phenomenon_value = "present";
      phenomenon_unit = "present_absent";
    }
  }
  
  // Sleep hours
  if (description.match(/\b(sleep|slept|hours?\s*of\s*sleep)\b/)) {
    phenomenon_type = "sleep_duration";
    const sleepMatch = description.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?)/i);
    if (sleepMatch) {
      phenomenon_value = parseFloat(sleepMatch[1]);
      phenomenon_unit = "hours";
    }
  }
  
  // Appointment attendance
  if (description.match(/\b(appointment|visit|saw\s+doctor|doctor\s+visit)\b/)) {
    phenomenon_type = "appointment_attendance";
    phenomenon_value = "attended";
    phenomenon_unit = "present_absent";
    
    if (description.match(/\b(missed|skipped|forgot|didn't\s+go)\b/i)) {
      phenomenon_value = "missed";
    }
  }
  
  // Extract contextual factors
  const contextFactors: string[] = [];
  
  // Time of day
  if (description.match(/\b(morning|afternoon|evening|night|am|pm)\b/i)) {
    const timeMatch = description.match(/\b(morning|afternoon|evening|night|am|pm)\b/i);
    if (timeMatch) {
      contextFactors.push(`time_of_day:${timeMatch[0].toLowerCase()}`);
    }
  }
  
  // Day of week
  if (description.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i)) {
    const dayMatch = description.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
    if (dayMatch) {
      contextFactors.push(`day_of_week:${dayMatch[0].toLowerCase()}`);
    }
  }
  
  // Location
  if (description.match(/\b(home|hospital|clinic|work|school|bed|chair)\b/i)) {
    const locMatch = description.match(/\b(home|hospital|clinic|work|school|bed|chair)\b/i);
    if (locMatch) {
      contextFactors.push(`location:${locMatch[0].toLowerCase()}`);
    }
  }
  
  // With/without assistance
  if (description.match(/\b(with\s+help|assisted|help\s+from|someone\s+helped)\b/i)) {
    contextFactors.push("assistance_received");
  }
  if (description.match(/\b(without\s+help|independent|by\s+self|on\s+own)\b/i)) {
    contextFactors.push("independent_performance");
  }
  
  // Extract temporal markers
  const temporalMarkers: string[] = [];
  
  // Specific times
  if (description.match(/\b\d{1,2}:\d{2}\s*(am|pm)?\b/i)) {
    const timeMatches = description.match(/\b\d{1,2}:\d{2}\s*(am|pm)?\b/gi);
    if (timeMatches) {
      temporalMarkers.push(...timeMatches.map(t => t.trim()));
    }
  }
  
  // Relative time
  if (description.match(/\b(yesterday|today|tomorrow|last\s+night|this\s+morning)\b/i)) {
    const relTimeMatches = description.match(/\b(yesterday|today|tomorrow|last\s+night|this\s+morning)\b/gi);
    if (relTimeMatches) {
      temporalMarkers.push(...relTimeMatches.map(t => t.trim().toLowerCase()));
    }
  }
  
  // Duration markers
  if (description.match(/\b(\d+)\s*(hours?|minutes?|days?|weeks?)\s*(ago|before|later|after)\b/i)) {
    const durMatches = description.match(/\b(\d+)\s*(hours?|minutes?|days?|weeks?)\s*(ago|before|later|after)\b/gi);
    if (durMatches) {
      temporalMarkers.push(...durMatches.map(t => t.trim()));
    }
  }
  
  return {
    phenomenon_type,
    phenomenon_value,
    phenomenon_unit,
    context_factors: contextFactors,
    temporal_markers: temporalMarkers,
    subject_id: event.caregiver_id || "unknown", // Simplified - in reality would link to care recipient
    observer_id: event.caregiver_id || "unknown",
  };
}

/**
 * Calculate similarity between two normalized observations
 */
export function calculateObservationSimilarity(
  obs1: NormalizedObservation,
  obs2: NormalizedObservation
): {
  overall_similarity: number;
  phenomenon_similarity: number;
  context_similarity: number;
  temporal_similarity: number;
} {
  // Phenomenon similarity (0-1)
  let phenomenon_similarity = 0;
  if (obs1.phenomenon_type === obs2.phenomenon_type) {
    phenomenon_similarity = 0.7; // Base score for same type
    
    // If we have values, compare them
    if (obs1.phenomenon_value !== undefined && obs2.phenomenon_value !== undefined) {
      if (typeof obs1.phenomenon_value === "number" && 
          typeof obs2.phenomenon_value === "number") {
        // Numerical comparison
        const maxVal = Math.max(Math.abs(obs1.phenomenon_value), Math.abs(obs2.phenomenon_value));
        const minVal = Math.min(Math.abs(obs1.phenomenon_value), Math.abs(obs2.phenomenon_value));
        const value_similarity = maxVal > 0 ? minVal / maxVal : 1;
        phenomenon_similarity = 0.3 + (0.7 * value_similarity); // Boost for similar values
      } else if (obs1.phenomenon_value === obs2.phenomenon_value) {
        phenomenon_similarity = 1; // Exact match for strings/complex values
      }
    }
    
    // Unit similarity
    if (obs1.phenomenon_unit && obs2.phenomenon_unit) {
      if (obs1.phenomenon_unit === obs2.phenomenon_unit) {
        phenomenon_similarity = Math.min(1, phenomenon_similarity + 0.1);
      }
    }
  }
  
  // Context similarity (0-1)
  let context_similarity = 0;
  if (obs1.context_factors.length > 0 && obs2.context_factors.length > 0) {
    const contextSet1 = new Set(obs1.context_factors);
    const contextSet2 = new Set(obs2.context_factors);
    const intersection = new Set(
      [...contextSet1].filter(x => contextSet2.has(x))
    );
    const union = new Set([...contextSet1, ...contextSet2]);
    context_similarity = union.size > 0 ? intersection.size / union.size : 0;
  } else if (obs1.context_factors.length === 0 && obs2.context_factors.length === 0) {
    context_similarity = 1; // Both have no context
  }
  
  // Temporal similarity (0-1)
  let temporal_similarity = 0;
  if (obs1.temporal_markers.length > 0 && obs2.temporal_markers.length > 0) {
    const tempSet1 = new Set(obs1.temporal_markers);
    const tempSet2 = new Set(obs2.temporal_markers);
    const intersection = new Set(
      [...tempSet1].filter(x => tempSet2.has(x))
    );
    const union = new Set([...tempSet1, ...tempSet2]);
    temporal_similarity = union.size > 0 ? intersection.size / union.size : 0;
  } else if (obs1.temporal_markers.length === 0 && obs2.temporal_markers.length === 0) {
    temporal_similarity = 1; // Both have no temporal markers
  }
  
  // Overall similarity (weighted average)
  const overall_similarity = 
    (phenomenon_similarity * 0.5) + 
    (context_similarity * 0.3) + 
    (temporal_similarity * 0.2);
  
  return {
    overall_similarity,
    phenomenon_similarity,
    context_similarity,
    temporal_similarity,
  };
}

/**
 * Determine if two observations refer to the same underlying phenomenon
 */
export function areSamePhenomenon(
  event1: JourneyGraphEvent,
  event2: JourneyGraphEvent,
  options: {
    temporal_window_hours?: number; // How close in time to consider related
    similarity_threshold?: number; // Minimum similarity to consider same phenomenon
  } = {}
): EntityResolutionResult {
  const temporalWindow = options.temporal_window_hours ?? 24; // Default 24 hours
  const similarityThreshold = options.similarity_threshold ?? 0.6; // Default 60% similarity
  
  // Normalize both observations
  const obs1 = normalizeObservation(event1);
  const obs2 = normalizeObservation(event2);
  
  // Calculate similarity
  const similarity = calculateObservationSimilarity(obs1, obs2);
  
  // Check temporal proximity
  const time1 = new Date(event1.timestamp).getTime();
  const time2 = new Date(event2.timestamp).getTime();
  const hoursApart = Math.abs(time2 - time1) / (1000 * 60 * 60);
  const temporallyClose = hoursApart <= temporalWindow;
  
  // Determine if same phenomenon
  const phenomenonSimilar = similarity.phenomenon_similarity >= 0.5;
  const contextSimilar = similarity.context_similarity >= 0.3;
  const temporalClose = temporallyClose;
  
  // Weighted decision
  let samePhenomenon = false;
  let confidence = 0;
  const reasoning: string[] = [];
  
  // Strong evidence: same phenomenon type with similar values
  if (obs1.phenomenon_type === obs2.phenomenon_type && 
      obs1.phenomenon_value !== undefined && 
      obs2.phenomenon_value !== undefined &&
      typeof obs1.phenomenon_value === "number" &&
      typeof obs2.phenomenon_value === "number") {
    
    const valDiff = Math.abs(obs1.phenomenon_value - obs2.phenomenon_value);
    const avgVal = Math.abs(obs1.phenomenon_value + obs2.phenomenon_value) / 2;
    const relativeDiff = avgVal > 0 ? valDiff / avgVal : 0;
    
    if (relativeDiff < 0.1) { // Within 10%
      samePhenomenon = true;
      confidence = 0.9;
      reasoning.push(`Same phenomenon type (${obs1.phenomenon_type}) with similar values`);
    } else if (relativeDiff < 0.25) { // Within 25%
      samePhenomenon = true;
      confidence = 0.7;
      reasoning.push(`Same phenomenon type (${obs1.phenomenon_type}) with moderately similar values`);
    }
  }
  // Good evidence: same phenomenon type
  else if (obs1.phenomenon_type === obs2.phenomenon_type && obs1.phenomenon_type !== "unknown") {
    samePhenomenon = true;
    confidence = 0.6;
    reasoning.push(`Same phenomenon type (${obs1.phenomenon_type})`);
  }
  // Moderate evidence: good contextual and temporal similarity
  else if (similarity.overall_similarity >= similarityThreshold && temporallyClose) {
    samePhenomenon = true;
    confidence = similarity.overall_similarity * 0.8; // Reduce confidence for indirect evidence
    reasoning.push(`Strong overall similarity (${similarity.overall_similarity.toFixed(2)}) and temporal proximity`);
  }
  // Weak evidence: temporal proximity only
  else if (temporallyClose) {
    samePhenomenon = false; // Not enough evidence to claim same phenomenon
    confidence = 0.3;
    reasoning.push(`Temporally close but insufficient similarity to confirm same phenomenon`);
    reasoning.push(`Consider: ${similarity.overall_similarity.toFixed(2)} overall similarity`);
  }
  // Default: different phenomena
  else {
    samePhenomenon = false;
    confidence = 0.2;
    reasoning.push(`Insufficient evidence to conclude same phenomenon`);
    reasoning.push(`Similarity: ${similarity.overall_similarity.toFixed(2)}`);
    if (!temporallyClose) {
      reasoning.push(`Events are ${hoursApart.toFixed(1)} hours apart (exceeds ${temporalWindow}h window)`);
    }
  }
  
  // Generate alternative interpretations
  const alternatives: { description: string; confidence: number }[] = [];
  
  if (!samePhenomenon || confidence < 0.8) {
    alternatives.push({
      description: "Observations refer to different underlying phenomena",
      confidence: 0.7
    });
  }
  
  if (similarity.overall_similarity > 0.3 && similarity.overall_similarity < 0.7) {
    alternatives.push({
      description: "Observations share some characteristics but may represent different instances of similar phenomena",
      confidence: 0.6
    });
  }
  
  if (temporallyClose && similarity.overall_similarity < 0.4) {
    alternatives.push({
      description: "Temporal proximity may be coincidental rather than indicative of same phenomenon",
      confidence: 0.5
    });
  }
  
  // Suggest evidence relation if same phenomenon
  let suggestedRelation: EvidenceRelation | undefined;
  if (samePhenomenon && confidence >= 0.6) {
    if (hoursApart < 1) {
      suggestedRelation = "identical_content"; // Very close in time
    } else if (hoursApart < 24) {
      suggestedRelation = "explicit_recurrence"; // Within day
    } else {
      suggestedRelation = "implicit_recurrence"; // Longer gap
    }
  }
  
  return {
    same_phenomenon,
    confidence: Math.min(confidence, 1),
    reasoning,
    suggested_relation,
    alternative interpretations: alternatives,
  };
}

/**
 * Group observations by underlying phenomenon using entity resolution
 */
export function groupObservationsByPhenomenon(
  events: JourneyGraphEvent[],
  options: {
    temporal_window_hours?: number;
    similarity_threshold?: number;
    min_group_size?: number;
  } = {}
): {
  groups: NormalizedObservation[][];
  resolution_results: EntityResolutionResult[];
} {
  const temporalWindow = options.temporal_window_hours ?? 24;
  const similarityThreshold = options.similarity_threshold ?? 0.6;
  const minGroupSize = options.min_group_size ?? 2;
  
  // Normalize all observations
  const normalizedObs = events.map(normalizeObservation);
  
  // Group observations that refer to the same phenomenon
  const groups: NormalizedObservation[][] = [];
  const resolutionResults: EntityResolutionResult[] = [];
  const used = new Set<number>(); // Track which observations have been grouped
  
  for (let i = 0; i < normalizedObs.length; i++) {
    if (used.has(i)) continue;
    
    // Start a new group with observation i
    const currentGroup: NormalizedObservation[] = [normalizedObs[i]];
    used.add(i);
    
    // Check against all other observations
    for (let j = i + 1; j < normalizedObs.length; j++) {
      if (used.has(j)) continue;
      
      // Check if observation j belongs in the same group as observation i
      const result = areSamePhenomenon(
        events[i], 
        events[j],
        { temporal_window_hours: temporalWindow, similarity_threshold: similarityThreshold }
      );
      
      resolutionResults.push(result);
      
      if (result.same_phenomenon && result.confidence >= similarityThreshold) {
        currentGroup.push(normalizedObs[j]);
        used.add(j);
      }
    }
    
    // Only keep groups that meet minimum size requirement
    if (currentGroup.length >= minGroupSize) {
      groups.push(currentGroup);
    }
  }
  
  return { groups, resolution_results };
}

/**
 * Calculate entity resolution confidence for a group of observations
 */
export function calculateGroupEntityConfidence(
  events: JourneyGraphEvent[],
  groupIndex: number,
  options: {
    temporal_window_hours?: number;
    similarity_threshold?: number;
  } = {}
): number {
  const { groups, resolution_results } = groupObservationsByPhenomenon(events, options);
  
  if (groupIndex >= groups.length || groupIndex < 0) {
    return 0;
  }
  
  const group = groups[groupIndex];
  if (group.length < 2) {
    return 0;
  }
  
  // Calculate average pairwise confidence within the group
  let totalConfidence = 0;
  let pairCount = 0;
  
  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      // Find the corresponding resolution result
      // This is simplified - in reality we'd need to map back to original event indices
      const result = areSamePhenomenon(
        events[0], // Simplified - would need proper indexing
        events[0], // Simplified - would need proper indexing
        { temporal_window_hours: options.temporal_window_hours, similarity_threshold: options.similarity_threshold }
      );
      totalConfidence += result.confidence;
      pairCount++;
    }
  }
  
  return pairCount > 0 ? totalConfidence / pairCount : 0;
}