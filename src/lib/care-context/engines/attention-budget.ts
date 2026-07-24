import type { CareContext, CaregiverLoadAssessment } from "../types";

/**
 * Attention Budget — limits what demands caregiver attention at once.
 * Eliminates failure: decision overload + cognitive overload.
 */
export interface AttentionBudget {
  /** Max items requiring immediate attention. */
  maxImmediate: number;
  immediate: string[];
  deferred: string[];
  rationale: string;
}

export function computeAttentionBudget(
  context: CareContext,
  load?: CaregiverLoadAssessment,
): AttentionBudget {
  const maxImmediate = load?.level === "critical" ? 2 : load?.level === "high" ? 3 : 5;

  const candidates = [
    ...context.prioritizedActions
      .filter((a) => a.urgency === "now" || a.urgency === "soon")
      .map((a) => a.action),
    ...context.recentChanges.slice(-5).map((c) => c.description),
  ];

  const unique = [...new Set(candidates)];
  const immediate = unique.slice(0, maxImmediate);
  const deferred = unique.slice(maxImmediate);

  return {
    maxImmediate,
    immediate,
    deferred,
    rationale:
      deferred.length > 0
        ? "Remaining items deferred to reduce cognitive overload — not forgotten."
        : "All current items fit within attention budget.",
  };
}
