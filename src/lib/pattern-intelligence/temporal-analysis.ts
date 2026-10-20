/**
 * Temporal Analysis for Pattern Recognition in SolenOS
 * Implements sophisticated temporal analysis for pattern detection,
 * considering dates, intervals, recurrence frequency, duration, 
 * clustering, gaps, and changes over time as specified in point 6.
 */

import type { SupportingEvidence } from "./pattern-models";
import type { RecurrenceCharacteristics } from "./pattern-models";

/**
 * Comprehensive temporal analysis results
 */
export type TemporalAnalysis = {
  /** Basic timing information */
  first_occurrence: string;
  last_occurrence: string;
  occurrence_dates: string[];
  occurrence_count: number;
  
  /** Interval analysis */
  intervals_days: number[]; // Days between consecutive occurrences
  average_interval_days: number;
  interval_standard_deviation: number;
  interval_variance_coefficient: number; // CV = std_dev / mean
  
  /** Recurrence patterns */
  recurrence_frequency_per_week: number; // Average occurrences per week
  recurrence_regularity_score: number; // 0-1 score indicating how regular the pattern is
  clustering_score: number; // 0-1 score indicating temporal clustering (0=uniform, 1=clustered)
  persistence_score: number; // 0-1 score indicating persistent vs temporary pattern
  
  /** Gap analysis */
  gap_analysis: {
    total_span_days: number;
    expected_occurrences: number; // Based on average interval
    actual_occurrences: number;
    missing_intervals: number; // Expected but missing occurrences
    gap_ratio: number; // Proportion of time span that represents gaps
    longest_gap_days: number;
    gap_distribution: number[]; // Sizes of gaps in days
  };
  
  /** Duration analysis (if applicable) */
  duration_analysis?: {
    average_duration: number;
    duration_standard_deviation: number;
    duration_trend: "increasing" | "decreasing" | "stable" | "unclear";
    duration_consistency: number; // 0-1 score
  };
  
  /** Change over time analysis */
  change_over_time: {
    trend_direction: "increasing" | "decreasing" | "stable" | "unclear";
    trend_strength: number; // 0-1 strength of trend
    change_points: number[]; // Indices where significant changes occur
    stability_periods: {
      start_index: number;
      end_index: number;
      characteristics: string;
    }[];
  };
  
  /** Independence assessment */
  independence_assessment: {
    likely_independent: boolean; // Whether observations are likely independent events
    duplication_risk: number; // 0-1 risk that observations are duplicates of same event
    independence_reasoning: string[];
  };
};

/**
 * Perform comprehensive temporal analysis on a group of evidence
 */
