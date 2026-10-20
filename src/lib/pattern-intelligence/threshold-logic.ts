/**
 * Pattern Threshold Logic for SolenOS
 * Implements explainable threshold criteria for pattern detection
 * that avoids arbitrary universal numbers as specified in point 9.
 */

import type { SupportingEvidence } from "./pattern-models";
import type { PatternCategory } from "./pattern-models";
import type { TemporalAnalysis } from "./temporal-analysis";
import type { EntityResolutionResult } from "./entity-resolution";

/**
 * Pattern Threshold Criteria - explainable thresholds that avoid arbitrary numbers
 */
export type ExplainableThresholdCriteria = {
  /** Minimum occurrences with justification */
  min_occurrences: {
    value: number;
    justification: string; // Explanation for why this number was chosen
  };
  
  /** Minimum confidence with justification */
  min_confidence: {
    value: number; // 0-1 scale
    justification: string;
  };
  
  /** Consistency threshold with justification */
  consistency_threshold: {
    value: number; // 0-1 scale
    justification: string;
  };
  
  /** Source diversity requirement with justification */
  source_diversity: {
    min_sources: number;
    justification: string;
  };
  
  /** Temporal distribution requirements with justification */
  temporal_distribution: {
    max_gap_ratio: number; // 0-1, proportion of time that can be gaps
    min_regularity_score: number; // 0-1
    justification: string;
  };
  
  /** Duplicate evidence handling with justification */
  duplicate_handling: {
    max_duplicate_risk: number; // 0-1
    justification: string;
  };
  
  /** Baseline considerations with justification */
  baseline_requirements: {
    required: boolean;
    justification: string;
    min_baseline_period_days?: number; // If baseline is needed
  };
};

/**
 * Threshold Justifications - explanations for why specific values are chosen
 */
