import { CONFIDENCE_AUTO_COMMIT, CONFIDENCE_NEEDS_REVIEW } from "./contract-constants";
import type { ConfidenceTier } from "./types";

export function classifyConfidenceTier(confidence: number): ConfidenceTier {
  if (confidence >= CONFIDENCE_AUTO_COMMIT) return "auto_commit";
  if (confidence >= CONFIDENCE_NEEDS_REVIEW) return "needs_review";
  return "quarantine";
}

export function tierToStatus(tier: ConfidenceTier): "committed" | "needs_review" | "quarantined" | "needs_user_confirmation" {
  switch (tier) {
    case "auto_commit":
      return "committed";
    case "needs_review":
      return "needs_review";
    case "quarantine":
      return "needs_user_confirmation";
  }
}
