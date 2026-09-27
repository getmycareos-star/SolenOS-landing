/**
 * Care Understanding Confidence — Product Principle (Phase 2)
 * Trust through visible gaps, not false precision.
 * Never surface gamified scores. Show area-level clarity with evidence.
 */

import type { ContinuityTruthSlice } from "../presentation-engine";
import type { BaselineIntelligenceResult } from "../baseline-intelligence-engine";
import type { AggregatedConfidence } from "../confidence-aggregation";
import { projectCareUnderstandingConfidence } from "../presentation-engine";
import { projectPresentation } from "../presentation-engine";

export type CareUnderstandingConfidenceInput = {
  /** Current understanding slice */
  truth_slice: ContinuityTruthSlice;
  /** Baseline comparison */
  baseline_result?: BaselineIntelligenceResult;
  /** Aggregated confidence */
  aggregated_confidence?: AggregatedConfidence;
  /** Caregiver ID */
  caregiver_id: string;
  /** Care recipient ID */
  care_recipient_id: string;
  /** Timestamp */
  timestamp: string;
};

export type CareUnderstandingConfidenceOutput = {
  status: "FUTURE";
  computed_at: string;
  question: "What do we currently understand about this person's care reality?";
  clear_areas: Array<{
    area: string;
    clarity: "clear";
    reliability: "high";
    evidence: string[];
    related_event_ids?: string[];
  }>;
  limited_areas: Array<{
    area: string;
    clarity: "limited";
    reliability: "medium";
    evidence: string[];
    missing_context: string;
    what_would_improve?: string;
    related_event_ids?: string[];
  }>;
  unknown_areas: Array<{
    area: string;
    clarity: "unknown";
    reliability: "low";
    evidence: string[];
    missing_context: string;
    what_would_improve?: string;
    related_event_ids?: string[];
  }>;
  caregiver_should_feel: readonly string[];
  caregiver_should_not_feel: readonly string[];
  presentation_view: ReturnType<typeof projectPresentation>;
  overall_confidence_label: string;
};

/**
 * Process Care Understanding Confidence — project area-level clarity
 */
export async function processCareUnderstandingConfidence(input: CareUnderstandingConfidenceInput): Promise<CareUnderstandingConfidenceOutput> {
  const { truth_slice, baseline_result, aggregated_confidence, timestamp } = input;
  
  // Use presentation engine projection
  const projection = projectCareUnderstandingConfidence(truth_slice);
  
  // Enhance with baseline data
  let enhanced_clear = [...projection.clear_areas];
  let enhanced_limited = [...projection.limited_areas];
  let enhanced_unknown = [...projection.unknown_areas];
  
  if (baseline_result?.deviations) {
    for (const dev of baseline_result.deviations) {
      if (dev.confidence === "high") {
        enhanced_clear.push({
          area: dev.domain,
          clarity: "clear",
          reliability: "high",
          evidence: [dev.baseline_statement, dev.current_observation],
        });
      } else if (dev.confidence === "medium") {
        enhanced_limited.push({
          area: dev.domain,
          clarity: "limited",
          reliability: "medium",
          evidence: [dev.baseline_statement, dev.current_observation],
          missing_context: `What would confirm: ${dev.what_would_confirm ?? "Clinical evaluation"}`,
          what_would_improve: dev.what_would_confirm,
        });
      } else {
        enhanced_unknown.push({
          area: dev.domain,
          clarity: "unknown",
          reliability: "low",
          evidence: [dev.current_observation],
          missing_context: `Baseline deviation detected: ${dev.deviation_type}`,
          what_would_improve: "Clinical confirmation or longitudinal tracking",
        });
      }
    }
  }
  
  // Build presentation view
  const presentation_view = projectPresentation(truth_slice, { mode: "detailed" });
  
  // Overall confidence label
  const overall_confidence_label = aggregated_confidence 
    ? (aggregated_confidence.label === "high" ? "We understand this well" :
       aggregated_confidence.label === "moderate" ? "We have a reasonable understanding" :
       aggregated_confidence.label === "limited" ? "Our understanding is limited" :
       "We do not understand this well yet")
    : "Building understanding...";
  
  return {
    status: "FUTURE",
    computed_at: timestamp,
    question: "What do we currently understand about this person's care reality?",
    clear_areas: enhanced_clear,
    limited_areas: enhanced_limited,
    unknown_areas: enhanced_unknown,
    caregiver_should_feel: [
      "I know what SolenOS understands.",
      "I know what information is missing.",
      "I know where to focus attention.",
    ],
    caregiver_should_not_feel: [
      "The system is judging me.",
      "I am failing at caregiving.",
    ],
    presentation_view,
    overall_confidence_label,
  };
}

export {
  CARE_UNDERSTANDING_CONFIDENCE_IDENTITY,
  CARE_UNDERSTANDING_CONFIDENCE_PRINCIPLE,
  FORBIDDEN_CONFIDENCE_UI,
  FORBIDDEN_CONFIDENCE_PATTERNS,
  CARE_UNDERSTANDING_FEELINGS,
  UNDERSTANDING_AREA_REQUIREMENTS,
} from "../future-capabilities/care-understanding-confidence";
export type {
  UnderstandingClarityLevel,
  ReliabilityLevel,
  CareUnderstandingArea,
  CareUnderstandingConfidenceView,
} from "../future-capabilities/care-understanding-confidence";