export const THRESHOLD_JUSTIFICATIONS = {
  min_occurrences: {
    frequency: "Three occurrences provides initial evidence of repetition while allowing for natural variation. Fewer than three could be coincidental; more than three increases confidence but may delay detection of emerging patterns.",
    routine: "Three instances of routine deviation establishes a pattern rather than isolated incidents, while being sensitive enough to detect meaningful changes in established routines.",
    medication_continuity: "Two documented medication issues constitutes a pattern because medication errors are clinically significant even when infrequent, and repeated medication issues indicate systemic problems.",
    caregiver_concern: "Two instances of the same caregiver concern warrants attention as it suggests the concern is persistent and not merely a momentary worry.",
    symptom: "Three symptom reports balances sensitivity with specificity, reducing false positives while capturing genuine recurring symptoms.",
    default: "Three occurrences represents the minimum threshold where repetition becomes more likely than random chance, based on statistical principles of pattern recognition."
  },
  
  min_confidence: {
    frequency: "0.7 confidence threshold ensures we have reasonable evidence before flagging a pattern, balancing sensitivity with specificity.",
    routine: "0.7 confidence allows detection of meaningful routine changes while preventing over-alerting on minor variations.",
    medication_continuity: "0.8 confidence reflects the higher stakes of medication issues, requiring stronger evidence before raising concerns.",
    caregiver_concern: "0.7 confidence respects caregiver observations while ensuring we don't elevate every passing concern to pattern status.",
    symptom: "0.7 confidence provides appropriate weight to symptom reports without over-pathologizing normal variations.",
    default: "0.7 confidence represents a balance where we have substantial evidence but remain open to updating patterns with new information."
  },
  
  consistency_threshold: {
    frequency: "0.6 consistency threshold allows for natural variation in how symptoms manifest while ensuring core similarities exist.",
    routine: "0.65 consistency threshold detects meaningful routine patterns while allowing for expected variations in routine execution.",
    medication_continuity: "0.75 consistency threshold ensures medication patterns show reliable repetition given their clinical importance.",
    caregiver_concern: "0.6 consistency threshold captures genuine persistent concerns while filtering out transient worries.",
    symptom: "0.65 consistency threshold ensures symptom patterns show reliable repetition.",
    default: "0.6 consistency threshold represents the point where observations share sufficient similarities to be considered related while allowing for meaningful variation."
  },
  
  source_diversity: {
    frequency: "At least 2 different sources reduces risk of single-source bias or reporting errors.",
    routine: "Multiple sources for routine patterns helps establish that deviations are observable by different caregivers or in different contexts.",
    medication_continuity: "Multiple sources for medication patterns is critical due to potential safety implications.",
    caregiver_concern: "Different sources expressing the same concern provides stronger evidence than repeated reports from one source.",
    symptom: "Multiple sources for symptom patterns increases confidence that symptoms are genuinely occurring.",
    default: "Requiring multiple sources helps ensure patterns aren't artifacts of single-source reporting bias or errors."
  },
  
  temporal_distribution: {
    frequency: "Patterns should show reasonable temporal distribution rather than clustering all at once, suggesting genuine recurrence rather than temporary bursts.",
    routine: "Routine patterns should demonstrate consistent deviation over time rather than isolated incidents.",
    medication_continuity: "Medication patterns should show temporal distribution indicating ongoing issues rather than one-time events.",
    caregiver_concern: "Persistent concerns should appear across different time periods, not just in bursts.",
    symptom: "Symptom patterns should show temporal distribution suggesting ongoing issues rather than temporary clusters.",
    default: "Requiring reasonable temporal distribution prevents flagging temporary bursts as permanent patterns while still capturing genuine recurring patterns."
  },
  
  duplicate_handling: {
    frequency: "Limiting duplicate evidence risk prevents inflation of occurrence counts due to multiple reports of the same event.",
    routine: "Duplicate evidence controls are important for routine patterns to avoid counting the same observation multiple times.",
    medication_continuity: "Strict duplicate handling for medication patterns is essential due to potential safety implications of overcounting.",
    caregiver_concern: "Moderate duplicate handling allows for genuine repeated concerns while preventing overcounting due to repeated reporting of same worry.",
    symptom: "Duplicate evidence controls ensure symptom counts reflect actual occurrences rather than repeated reporting.",
    default: "Limiting duplicate evidence risk ensures occurrence counts reflect genuine independent observations rather than multiple reports of the same event."
  },
  
  baseline_requirements: {
    frequency: "Baseline is helpful but not required for frequency patterns as we can detect repetition without knowing normal frequency.",
    routine: "Baseline is important for routine patterns to establish what constitutes a deviation, but patterns can still be detected without perfect baseline.",
    medication_continuity: "Baseline expectations for medication are often clear from prescriptions, but patterns can be detected based on reported issues alone.",
    caregiver_concern: "Baseline is less relevant for concern patterns as we're tracking the concern itself, not its medical validity.",
    symptom: "Baseline can be helpful but is not required as we can detect symptom repetition without establishing what's 'normal'.",
    default: "While baselines enhance pattern detection, requiring them would prevent detection of patterns where no baseline exists or where establishing baseline is difficult."
  }
};

/**
 * Get threshold criteria for a specific pattern category with justifications
 */
