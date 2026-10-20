/** Conflict Detection Engine — flags contradictions; reduces confidence / triggers re-eval. */

export const CONFLICT_DETECTION_LAYER_IDENTITY =
  "a contradiction evaluation layer that asks whether facts can coexist — never silently picks a winning truth";

export const CONFLICT_DETECTION_LAYER_ONE_LINE_TRUTH =
  "Conflicts reduce Belief confidence and request clarification / re-evaluation — they are operational state, not a fourth persistent truth layer.";

export const CONFLICT_DETECTION_LAYER_PIPELINE_POSITION =
  "CONFLICT DETECTION — after Context / Memory; before Belief influence application, Priority, and Decision. Validates coexistence; does not resolve by choosing winners.";

export const CONFLICT_DETECTION_LAYER_FORBIDDEN = [
  "silently pick a winning truth",
  "delete conflicting memory or assumptions",
  "merge Timeline WHAT with Decision History WHY",
  "show caregivers a raw conflict count dump (e.g. 17 conflicts detected)",
  "MVP: conflict clustering, automatic reconciliation, source reliability scoring tables",
  // Clinical-vs-memory preference for orientation is Input Reality (keep both; never silent winner).
] as const;

export const CONFLICT_TYPES = [
  "fact_conflict",
  "responsibility_conflict",
  "preference_conflict",
  "timeline_conflict",
  "medical_conflict",
] as const;

export const CONFLICT_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export const CONFLICT_STATUSES = ["open", "resolved", "ignored"] as const;

/** Severity → soft confidence reduction applied while open. */
export const CONFLICT_SEVERITY_CONFIDENCE_REDUCTION = {
  LOW: 0,
  MEDIUM: 0.08,
  HIGH: 0.18,
  CRITICAL: 0.35,
} as const;

/** Cap on stacked open-conflict confidence penalty. */
export const CONFLICT_CONFIDENCE_PENALTY_CAP = 0.55;

/** Per open conflict toward Caregiver Load conflictLoad (0–100 scale). */
export const CONFLICT_LOAD_PER_OPEN = 18;
export const CONFLICT_LOAD_PER_CRITICAL = 28;
export const CONFLICT_LOAD_CAP = 100;

export const CONFLICT_CLARIFICATION_HEADLINE =
  "Important clarification needed" as const;
