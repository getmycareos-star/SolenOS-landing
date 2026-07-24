import {
  CONTEXTUAL_THRESHOLD,
  CRITICAL_THRESHOLD,
  IMPORTANT_THRESHOLD,
  PRIORITY_WEIGHTS,
} from "./contract-constants";
import type { CareEventPriorityInput, PriorityTier } from "./types";

/**
 * Core priority score — ONLY allowed computation (spec §2).
 * S = 0.35*U + 0.25*X + 0.25*D + 0.15*T
 */
export function computePriority(event: CareEventPriorityInput): number {
  const U = event.urgency;
  const X = event.uncertainty;
  const D = Math.min(event.dependency_count * 10, 100);
  const T = Math.max(0, 100 - event.recency_days * 5);

  const S =
    PRIORITY_WEIGHTS.urgency * U +
    PRIORITY_WEIGHTS.uncertainty * X +
    PRIORITY_WEIGHTS.dependency * D +
    PRIORITY_WEIGHTS.recency * T;

  return Math.round(S);
}

export function classifyPriorityTier(score: number): PriorityTier {
  if (score >= CRITICAL_THRESHOLD) return "CRITICAL";
  if (score >= IMPORTANT_THRESHOLD) return "IMPORTANT";
  if (score >= CONTEXTUAL_THRESHOLD) return "CONTEXTUAL";
  return "BACKGROUND";
}

export function isAttentionWorthy(score: number): boolean {
  return score >= CRITICAL_THRESHOLD;
}