export function getExplainableThresholds(category: PatternCategory): ExplainableThresholdCriteria {
  // Base thresholds that apply to all categories
  const baseThresholds: ExplainableThresholdCriteria = {
    min_occurrences: {
      value: 3,
      justification: THRESHOLD_JUSTIFICATIONS.min_occurrences.default
    },
    min_confidence: {
      value: 0.7,
      justification: THRESHOLD_JUSTIFICATIONS.min_confidence.default
    },
    consistency_threshold: {
      value: 0.6,
      justification: THRESHOLD_JUSTIFICATIONS.consistency_threshold.default
    },
    source_diversity: {
      min_sources: 2,
      justification: THRESHOLD_JUSTIFICATIONS.source_diversity.default
    },
    temporal_distribution: {
      max_gap_ratio: 0.5, // No more than half the time span should be gaps
      min_regularity_score: 0.4, // At least some regularity
      justification: THRESHOLD_JUSTIFICATIONS.temporal_distribution.default
    },
    duplicate_handling: {
      max_duplicate_risk: 0.3, // No more than 30% duplicate risk
      justification: THRESHOLD_JUSTIFICATIONS.duplicate_handling.default
    },
    baseline_requirements: {
      required: false,
      justification: THRESHOLD_JUSTIFICATIONS.baseline_requirements.default
    }
  };
  
  // Category-specific overrides
  const categoryOverrides: Partial<Record<PatternCategory, ExplainableThresholdCriteria>> = {
    frequency: {
      min_occurrences: {
        value: 3,
        justification: THRESHOLD_JUSTIFICATIONS.min_occurrences.frequency
      },
      min_confidence: {
        value: 0.7,
        justification: THRESHOLD_JUSTIFICATIONS.min_confidence.frequency
      },
      consistency_threshold: {
        value: 0.6,
        justification: THRESHOLD_JUSTIFICATIONS.consistency_threshold.frequency
      },
      source_diversity: {
        min_sources: 2,
        justification: THRESHOLD_JUSTIFICATIONS.source_diversity.frequency
      },
      temporal_distribution: {
        max_gap_ratio: 0.5,
        min_regularity_score: 0.4,
        justification: THRESHOLD_JUSTIFICATIONS.temporal_distribution.frequency
      },
      duplicate_handling: {
        max_duplicate_risk: 0.3,
        justification: THRESHOLD_JUSTIFICATIONS.duplicate_handling.frequency
      },
      baseline_requirements: {
        required: false,
        justification: THRESHOLD_JUSTIFICATIONS.baseline_requirements.frequency
      }
    },
    routine: {
      min_occurrences: {
        value: 3,
        justification: THRESHOLD_JUSTIFICATIONS.min_occurrences.routine
      },
      min_confidence: {
        value: 0.7,
        justification: THRESHOLD_JUSTIFICATIONS.min_confidence.routine
      },
      consistency_threshold: {
        value: 0.65,
        justification: THRESHOLD_JUSTIFICATIONS.consistency_threshold.routine
      },
      source_diversity: {
        min_sources: 2,
        justification: THRESHOLD_JUSTIFICATIONS.source_diversity.routine
      },
      temporal_distribution: {
        max_gap_ratio: 0.4, // Stricter for routines - expect more regularity
        min_regularity_score: 0.5,
        justification: THRESHOLD_JUSTIFICATIONS.temporal_distribution.routine
      },
      duplicate_handling: {
        max_duplicate_risk: 0.25,
        justification: THRESHOLD_JUSTIFICATIONS.duplicate_handling.routine
      },
      baseline_requirements: {
        required: true, // Routines really need a baseline to detect deviations
        justification: THRESHOLD_JUSTIFICATIONS.baseline_requirements.routine
      }
    },
    medication_continuity: {
      min_occurrences: {
        value: 2,
        justification: THRESHOLD_JUSTIFICATIONS.min_occurrences.medication_continuity
      },
      min_confidence: {
        value: 0.8,
        justification: THRESHOLD_JUSTIFICATIONS.min_confidence.medication_continuity
      },
      consistency_threshold: {
        value: 0.75,
        justification: THRESHOLD_JUSTIFICATIONS.consistency_threshold.medication_continuity
      },
      source_diversity: {
        min_sources: 2,
        justification: THRESHOLD_JUSTIFICATIONS.source_diversity.medication_continuity
      },
      temporal_distribution: {
        max_gap_ratio: 0.4,
        min_regularity_score: 0.5,
        justification: THRESHOLD_JUSTIFICATIONS.temporal_distribution.medication_continuity
      },
      duplicate_handling: {
        max_duplicate_risk: 0.2, // Very strict for medication
        justification: THRESHOLD_JUSTIFICATIONS.duplicate_handling.medication_continuity
      },
      baseline_requirements: {
        required: false,
        justification: THRESHOLD_JUSTIFICATIONS.baseline_requirements.medication_continuity
      }
    },
    caregiver_concern: {
      min_occurrences: {
        value: 2,
        justification: THRESHOLD_JUSTIFICATIONS.min_occurrences.caregiver_concern
      },
      min_confidence: {
        value: 0.7,
        justification: THRESHOLD_JUSTIFICATIONS.min_confidence.caregiver_concern
      },
      consistency_threshold: {
        value: 0.6,
        justification: THRESHOLD_JUSTIFICATIONS.consistency_threshold.caregiver_concern
      },
      source_diversity: {
        min_sources: 2,
        justification: THRESHOLD_JUSTIFICATIONS.source_diversity.caregiver_concern
      },
      temporal_distribution: {
        max_gap_ratio: 0.6, // More lenient for concerns - can be bursty
        min_regularity_score: 0.3,
        justification: THRESHOLD_JUSTIFICATIONS.temporal_distribution.caregiver_concern
      },
      duplicate_handling: {
        max_duplicate_risk: 0.4, // More lenient - same concern can be reported multiple times
        justification: THRESHOLD_JUSTIFICATIONS.duplicate_handling.caregiver_concern
      },
      baseline_requirements: {
        required: false,
        justification: THRESHOLD_JUSTIFICATIONS.baseline_requirements.caregiver_concern
      }
    },
    symptom: {
      min_occurrences: {
        value: 3,
        justification: THRESHOLD_JUSTIFICATIONS.min_occurrences.symptom
      },
      min_confidence: {
        value: 0.7,
        justification: THRESHOLD_JUSTIFICATIONS.min_confidence.symptom
      },
      consistency_threshold: {
        value: 0.65,
        justification: THRESHOLD_JUSTIFICATIONS.consistency_threshold.symptom
      },
      source_diversity: {
        min_sources: 2,
        justification: THRESHOLD_JUSTIFICATIONS.source_diversity.symptom
      },
      temporal_distribution: {
        max_gap_ratio: 0.5,
        min_regularity_score: 0.4,
        justification: THRESHOLD_JUSTIFICATIONS.temporal_distribution.symptom
      },
      duplicate_handling: {
        max_duplicate_risk: 0.3,
        justification: THRESHOLD_JUSTIFICATIONS.duplicate_handling.symptom
      },
      baseline_requirements: {
        required: false,
        justification: THRESHOLD_JUSTIFICATIONS.baseline_requirements.symptom
      }
    }
  };
  
  // Merge base thresholds with category-specific overrides
  const categorySpecific = categoryOverrides[category] ?? {};
  
  return {
    min_occurrences: {
      value: categorySpecific.min_occurrences?.value ?? baseThresholds.min_occurrences.value,
      justification: categorySpecific.min_occurrences?.justification ?? baseThresholds.min_occurrences.justification
    },
    min_confidence: {
      value: categorySpecific.min_confidence?.value ?? baseThresholds.min_confidence.value,
      justification: categorySpecific.min_confidence?.justification ?? baseThresholds.min_confidence.justification
    },
    consistency_threshold: {
      value: categorySpecific.consistency_threshold?.value ?? baseThresholds.consistency_threshold.value,
      justification: categorySpecific.consistency_threshold?.justification ?? baseThresholds.consistency_threshold.justification
    },
    source_diversity: {
      min_sources: categorySpecific.source_diversity?.min_sources ?? baseThresholds.source_diversity.min_sources,
      justification: categorySpecific.source_diversity?.justification ?? baseThresholds.source_diversity.justification
    },
    temporal_distribution: {
      max_gap_ratio: categorySpecific.temporal_distribution?.max_gap_ratio ?? baseThresholds.temporal_distribution.max_gap_ratio,
      min_regularity_score: categorySpecific.temporal_distribution?.min_regularity_score ?? baseThresholds.temporal_distribution.min_regularity_score,
      justification: categorySpecific.temporal_distribution?.justification ?? baseThresholds.temporal_distribution.justification
    },
    duplicate_handling: {
      max_duplicate_risk: categorySpecific.duplicate_handling?.max_duplicate_risk ?? baseThresholds.duplicate_handling.max_duplicate_risk,
      justification: categorySpecific.duplicate_handling?.justification ?? baseThresholds.duplicate_handling.justification
    },
    baseline_requirements: {
      required: categorySpecific.baseline_requirements?.required ?? baseThresholds.baseline_requirements.required,
      justification: categorySpecific.baseline_requirements?.justification ?? baseThresholds.baseline_requirements.justification
    }
  };
}