export function analyzeTemporalCharacteristics(
  evidence: SupportingEvidence[]
): TemporalAnalysis {
  if (evidence.length === 0) {
    return getEmptyTemporalAnalysis();
  }
  
  // Sort evidence by date
  const sortedEvidence = [...evidence].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  const occurrenceDates = sortedEvidence.map(ev => ev.date);
  const occurrenceCount = occurrenceDates.length;
  const firstOccurrence = occurrenceDates[0];
  const lastOccurrence = occurrenceDates[occurrenceCount - 1];
  
  // Calculate intervals between consecutive occurrences
  const intervalsDays: number[] = [];
  for (let i = 1; i < occurrenceCount; i++) {
    const prevDate = new Date(occurrenceDates[i - 1]).getTime();
    const currDate = new Date(occurrenceDates[i]).getTime();
    const intervalDays = (currDate - prevDate) / (1000 * 60 * 60 * 24);
    intervalsDays.push(intervalDays);
  }
  
  // Calculate interval statistics
  let averageIntervalDays = 0;
  let intervalStandardDeviation = 0;
  let intervalVarianceCoefficient = 0;
  
  if (intervalsDays.length > 0) {
    // Mean
    const sum = intervalsDays.reduce((a, b) => a + b, 0);
    averageIntervalDays = sum / intervalsDays.length;
    
    // Standard deviation
    if (intervalsDays.length > 1) {
      const varianceSum = intervalsDays.reduce(
        (sum, interval) => sum + Math.pow(interval - averageIntervalDays, 2),
        0
      );
      const variance = varianceSum / (intervalsDays.length - 1);
      intervalStandardDeviation = Math.sqrt(variance);
      
      // Variance coefficient (CV = std_dev / mean)
      intervalVarianceCoefficient = averageIntervalDays > 0 
        ? intervalStandardDeviation / averageIntervalDays 
        : 0;
    }
  }
  
  // Recurrence frequency per week
  const totalSpanDays = (
    new Date(lastOccurrence).getTime() - 
    new Date(firstOccurrence).getTime()
  ) / (1000 * 60 * 60 * 24);
  
  const recurrenceFrequencyPerWeek = totalSpanDays > 0 
    ? (occurrenceCount / totalSpanDays) * 7 
    : 0;
  
  // Recurrence regularity score (0-1) - higher means more regular
  let recurrenceRegularityScore = 0;
  if (intervalsDays.length > 0) {
    // Regularity based on inverse of coefficient of variation
    // Lower CV = more regular = higher score
    recurrenceRegularityScore = intervalVarianceCoefficient > 0 
      ? Math.max(0, 1 - Math.min(intervalVarianceCoefficient, 2)) 
      : 1; // Perfect regularity if no variance
  }
  
  // Clustering score (0-1) - higher means more clustered in time
  let clusteringScore = 0;
  if (occurrenceCount > 1) {
    // Clustering based on distribution of intervals
    // More clustering = some intervals very short, some very long
    // Uniform distribution = all intervals similar
    if (intervalsDays.length > 0) {
      const sortedIntervals = [...intervalsDays].sort((a, b) => a - b);
      const q1Index = Math.floor(sortedIntervals.length * 0.25);
      const q3Index = Math.floor(sortedIntervals.length * 0.75);
      const q1 = sortedIntervals[q1Index];
      const q3 = sortedIntervals[q3Index];
      const iqr = q3 - q1; // Interquartile range
      
      // Clustering score based on how much data falls outside IQR
      const outliers = intervalsDays.filter(
        interval => interval < (q1 - 1.5 * iqr) || interval > (q3 + 1.5 * iqr)
      );
      clusteringScore = Math.min(outliers.length / intervalsDays.length, 1);
    }
  }
  
  // Persistence score (0-1) - higher means more persistent vs temporary
  let persistenceScore = 0;
  if (occurrenceCount >= 2) {
    // Persistence considers both regularity and duration of pattern
    const regularityComponent = recurrenceRegularityScore;
    
    // Duration component: how long the pattern has been observable
    const durationComponent = totalSpanDays > 0 
      ? Math.min(totalSpanDays / 365, 1) // Cap at 1 year for normalization
      : 0;
    
    // Combine with weights
    persistenceScore = (regularityComponent * 0.7) + (durationComponent * 0.3);
  }
  
  // Gap analysis
  const gapAnalysis = analyzeGaps(occurrenceDates, averageIntervalDays);
  
  // Change over time analysis
  const changeOverTime = analyzeChangeOverTime(sortedEvidence);
  
  // Independence assessment
  const independenceAssessment = assessIndependence(sortedEvidence, intervalsDays);
  
  return {
    first_occurrence,
    last_occurrence,
    occurrence_dates: occurrenceDates,
    occurrence_count,
    
    intervals_days: intervalsDays,
    average_interval_days,
    interval_standard_deviation,
    interval_variance_coefficient,
    
    recurrence_frequency_per_week,
    recurrence_regularity_score,
    clustering_score,
    persistence_score,
    
    gap_analysis,
    
    change_over_time,
    
    independence_assessment,
  };
}

/**
 * Analyze gaps in the temporal sequence
 */
