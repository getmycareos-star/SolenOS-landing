import type { BeliefItem } from "../types";
import type { StateSituation } from "../types";
import type { ExplanationHealthSummary } from "../types";
import { computeHealthSummary } from "../derived/compute-health";

/**
 * EXPLANATION view — health as derived summary ONLY.
 * Gating is NOT a health "engine"; callers must use computeAutonomyGate
 * (derived from STATE + BELIEF) when safety constraints require it.
 */
export function viewHealthSummary(params: {
  situations: readonly StateSituation[];
  beliefs: readonly BeliefItem[];
}): ExplanationHealthSummary {
  return computeHealthSummary(params.situations, params.beliefs);
}