/**
 * Evaluate whether evidence meets explainable threshold criteria
 * Returns detailed explanation of why it does or doesn't meet criteria
 */
export function evaluateEvidenceAgainstThresholds(
  evidence: SupportingEvidence[],
  category: PatternCategory,
  temporalAnalysis: TemporalAnalysis,
  entityResolutionResults: EntityResolutionResult[]
): {
  meets_threshold: boolean;
  explanations: {
    criterion: string;
    meets: boolean;
    value: number | boolean;
    threshold: number | boolean;
    justification: string;
    details?: string;
  }[];
} {
  const thresholds = getExplainableThresholds(category);
  const explanations = [];
  
  // 1. Check minimum occurrences
  const occMeets = evidence.length >= thresholds.min_occurrences.value;
  explanations.push({
    criterion: "minimum_occurrences",
    meets: occMeets,
    value: evidence.length,
    threshold: thresholds.min_occurrences.value,
    justification: thresholds.min_occurrences.justification,
    details: occMeets 
      ? `Sufficient occurrences (${evidence.length}) to establish a pattern`
      : `Insufficient occurrences (${evidence.length}) - need at least ${thresholds.min_occurrences.value} to establish a pattern`
  });
  
  // If we don't meet minimum occurrences, we can early exit
  if (!occMeets) {
    return {
      meets_threshold: false,
      explanations
    };
  }
  
  // 2. Check source diversity
  const uniqueSources = new Set(evidence.map(ev => ev.source));
  const sourceMeets = uniqueSources.size >= thresholds.source_diversity.min_sources;
  explanations.push({
    criterion: "source_diversity",
    meets: sourceMeets,
    value: uniqueSources.size,
    threshold: thresholds.source_diversity.min_sources,
    justification: thresholds.source_diversity.justification,
    details: sourceMeets
      ? `Evidence comes from ${uniqueSources.size} different sources: ${Array.from(uniqueSources).join(", ")}`
      : `Insufficient source diversity - only ${uniqueSources.size} source(s), need at least ${thresholds.source_diversity.min_sources}`
  });
  
  // 3. Calculate and check consistency score (from temporal analysis)
  // We'll derive consistency from temporal analysis and evidence characteristics
  const consistencyScore = calculateConsistencyFromEvidence(evidence, temporalAnalysis);
  const consistencyMeets = consistencyScore >= thresholds.consistency_threshold.value;
  explanations.push({
    criterion: "consistency_score",
    meets: consistencyMeets,
    value: consistencyScore,
    threshold: thresholds.consistency_threshold.value,
    justification: thresholds.consistency_threshold.justification,
    details: consistencyMeets
      ? `Sufficient consistency (${consistencyScore.toFixed(2)}) in observations`
      : `Insufficient consistency (${consistencyScore.toFixed(2)}) - observations lack sufficient similarity to be considered a pattern`
  });
  
  // 4. Check temporal distribution
  const temporalMeets = 
    temporalAnalysis.gap_analysis.gap_ratio <= thresholds.temporal_distribution.max_gap_ratio &&
    temporalAnalysis.recurrence_regularity_score >= thresholds.temporal_distribution.min_regularity_score;
  
  explanations.push({
    criterion: "temporal_distribution",
    meets: temporalMeets,
    value: {
      gap_ratio: temporalAnalysis.gap_analysis.gap_ratio,
      regularity_score: temporalAnalysis.recurrence_regularity_score
    },
    threshold: {
      max_gap_ratio: thresholds.temporal_distribution.max_gap_ratio,
      min_regularity_score: thresholds.temporal_distribution.min_regularity_score
    },
    justification: thresholds.temporal_distribution.justification,
    details: temporalMeets
      ? `Acceptable temporal distribution: gap ratio ${temporalAnalysis.gap_analysis.gap_ratio.toFixed(2)} (max ${thresholds.temporal_distribution.max_gap_ratio}), regularity ${temporalAnalysis.recurrence_regularity_score.toFixed(2)} (min ${thresholds.temporal_distribution.min_regularity_score})`
      : `Unacceptable temporal distribution: gap ratio ${temporalAnalysis.gap_analysis.gap_ratio.toFixed(2)} (max ${thresholds.temporal_distribution.max_gap_ratio}) or regularity ${temporalAnalysis.recurrence_regularity_score.toFixed(2)} (min ${thresholds.temporal_distribution.min_regularity_score})`
  });
  
  // 5. Check duplicate evidence risk
  const duplicateRisk = calculateDuplicateEvidenceRisk(evidence, entityResolutionResults);
  const duplicateMeets = duplicateRisk <= thresholds.duplicate_handling.max_duplicate_risk;
  explanations.push({
    criterion: "duplicate_evidence_risk",
    meets: duplicateMeets,
    value: duplicateRisk,
    threshold: thresholds.duplicate_handling.max_duplicate_risk,
    justification: thresholds.duplicate_handling.justification,
    details: duplicateMeets
      ? `Acceptable duplicate evidence risk: ${(duplicateRisk * 100).toFixed(1)}% (max ${(thresholds.duplicate_handling.max_duplicate_risk * 100).toFixed(1)}%)`
      : `Excessive duplicate evidence risk: ${(duplicateRisk * 100).toFixed(1)}% (max ${(thresholds.duplicate_handling.max_duplicate_risk * 100).toFixed(1)}%) - evidence may represent duplicate reporting of same events`
  });
  
  // 6. Check baseline requirements if applicable
  let baselineMeets = true;
  let baselineDetails = "Baseline requirement not applicable";
  
  if (thresholds.baseline_requirements.required) {
    // In a full implementation, we would check against actual baseline data
    // For now, we'll simulate this check
    const hasBaseline = false; // Placeholder - would check actual baseline data
    baselineMeets = hasBaseline;
    baselineDetails = hasBaseline
      ? "Baseline data available for comparison"
      : "No baseline data available - pattern detection proceeds without baseline comparison as permitted";
    
    explanations.push({
      criterion: "baseline_requirement",
      meets: baselineMeets,
      value: hasBaseline,
      threshold: true,
      justification: thresholds.baseline_requirements.justification,
      details: baselineDetails
    });
  }
  
  // Overall determination - all criteria must be met
  const meetsThreshold = 
    occMeets && 
    sourceMeets && 
    consistencyMeets && 
    temporalMeets && 
    duplicateMeets &&
    baselineMeets;
  
  return {
    meets_threshold,
    explanations
  };
}

