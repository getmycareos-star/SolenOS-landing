import type { UrgencyDetectionResult } from "../../urgency-detection";
import type { CareContextUrgencyLevel, SituationType } from "./types";

const RISK_TO_URGENCY: Record<
  UrgencyDetectionResult["risk_level"],
  CareContextUrgencyLevel
> = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
  critical: "CRITICAL",
};

/**
 * Map urgency detection into Care Context urgency envelope.
 * Emergency situation type always elevates to CRITICAL.
 */
export function classifyCareContextUrgency(params: {
  urgencyDetection: UrgencyDetectionResult;
  situationType: SituationType;
}): CareContextUrgencyLevel {
  if (params.situationType === "emergency") {
    return "CRITICAL";
  }

  const base = RISK_TO_URGENCY[params.urgencyDetection.risk_level];

  if (params.situationType === "medical_event" && base === "MEDIUM") {
    return "HIGH";
  }

  if (params.situationType === "uncertain_state" && base === "HIGH") {
    return "MEDIUM";
  }

  return base;
}