function analyzeGaps(
  occurrenceDates: string[],
  averageInterval: number
): TemporalAnalysis["gap_analysis"] {
  if (occurrenceDates.length < 2) {
    return {
      total_span_days: 0,
      expected_occurrences: 0,
      actual_occurrences: occurrenceDates.length,
      missing_intervals: 0,
      gap_ratio: 0,
      longest_gap_days: 0,
      gap_distribution: [],
    };
  }
  
  const totalSpanDays = (
    new Date(occurrenceDates[occurrenceDates.length - 1]).getTime() - 
    new Date(occurrenceDates[0]).getTime()
  ) / (1000 * 60 * 60 * 24);
  
  const expectedOccurrences = averageInterval > 0 
    ? Math.floor(totalSpanDays / averageInterval) + 1 
    : occurrenceDates.length;
  
  const actualOccurrences = occurrenceDates.length;
  const missingIntervals = Math.max(0, expectedOccurrences - actualOccurrences);
  
  // Calculate actual gaps between consecutive occurrences
  const gapDistribution: number[] = [];
  let longestGapDays = 0;
  
  for (let i = 1; i < occurrenceDates.length; i++) {
    const prevDate = new Date(occurrenceDates[i - 1]).getTime();
    const currDate = new Date(occurrenceDates[i]).getTime();
    const gapDays = (currDate - prevDate) / (1000 * 60 * 60 * 24);
    gapDistribution.push(gapDays);
    
    if (gapDays > longestGapDays) {
      longestGapDays = gapDays;
    }
  }
  
  // Gap ratio: proportion of time span that represents gaps between observations
  // If we had observations at every expected interval, there would be no gaps
  const expectedGapDays = averageInterval > 0 ? averageInterval : 0;
  const totalExpectedGapDays = expectedGapDays * (occurrenceDates.length - 1);
  const actualTotalGapDays = gapDistribution.reduce((a, b) => a + b, 0);
  const gapRatio = expectedGapDays > 0 
    ? Math.min(actualTotalGapDays / (expectedGapDays * occurrenceDates.length), 1)
    : 0;
  
  return {
    total_span_days: totalSpanDays,
    expected_occurrences: expectedOccurrences,
    actual_occurrences: actualOccurrences,
    missing_intervals: missingIntervals,
    gap_ratio: gapRatio,
    longest_gap_days: longestGapDays,
    gap_distribution: gapDistribution,
  };
}

/**
 * Analyze changes over time in the evidence
 */
function analyzeChangeOverTime(
  evidence: SupportingEvidence[]
): TemporalAnalysis["change_over_time"] {
  if (evidence.length < 3) {
    return {
      trend_direction: "unclear",
      trend_strength: 0,
      change_points: [],
      stability_periods: [],
    };
  }
  
  // For simplicity, we'll look at confidence scores over time
  // In a full implementation, we'd analyze actual observation values
  const confidenceValues = evidence.map(ev => ev.confidence);
  
  // Simple trend detection
  let trendDirection = "stable";
  let trendStrength = 0;
  
  if (confidenceValues.length >= 3) {
    // Compare first third to last third
    const third = Math.floor(confidenceValues.length / 3);
    const firstThirdAvg = confidenceValues.slice(0, third).reduce((a, b) => a + b, 0) / third;
    const lastThirdAvg = confidenceValues.slice(confidenceValues.length - third).reduce((a, b) => a + b, 0) / third;
    
    const diff = lastThirdAvg - firstThirdAvg;
    if (Math.abs(diff) > 0.1) { // Significant change threshold
      trendDirection = diff > 0 ? "increasing" : "decreasing";
      trendStrength = Math.min(Math.abs(diff) * 2, 1); // Scale to 0-1
    }
  }
  
  // Simple change point detection (where confidence changes significantly)
  const changePoints: number[] = [];
  const changeThreshold = 0.2; // Significant change threshold
  
  for (let i = 1; i < confidenceValues.length; i++) {
    const change = Math.abs(confidenceValues[i] - confidenceValues[i - 1]);
    if (change > changeThreshold) {
      changePoints.push(i);
    }
  }
  
  // Identify stability periods (simplified)
  const stabilityPeriods: {
    start_index: number;
    end_index: number;
    characteristics: string;
  }[] = [];
  
  if (confidenceValues.length > 0) {
    let startIdx = 0;
    for (let i = 1; i <= confidenceValues.length; i++) {
      // End of period if we hit a change point or reach the end
      const isChangePoint = changePoints.includes(i);
      const isEnd = i === confidenceValues.length;
      
      if (isChangePoint || isEnd) {
        const endIdx = isEnd ? confidenceValues.length - 1 : i - 1;
        if (endIdx >= startIdx) {
          const avgConfidence = confidenceValues.slice(startIdx, endIdx + 1)
            .reduce((a, b) => a + b, 0) / (endIdx - startIdx + 1);
          
          stabilityPeriods.push({
            start_index: startIdx,
            end_index: endIdx,
            characteristics: `Average confidence: ${avgConfidence.toFixed(2)}`
          });
          
          startIdx = i; // Start next period after this one
        }
      }
    }
  }
  
  return {
    trend_direction: trendDirection,
    trend_strength: trendStrength,
    change_points: changePoints,
    stability_periods: stabilityPeriods,
  };
}