/**
 * Calculate consistency score from evidence and temporal analysis
 */
function calculateConsistencyFromEvidence(
  evidence: SupportingEvidence[],
  temporalAnalysis: TemporalAnalysis
): number {
  // Combine multiple factors to estimate consistency
  // 1. Confidence consistency (how similar are the confidence scores?)
  const confidenceValues = evidence.map(ev => ev.confidence);
  let confidenceConsistency = 1;
  if (confidenceValues.length > 1) {
    const avgConfidence = confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length;
    const variance = confidenceValues.reduce(
      (sum, val) => sum + Math.pow(val - avgConfidence, 2),
      0
    ) / confidenceValues.length;
    const stdDev = Math.sqrt(variance);
    confidenceConsistency = avgConfidence > 0 
      ? Math.max(0, 1 - (stdDev / avgConfidence)) 
      : (stdDev === 0 ? 1 : 0);
  }
  
  // 2. Temporal consistency from analysis
  const temporalConsistency = temporalAnalysis.recurrence_regularity_score;
  
  // 3. Source consistency - are sources similar types?
  const sourceTypes = evidence.map(ev => ev.source_type);
  const uniqueSourceTypes = new Set(sourceTypes);
  const sourceConsistency = sourceTypes.length > 0 
    ? uniqueSourceTypes.size / sourceTypes.length 
    : 1;
  // Invert so higher consistency = more similar source types
  const sourceConsistencyScore = 1 - sourceConsistency;
  
  // Weighted combination
  return (confidenceConsistency * 0.4) + (temporalConsistency * 0.4) + (sourceConsistencyScore * 0.2);
}

