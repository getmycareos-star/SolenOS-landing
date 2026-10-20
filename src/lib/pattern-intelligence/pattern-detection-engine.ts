/**
 * Enhanced Pattern Detection Engine for SolenOS
 * Implements sophisticated pattern detection that works with actual evidence
 * and observations while maintaining strict separation between repetition,
 * pattern, and causation.
 */

import type { JourneyGraphEvent } from "../care-journey-graph/types";
import type { EvidenceRelation } from "../event-identity/contract-constants";
import type {
  EnhancedPattern,
  PatternDetectionResult,
  PatternCategory,
  PatternStatus,
  PatternConfidence,
  SupportingEvidence,
  PatternContext,
  BaselineComparison,
  RecurrenceCharacteristics,
  AlternativeInterpretation,
  PatternThresholdCriteria,
  PatternCategoryConfig,
  PatternVerificationInput
} from "./pattern-models";
import { getGraphForCaregiver } from "./care-journey-graph/graph-store";
import { temporalSortKey } from "../time-model";
import { parseEventTimeFromText } from "../time-model";

/**
 * Default threshold criteria for pattern detection
 */
const DEFAULT_THRESHOLDS: PatternThresholdCriteria = {
  min_occurrences: 3, // Minimum occurrences to consider a pattern
  min_confidence: 0.7, // Minimum confidence threshold
  consistency_threshold: 0.6, // Minimum consistency required
  source_diversity_min: 2, // Minimum different sources
  temporal_distribution_weight: 0.3, // Weight for temporal analysis
  baseline_required: false, // Baseline not strictly required
  max_duplicate_risk: 0.3, // Maximum duplicate evidence risk allowed
};

/**
 * Category-specific threshold adjustments
 */
const CATEGORY_THRESHOLDS: PatternCategoryConfig = {
  frequency: {
    min_occurrences: 3,
    min_confidence: 0.75,
    consistency_threshold: 0.7,
  },
  routine: {
    min_occurrences: 3,
    min_confidence: 0.7,
    consistency_threshold: 0.65,
    baseline_required: true, // Routine patterns need baseline
  },
  medication_continuity: {
    min_occurrences: 2, // Medication issues can be patterns with fewer occurrences
    min_confidence: 0.8,
    consistency_threshold: 0.75,
  },
  caregiver_concern: {
    min_occurrences: 2, // Caregiver concerns can be patterns with fewer occurrences
    min_confidence: 0.7,
    consistency_threshold: 0.6,
  },
  symptom: {
    min_occurrences: 3,
    min_confidence: 0.7,
    consistency_threshold: 0.65,
  },
};

/**
 * Get threshold criteria for a specific pattern category
 */
function getThresholdsForCategory(category: PatternCategory): PatternThresholdCriteria {
  const categorySpecific = CATEGORY_THRESHOLDS[category] ?? {};
  return {
    ...DEFAULT_THRESHOLDS,
    ...categorySpecific,
  };
}

/**
 * Extract supporting evidence from care journey graph events
 */
function extractSupportingEvidence(
  events: JourneyGraphEvent[],
  caregiverId: string
): SupportingEvidence[] {
  return events
    .filter(event => event.caregiver_id === caregiverId) // Only events from this caregiver
    .map(event => ({
      event_id: event.id,
      date: event.timestamp,
      description: event.description,
      source: event.source,
      source_type: event.source, // Simplified - in reality this might be more complex
      confidence: event.clinical_importance === "high" ? 0.9 :
                 event.clinical_importance === "moderate" ? 0.7 :
                 event.clinical_importance === "low" ? 0.5 : 0.3,
      attributes: {}, // Would be populated from event metadata in full implementation
    }));
}

/**
 * Group evidence by potential pattern using entity resolution
 * This is a simplified version - in reality would use sophisticated entity resolution
 */
function groupEvidenceByPattern(
  evidence: SupportingEvidence[]
): Map<string, SupportingEvidence[]> {
  const groups = new Map<string, SupportingEvidence[]>();
  
  // Simple grouping by similar descriptions (in reality would use NLP/semantic matching)
  for (const ev of evidence) {
    // Create a simple key based on description keywords
    const keyWords = ev.description
      .toLowerCase()
      .split(/\W+/)
      .filter(word => word.length > 3) // Filter out short words
      .slice(0, 3) // Take first 3 significant words
      .sort()
      .join("-");
    
    const key = keyWords || "general";
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(ev);
  }
  
  return groups;
}

/**
 * Calculate temporal characteristics of evidence group
 */