/**
 * Assess whether observations are likely independent events
 */
function assessIndependence(
  evidence: SupportingEvidence[],
  intervals: number[]
): TemporalAnalysis["independence_assessment"] {
  if (evidence.length < 2) {
    return {
      likely_independent: true,
      duplication_risk: 0,
      independence_reasoning: ["Insufficient data to assess independence"],
    };
  }
  
  const reasoning: string[] = [];
  let duplicationRisk = 0;
  
  // Check temporal proximity - very close observations may be duplicates
  let veryCloseCount = 0;
  const veryCloseThresholdHours = 1; // Observations within 1 hour may be duplicates
  
  for (let i = 1; i < evidence.length; i++) {
    const prevTime = new Date(evidence[i - 1].date).getTime();
    const currTime = new Date(evidence[i].date).getTime();
    const hoursApart = (currTime - prevTime) / (1000 * 60 * 60);
    
    if (hoursApart <= veryCloseThresholdHours) {
      veryCloseCount++;
    }
  }
  
  // Base duplication risk on very close observations
  if (evidence.length > 1) {
    duplicationRisk = veryCloseCount / (evidence.length - 1);
  }
  
  // Check for identical descriptions (strong indicator of duplication)
  const descriptionCounts: Record<string, number> = {};
  evidence.forEach(ev => {
    const desc = ev.description.toLowerCase().trim();
    descriptionCounts[desc] = (descriptionCounts[desc] || 0) + 1;
  });
  
  const maxDescriptionCount = Math.max(...Object.values(descriptionCounts));
  if (maxDescriptionCount > 1) {
    const duplicateDescriptionRatio = (maxDescriptionCount - 1) / evidence.length;
    duplicationRisk = Math.max(duplicationRisk, duplicateDescriptionRatio * 0.8); // Weighted
    reasoning.push(`Some observations have identical descriptions`);
  }
  
  // Check for same source reporting similar things (potential duplicate reporting)
  const sourceCounts: Record<string, number> = {};
  evidence.forEach(ev => {
    sourceCounts[ev.source] = (sourceCounts[ev.source] || 0) + 1;
  });
  
  const maxSourceCount = Math.max(...Object.values(sourceCounts));
  if (maxSourceCount > 1 && evidence.length > 3) {
    const sourceDuplicationRisk = (maxSourceCount - 1) / evidence.length;
    duplicationRisk = Math.max(duplicationRisk, sourceDuplicationRisk * 0.6);
    reasoning.push(`Some sources reported multiple similar observations`);
  }
  
  // Determine if observations are likely independent
  const likelyIndependent = duplicationRisk < 0.3; // Less than 30% duplication risk
  
  if (likelyIndependent) {
    reasoning.push("Observations appear to be independent events based on temporal distribution and content");
  } else {
    reasoning.push("Observations show signs of potential duplication or reporting bias");
  }
  
  return {
    likely_independent,
    duplication_risk: Math.min(duplicationRisk, 1),
    independence_reasoning: reasoning,
  };
}