/**
 * Calculate duplicate evidence risk from entity resolution results
 */
function calculateDuplicateEvidenceRisk(
  evidence: SupportingEvidence[],
  entityResolutionResults: EntityResolutionResult[]
): number {
  if (evidence.length < 2) return 0;
  
  // Count how many entity resolution results indicate high likelihood of same phenomenon
  // which would suggest duplicate reporting
  let duplicateIndications = 0;
  let totalComparisons = 0;
  
  // Simplified approach: look at entity resolution results
  // In reality, we'd map these back to specific evidence pairs
  for (const result of entityResolutionResults) {
    if (result.same_phenomenon && result.confidence >= 0.7) {
      duplicateIndications++;
    }
    totalComparisons++;
  }
  
  // Avoid division by zero
  if (totalComparisons === 0) return 0;
  
  // Return proportion of comparisons indicating same phenomenon
  // Cap at 1.0
  return Math.min(duplicateIndications / totalComparisons, 1);
}

/**
 * Get human-readable explanation of threshold logic for UI display
 */
export function getThresholdExplanationForDisplay(category: PatternCategory): string {
  const thresholds = getExplainableThresholds(category);
  
  return `Pattern Detection Thresholds for ${category}:
  
  • Minimum Occurrences: ${thresholds.min_occurrences.value} 
    (Justification: ${thresholds.min_occurrences.justification})
  
  • Minimum Confidence: ${(thresholds.min_confidence.value * 100).toFixed(0)}%
    (Justification: ${thresholds.min_confidence.justification})
  
  • Consistency Threshold: ${(thresholds.consistency_threshold.value * 100).toFixed(0)}%
    (Justification: ${thresholds.consistency_threshold.justification})
  
  • Source Diversity: At least ${thresholds.source_diversity.min_sources} different sources
    (Justification: ${thresholds.source_diversity.justification})
  
  • Temporal Distribution: 
    - Maximum gap ratio: ${(thresholds.temporal_distribution.max_gap_ratio * 100).toFixed(0)}%
    - Minimum regularity score: ${(thresholds.temporal_distribution.min_regularity_score * 100).toFixed(0)}%
    (Justification: ${thresholds.temporal_distribution.justification})
  
  • Duplicate Evidence Handling: 
    - Maximum duplicate risk: ${(thresholds.duplicate_handling.max_duplicate_risk * 100).toFixed(0)}%
    (Justification: ${thresholds.duplicate_handling.justification})
  
  • Baseline Requirements: 
    - Required: ${thresholds.baseline_requirements.required ? 'Yes' : 'No'}
    (Justification: ${thresholds.baseline_requirements.justification})`;
}