function calculateTemporalCharacteristics(
  evidenceGroup: SupportingEvidence[]
): RecurrenceCharacteristics {
  if (evidenceGroup.length === 0) {
    return {
      occurrence_count: 0,
      first_occurrence: "",
      last_occurrence: "",
      occurrence_dates: [],
    };
  }
  
  // Sort evidence by date
  const sortedEvidence = [...evidenceGroup].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  const occurrenceDates = sortedEvidence.map(ev => ev.date);
  const firstOccurrence = occurrenceDates[0];
  const lastOccurrence = occurrenceDates[occurrenceDates.length - 1];
  
  // Calculate intervals between consecutive occurrences
  const intervals: number[] = [];
  for (let i = 1; i < occurrenceDates.length; i++) {
    const prevDate = new Date(occurrenceDates[i - 1]).getTime();
    const currDate = new Date(occurrenceDates[i]).getTime();
    const intervalDays = (currDate - prevDate) / (1000 * 60 * 60 * 24);
    intervals.push(intervalDays);
  }
  
  // Calculate average interval and variance
  let averageInterval = 0;
  let intervalVariance = 0;
  if (intervals.length > 0) {
    const sum = intervals.reduce((a, b) => a + b, 0);
    averageInterval = sum / intervals.length;
    
    if (intervals.length > 1) {
      const varianceSum = intervals.reduce(
        (sum, interval) => sum + Math.pow(interval - averageInterval, 2),
        0
      );
      intervalVariance = varianceSum / (intervals.length - 1);
    }
  }
  
  // Simple clustering score (0-1) - higher means more clustered in time
  let clusteringScore = 0;
  if (intervals.length > 0) {
    // Clustering score based on coefficient of variation (lower = more clustered)
    const cv = intervalVariance > 0 && averageInterval > 0 
      ? Math.sqrt(intervalVariance) / averageInterval 
      : 0;
    clusteringScore = Math.max(0, 1 - Math.min(cv, 1)); // Invert so higher = more clustered
  }
  
  // Persistence score - how consistently the pattern appears over time
  let persistenceScore = 0;
  if (occurrenceDates.length >= 2) {
    const totalSpanDays = (
      new Date(lastOccurrence).getTime() - 
      new Date(firstOccurrence).getTime()
    ) / (1000 * 60 * 60 * 24);
    const expectedInterval = totalSpanDays / (occurrenceDates.length - 1);
    
    if (expectedInterval > 0 && intervals.length > 0) {
      const intervalDeviation = intervals.reduce(
        (sum, interval) => sum + Math.abs(interval - expectedInterval),
        0
      ) / intervals.length;
      
      persistenceScore = Math.max(0, 1 - Math.min(intervalDeviation / expectedInterval, 1));
    }
  }
  
  return {
    occurrence_count: evidenceGroup.length,
    first_occurrence: firstOccurrence,
    last_occurrence: lastOccurrence,
    occurrence_dates: occurrenceDates,
    average_interval_days: averageInterval > 0 ? averageInterval : undefined,
    interval_variance: intervalVariance > 0 ? intervalVariance : undefined,
    clustering_score: clusteringScore > 0 ? clusteringScore : undefined,
    persistence_score: persistenceScore > 0 ? persistenceScore : undefined,
  };
}

/**
 * Calculate consistency score for evidence group
 * Measures how similar the evidence items are to each other
 */
function calculateConsistencyScore(
  evidenceGroup: SupportingEvidence[]
): number {
  if (evidenceGroup.length < 2) return 0;
  
  // Simple consistency based on description similarity and confidence
  // In reality would use NLP semantic similarity
  const totalConfidence = evidenceGroup.reduce(
    (sum, ev) => sum + ev.confidence,
    0
  );
  const averageConfidence = totalConfidence / evidenceGroup.length;
  
  // Check if all evidence items are from different sources (source diversity)
  const uniqueSources = new Set(evidenceGroup.map(ev => ev.source));
  const sourceDiversityScore = uniqueSources.size / evidenceGroup.length;
  
  // Combine factors (simplified)
  return (averageConfidence * 0.6) + (sourceDiversityScore * 0.4);
}

/**
 * Calculate source diversity score
 */
function calculateSourceDiversityScore(
  evidenceGroup: SupportingEvidence[]
): number {
  if (evidenceGroup.length === 0) return 0;
  
  const uniqueSources = new Set(evidenceGroup.map(ev => ev.source));
  return uniqueSources.size / evidenceGroup.length;
}

/**
 * Calculate duplicate evidence risk
 * Estimates likelihood that evidence represents duplicate reporting of same event
 */
