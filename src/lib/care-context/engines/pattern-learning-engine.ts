import type { CareContext, PatternObservation } from "../types";

/**
 * Longitudinal pattern authority is the persisted backend change/pattern service.
 *
 * Text-keyword matches across a caregiver timeline do not establish a normalized
 * rate, recurrence, temporal association, observation coverage, or a change in
 * care state. This client engine therefore returns only patterns already
 * attached to the context by an upstream, evidence-backed integration. It does
 * not infer a pattern from prose or treat missing records as negative evidence.
 */
export function detectPatterns(context: CareContext): PatternObservation[] {
  return Array.isArray(context.patterns) ? [...context.patterns] : [];
}
