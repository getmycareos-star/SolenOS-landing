/** Failure modes & resilience — graceful degradation preserves trust. */

export const FAILURE_RESILIENCE_IDENTITY =
  "Failure is not the opposite of continuity. Losing information is.";

export const FAILURE_OUTCOMES = ["clarify", "preserve_raw", "defer"] as const;

export const FAILURE_CATEGORIES = [
  "extraction_failure",
  "incomplete_context",
  "ambiguous_interpretation",
  "graph_linking_failure",
  "conflicting_information",
  "processing_failure",
] as const;

export const PROCESSING_STATUSES = [
  "complete",
  "partial",
  "pending",
  "deferred",
  "failed_recoverable",
] as const;

export const VERIFICATION_STATUSES = [
  "unverified",
  "needs_confirmation",
  "user_confirmed",
  "rejected",
] as const;

export const RELATIONSHIP_STATUSES = [
  "resolved",
  "unresolved",
  "independent",
  "deferred",
] as const;

export const MAX_CLARIFICATION_QUESTIONS = 3;
export const MAX_RETRY_ATTEMPTS = 3;
export const RETRY_BACKOFF_MS = 5000;