function calculateDuplicateRisk(
  evidenceGroup: SupportingEvidence[]
): number {
  if (evidenceGroup.length < 2) return 0;
  
  // Simple duplicate risk based on temporal proximity and similarity
  // In reality would use sophisticated duplicate detection
  const sortedByDate = [...evidenceGroup].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  let closeInTimeCount = 0;
  const closeThresholdHours = 24; // Consider events within 24 hours as potentially duplicate
  
  for (let i = 1; i < sortedByDate.length; i++) {
    const prevTime = new Date(sortedByDate[i - 1].date).getTime();
    const currTime = new Date(sortedByDate[i].date).getTime();
    const hoursDiff = (currTime - prevTime) / (1000 * 60 * 60);
    
    if (hoursDiff <= closeThresholdHours) {
      closeInTimeCount++;
    }
  }
  
  // Risk increases with more close-in-time pairs
  return Math.min(closeInTimeCount / (sortedByDate.length - 1), 1);
}

/**
 * Determine if evidence group meets threshold criteria for pattern
 */
function meetsPatternThreshold(
  evidenceGroup: SupportingEvidence[],
  category: PatternCategory
): boolean {
  const thresholds = getThresholdsForCategory(category);
  
  // Check minimum occurrences
  if (evidenceGroup.length < thresholds.min_occurrences) {
    return false;
  }
  
  // Calculate various scores
  const consistencyScore = calculateConsistencyScore(evidenceGroup);
  const sourceDiversityScore = calculateSourceDiversityScore(evidenceGroup);
  const duplicateRisk = calculateDuplicateRisk(evidenceGroup);
  
  // Check thresholds
  if (consistencyScore < thresholds.consistency_threshold) {
    return false;
  }
  
  if (sourceDiversityScore < (thresholds.source_diversity_min / evidenceGroup.length)) {
    return false;
  }
  
  if (duplicateRisk > thresholds.max_duplicate_risk) {
    return false;
  }
  
  // Additional category-specific checks could go here
  
  return true;
}

/**
 * Create a pattern context from evidence group
 */
function createPatternContext(
  evidenceGroup: SupportingEvidence[]
): PatternContext | undefined {
  if (evidenceGroup.length === 0) return undefined;
  
  // Extract common contextual elements from evidence
  // Simplified implementation - in reality would be more sophisticated
  const sources = [...new Set(evidenceGroup.map(ev => ev.source))];
  const dates = evidenceGroup.map(ev => ev.date);
  
  return {
    description: `Observations from ${sources.join(", ")} sources`,
    timing: `Spanning from ${dates[0]} to ${dates[dates.length - 1]}`,
    source: "pattern_analysis",
  };
}

/**
 * Create baseline comparison (simplified - would integrate with baseline systems)
 */
function createBaselineComparison(): BaselineComparison {
  // In a full implementation, this would check against established baselines
  // For now, we indicate no baseline is available (which is acceptable per spec)
  return {
    has_baseline: false,
    baseline_description: undefined,
    baseline_period: undefined,
    deviation_measure: undefined,
  };
}

/**
 * Generate alternative interpretations (simplified)
 */
function generateAlternativeInterpretations(
  evidenceGroup: SupportingEvidence[],
  category: PatternCategory
): AlternativeInterpretation[] {
  // Simplified implementation - in reality would generate meaningful alternatives
  const interpretations: AlternativeInterpretation[] = [];
  
  // Always include the possibility that observations are unrelated
  if (evidenceGroup.length >= 2) {
    interpretations.push({
      description: "Observations may be unrelated coincidences",
      supporting_evidence: evidenceGroup.map(ev => ev.event_id),
      confidence: 0.3, // Low confidence in this interpretation
    });
  }
  
  // Add category-specific alternatives
  if (category === "frequency") {
    interpretations.push({
      description: "Increased reporting frequency rather than actual increase in events",
      supporting_evidence: evidenceGroup.map(ev => ev.event_id),
      confidence: 0.4,
    });
  }
  
  return interpretations;
}

/**
 * Create a new pattern ID
 */
