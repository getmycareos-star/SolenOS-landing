import {
  NORTH_STAR_TEST,
  NORTH_STAR_TEST_DEFAULT,
  PRODUCT_NORTH_STAR,
} from "./contract-constants";
import type { FeatureNorthStarEvaluation, NorthStarVerdict } from "./types";

const REJECT_FEATURE_PATTERNS = [
  /\bchatbot\b/i,
  /\bask me anything\b/i,
  /\bconversational assistant\b/i,
  /\bdashboard\b/i,
  /\banalytics screen\b/i,
  /\bengagement\b/i,
  /\bgamification\b/i,
  /\banswer engine\b/i,
  /\bsearch engine for caregivers\b/i,
  /\bAI therapist\b/i,
  /\bAI doctor\b/i,
  /\bmedical encyclopedia\b/i,
  /\bsocial feed\b/i,
  /\bmarketplace\b/i,
  /\btraining platform\b/i,
  /\bresource directory\b/i,
  /\btask manager\b/i,
  /\bproductivity (?:tool|app)\b/i,
  /\bdocument (?:summarizer|analyzer)\b/i,
];

const PASS_FEATURE_PATTERNS = [
  /\bcare.?event\b/i,
  /\bcare.?context\b/i,
  /\btimeline\b/i,
  /\bdiff\b/i,
  /\bchange detection\b/i,
  /\bcontradiction\b/i,
  /\bstate of care\b/i,
  /\bexternal memory\b/i,
  /\bcontinuity\b/i,
  /\btrust layer\b/i,
  /\bconfidence\b/i,
  /\bclarification\b/i,
  /\breturn value\b/i,
  /\bevent extraction\b/i,
  /\bevent.?sourced\b/i,
  /\bingestion\b/i,
  /\bprogression\b/i,
  /\bhandoff\b/i,
  /\broutine memory\b/i,
];

/**
 * Mandatory North Star gate.
 * Unclear → reject by default.
 */
export function evaluateFeatureAgainstNorthStar(
  featureDescription: string,
): FeatureNorthStarEvaluation {
  const text = featureDescription.trim();
  if (!text) {
    return {
      feature_description: text,
      verdict: "unclear_rejected",
      reduces_memory_reconstruction: null,
      reason: `${NORTH_STAR_TEST_DEFAULT} Empty feature description.`,
      north_star_test: NORTH_STAR_TEST,
    };
  }

  if (REJECT_FEATURE_PATTERNS.some((p) => p.test(text))) {
    return {
      feature_description: text,
      verdict: "reject",
      reduces_memory_reconstruction: false,
      reason: `Fails North Star: '${PRODUCT_NORTH_STAR}' — feature is answer/chat/dashboard oriented.`,
      north_star_test: NORTH_STAR_TEST,
    };
  }

  if (PASS_FEATURE_PATTERNS.some((p) => p.test(text))) {
    return {
      feature_description: text,
      verdict: "pass",
      reduces_memory_reconstruction: true,
      reason: "Reduces need to reconstruct care journey from memory via continuity machinery.",
      north_star_test: NORTH_STAR_TEST,
    };
  }

  return {
    feature_description: text,
    verdict: "unclear_rejected",
    reduces_memory_reconstruction: null,
    reason: NORTH_STAR_TEST_DEFAULT,
    north_star_test: NORTH_STAR_TEST,
  };
}

export function isNorthStarPass(verdict: NorthStarVerdict): boolean {
  return verdict === "pass";
}
