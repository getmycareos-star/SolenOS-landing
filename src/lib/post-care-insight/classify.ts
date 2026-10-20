import type { InputMode } from "../input-classification";
import { CRITICAL_URGENCY_SIGNALS } from "../urgency-detection/constants";
import type { UrgencyDetectionResult } from "../urgency-detection";
import {
  POST_CARE_LOW_CONFIDENCE_THRESHOLD,
  type CareContextState,
} from "./contract-constants";
import { ACTIVE_CARE_SIGNALS, POST_CARE_SIGNALS } from "./signals";
import type { CareContextStateResult } from "./schema";

function countMatches(text: string, patterns: readonly RegExp[]): number {
  return patterns.filter((pattern) => pattern.test(text)).length;
}

function matchLabels(text: string, patterns: readonly RegExp[]): string[] {
  return patterns.filter((pattern) => pattern.test(text)).map((p) => p.source.slice(0, 40));
}

/**
 * Shallow surface-signal classifier for care_context_state — NOT an emotional engine.
 * Order: crisis → post_care → active_care → uncertain.
 */
export function classifyCareContextState(params: {
  input: string;
  inputMode: InputMode;
  urgencyDetection: UrgencyDetectionResult;
}): CareContextStateResult & { confidence: number; matched_signals: string[] } {
  const text = params.input.trim();

  if (
    params.inputMode === "crisis_urgent" ||
    params.urgencyDetection.risk_level === "critical" ||
    countMatches(text, CRITICAL_URGENCY_SIGNALS) > 0
  ) {
    return {
      care_context_state: "crisis",
      confidence: 0.92,
      matched_signals: ["crisis_urgent_or_critical"],
    };
  }

  const postCareMatches = matchLabels(text, POST_CARE_SIGNALS);
  if (postCareMatches.length > 0) {
    const confidence = postCareMatches.length >= 2 ? 0.9 : 0.78;
    return {
      care_context_state: "post_care",
      confidence,
      matched_signals: postCareMatches,
    };
  }

  const activeCareMatches = matchLabels(text, ACTIVE_CARE_SIGNALS);
  if (activeCareMatches.length > 0) {
    const confidence = activeCareMatches.length >= 2 ? 0.85 : 0.68;
    return {
      care_context_state: "active_care",
      confidence,
      matched_signals: activeCareMatches,
    };
  }

  return {
    care_context_state: "uncertain" satisfies CareContextState,
    confidence: POST_CARE_LOW_CONFIDENCE_THRESHOLD - 0.1,
    matched_signals: [],
  };
}