/**
 * Get empty temporal analysis for edge cases
 */
function getEmptyTemporalAnalysis(): TemporalAnalysis {
  return {
    first_occurrence: "",
    last_occurrence: "",
    occurrence_dates: [],
    occurrence_count: 0,
    
    intervals_days: [],
    average_interval_days: 0,
    interval_standard_deviation: 0,
    interval_variance_coefficient: 0,
    
    recurrence_frequency_per_week: 0,
    recurrence_regularity_score: 0,
    clustering_score: 0,
    persistence_score: 0,
    
    gap_analysis: {
      total_span_days: 0,
      expected_occurrences: 0,
      actual_occurrences: 0,
      missing_intervals: 0,
      gap_ratio: 0,
      longest_gap_days: 0,
      gap_distribution: [],
    },
    
    change_over_time: {
      trend_direction: "unclear",
      trend_strength: 0,
      change_points: [],
      stability_periods: [],
    },
    
    independence_assessment: {
      likely_independent: true,
      duplication_risk: 0,
      independence_reasoning: ["No evidence to analyze"],
    },
  };
}

/**
 * Calculate temporal confidence score for pattern detection
 * Combines various temporal factors into a single confidence metric
 */
export function calculateTemporalConfidence(
  temporalAnalysis: TemporalAnalysis
): number {
  // Weights for different temporal factors
  const weights = {
    regularity: 0.25,
    persistence: 0.20,
    clustering: 0.15,
    independence: 0.20,
    gap_avoidance: 0.10,
    sufficient_duration: 0.10,
  };
  
  // Regularity component (0-1)
  const regularityScore = temporalAnalysis.recurrence_regularity_score;
  
  // Persistence component (0-1)
  const persistenceScore = temporalAnalysis.persistence_score;
  
  // Clustering component (0-1) - note: we want some clustering but not too much
  // Ideal clustering is around 0.3-0.7 for natural patterns
  let clusteringScore = 0;
  if (temporalAnalysis.clustering_score >= 0.2 && temporalAnalysis.clustering_score <= 0.8) {
    clusteringScore = 1 - Math.abs(0.5 - temporalAnalysis.clustering_score) * 2; // Peak at 0.5
  } else {
    clusteringScore = Math.max(0, 1 - Math.abs(temporalAnalysis.clustering_score - 0.5) * 2);
  }
  
  // Independence component (0-1) - higher independence = higher score
  const independenceScore = 1 - temporalAnalysis.independence_assessment.duplication_risk;
  
  // Gap avoidance component (0-1) - lower gap ratio = better
  const gapAvoidanceScore = 1 - Math.min(temporalAnalysis.gap_analysis.gap_ratio, 1);
  
  // Sufficient duration component (0-1)
  // Pattern should be observable for long enough to be meaningful
  const sufficientDurationScore = temporalAnalysis.gap_analysis.total_span_days >= 7 ? 1 : 
                                 temporalAnalysis.gap_analysis.total_span_days / 7; // Normalize to week
  
  // Calculate weighted score
  const temporalConfidence = 
    (weights.regularity * regularityScore) +
    (weights.persistence * persistenceScore) +
    (weights.clustering * clusteringScore) +
    (weights.independence * independenceScore) +
    (weights.gap_avoidance * gapAvoidanceScore) +
    (weights.sufficient_duration * sufficientDurationScore);
  
  return Math.min(temporalConfidence, 1);
}