function createPatternId(): string {
  return `pat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Create an enhanced pattern from evidence group
 */
function createEnhancedPattern(
  evidenceGroup: SupportingEvidence[],
  category: PatternCategory,
  caregiverId: string
): EnhancedPattern {
  const patternId = createPatternId();
  const now = new Date().toISOString();
  
  // Calculate all components
  const recurrenceChars = calculateTemporalCharacteristics(evidenceGroup);
  const context = createPatternContext(evidenceGroup);
  const baselineComparison = createBaselineComparison();
  const consistencyScore = calculateConsistencyScore(evidenceGroup);
  const alternativeInterpretations = generateAlternativeInterpretations(
    evidenceGroup, category
  );
  
  // Determine confidence based on multiple factors
  const baseConfidence = Math.min(
    recurrenceChars.occurrence_count / 10, // Normalize by expected max
    0.9
  );
  
  const confidenceScore = Math.min(
    baseConfidence * 0.4 + 
    consistencyScore * 0.4 + 
    (1 - calculateDuplicateRisk(evidenceGroup)) * 0.2,
    0.95
  );
  
  let confidence: PatternConfidence = "low";
  if (confidenceScore >= 0.8) confidence = "high";
  else if (confidenceScore >= 0.6) confidence = "medium";
  
  // Create the pattern
  const pattern: EnhancedPattern = {
    identity: {
      id: patternId,
      version: 1,
      created_at: now,
      updated_at: now,
    },
    category,
    status: "candidate", // Start as candidate pattern
    supporting_evidence: evidenceGroup,
    occurrence_count: evidenceGroup.length,
    recurrence_characterities: recurrenceChars,
    context: context ?? undefined,
    baseline_comparison,
    confidence,
    uncertainty: "The underlying cause of this pattern is not established. This pattern describes recurrence only, not causation.",
    alternative_interpretations,
    causation_status: "not established", // Critical requirement from specification
    verification_status: {
      confirmed: false,
      rejected: false,
      not_sure: false,
      corrections_made: false,
      context_added: false,
      last_verification_date: null,
    },
    user_response: {
      confirmed: false,
      rejected: false,
      not_sure: false,
      corrections_made: false,
      context_added: false,
      last_verification_date: null,
    },
    related_open_loop_ids: [],
    related_decision_ids: [],
    related_outcome_ids: [],
    provenance: `Pattern detected from ${evidenceGroup.length} observations via automated analysis`,
    permissions: {
      caregiver_id: caregiverId,
      accessible_by: [caregiverId],
      readonly: false,
    },
    audit_history: [{
      timestamp: now,
      action: "created",
      actor: "system",
      details: `Initial pattern detection with ${evidenceGroup.length} supporting observations`,
    }],
    label: `${category} pattern involving ${evidenceGroup.length} observations`,
    description: `Recurring pattern detected in ${evidenceGroup.length} observations. ` +
                `First observed: ${recurrenceChars.first_occurrence}, ` +
                `Most recent: ${recurrenceChars.last_occurrence}. ` +
                `This pattern describes observed recurrence only - the underlying cause is not established.`,
  };
  
  return pattern;
}

/**
 * Main pattern detection function
 * Detects patterns from care journey graph events for a caregiver
 */
export function detectPatterns(
  caregiverId: string,
  caseId: string | null = null
): PatternDetectionResult {
  // Get the care journey graph for this caregiver
  const graph = getGraphForCaregiver(caregiverId, caseId);
  const events = graph?.events ?? [];
  
  // Extract supporting evidence from events
  const evidence = extractSupportingEvidence(events, caregiverId);
  
  // Group evidence by potential patterns
  const evidenceGroups = groupEvidenceByPattern(evidence);
  
  // Detect patterns in each group
  const patterns: EnhancedPattern[] = [];
  
  evidenceGroups.forEach((evidenceGroup, groupKey) => {
    // Try to detect patterns of different categories in this group
    const categoriesToCheck: PatternCategory[] = [
      "frequency",
      "routine", 
      "symptom",
      "behavior",
      "caregiver_concern",
      "medication_continuity"
    ];
    
    categoriesToCheck.forEach(category => {
      if (meetsPatternThreshold(evidenceGroup, category)) {
        const pattern = createEnhancedPattern(evidenceGroup, category, caregiverId);
        patterns.push(pattern);
      }
    });
  });
  
  // Sort patterns by confidence (highest first)
  patterns.sort((a, b) => {
    const confScores = { high: 3, medium: 2, low: 1 };
    return confScores[b.confidence] - confScores[a.confidence];
  });
  
  return {
    patterns,
    analysis_timestamp: new Date().toISOString(),
    events_analyzed: events.length,
    caregiver_id: caregiverId,
  };
}

/**
 * Verify a pattern based on caregiver input
 */
export function verifyPattern(
  pattern: EnhancedPattern,
  verificationInput: PatternVerificationInput
): EnhancedPattern {
  // Create a copy of the pattern to modify
  const updatedPattern = { ...pattern };
  
  // Update verification status based on caregiver action
  switch (verificationInput.action) {
    case "confirm":
      updatedPattern.user_response.confirmed = true;
      updatedPattern.user_response.rejected = false;
      updatedPattern.user_response.not_sure = false;
      updatedPattern.verification_status = "verified";
      break;
      
    case "reject":
      updatedPattern.user_response.confirmed = false;
      updatedPattern.user_response.rejected = true;
      updatedPattern.user_response.not_sure = false;
      updatedPattern.verification_status = "rejected";
      break;
      
    case "not_sure":
      updatedPattern.user_response.confirmed = false;
      updatedPattern.user_response.rejected = false;
      updatedPattern.user_response.not_sure = true;
      updatedPattern.verification_status = "uncertain";
      break;
      
    case "correct":
      // Apply corrections if provided
      if (verificationInput.corrections) {
        const corrections = verificationInput.corrections;
        
        // Update event IDs if provided
        if (corrections.event_ids) {
          // In a full implementation, we would map the corrected event IDs
          // to the supporting evidence
          updatedPattern.user_response.corrections_made = true;
        }
        
        // Update dates if provided
        if (corrections.dates) {
          // Update supporting evidence dates
          updatedPattern.supporting_evidence = updatedPattern.supporting_evidence.map(ev => ({
            ...ev,
            date: corrections.dates[ev.event_id] ?? ev.date
          }));
          updatedPattern.user_response.corrections_made = true;
        }
        
        // Add context if provided
        if (corrections.context) {
          if (!updatedPattern.context) {
            updatedPattern.context = {
              description: corrections.context,
              timing: new Date().toISOString(),
              source: "caregiver_input",
            };
          } else {
            // Append to existing context
            updatedPattern.context.description += `\n${corrections.context}`;
          }
          updatedPattern.user_response.context_added = true;
        }
        
        // Update interpretation if provided
        if (corrections.interpretation) {
          // Add as alternative interpretation or update existing
          updatedPattern.alternative_interpretations.push({
            description: corrections.interpretation,
            supporting_evidence: updatedPattern.supporting_evidence.map(ev => ev.event_id),
            confidence: 0.5, // Medium confidence for caregiver-provided interpretation
          });
        }
      }
      
      // Keep status as candidate unless explicitly confirmed/rejected
      if (!updatedPattern.user_response.confirmed && 
          !updatedPattern.user_response.rejected) {
        updatedPattern.verification_status = "candidate";
      }
      break;
      
    case "add_context":
      if (verificationInput.corrections?.context) {
        if (!updatedPattern.context) {
          updatedPattern.context = {
            description: verificationInput.corrections.context,
            timing: new Date().toISOString(),
            source: "caregiver_input",
          };
        } else {
          updatedPattern.context.description += `\n${verificationInput.corrections.context}`;
        }
        updatedPattern.user_response.context_added = true;
      }
      break;
  }
  
  // Update timestamp
  updatedPattern.user_response.last_verification_date = 
    verificationInput.timestamp;
  updatedPattern.identity.updated_at = new Date().toISOString();
  
  // Add audit entry
  updatedPattern.audit_history.push({
    timestamp: verificationInput.timestamp,
    action: verificationInput.action,
    actor: verificationInput.caregiver_id,
    details: `Caregiver ${verificationInput.action}ed pattern ${pattern.identity.id}`,
    previous_version: pattern.identity.version,
  });
  
  // Increment version
  updatedPattern.identity.version += 1;
  
  return updatedPattern;
}

/**
 * Get patterns for a caregiver with optional filtering
 */
export function getPatternsForCaregiver(
  caregiverId: string,
  caseId: string | null = null,
  options: {
    status?: PatternStatus[];
    category?: PatternCategory;
    minConfidence?: PatternConfidence;
  } = {}
): EnhancedPattern[] {
  const result = detectPatterns(caregiverId, caseId);
  let patterns = result.patterns;
  
  // Filter by status if specified
  if (options.status) {
    patterns = patterns.filter(p => options.status!.includes(p.verification_status));
  }
  
  // Filter by category if specified
  if (options.category) {
    patterns = patterns.filter(p => p.category === options.category);
  }
  
  // Filter by minimum confidence if specified
  if (options.minConfidence) {
    const confLevels = { high: 3, medium: 2, low: 1 };
    const minLevel = confLevels[options.minConfidence];
    patterns = patterns.filter(p => 
      confLevels[p.confidence] >= minLevel
    );
  }
  
  return patterns;
}

/**
 * Reset pattern detection for testing (clears any cached state)
 */
export function resetPatternDetection(): void {
  // In a full implementation, this would clear any cached data
  // For now, we rely on the care journey graph being reset externally
}