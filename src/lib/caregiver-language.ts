/**
 * Caregiver-safe presentation helpers.
 *
 * Backend enums and exception messages are internal values. Unknown values are
 * deliberately omitted or replaced with a neutral message; never prettified.
 */

const STATUS_LABELS: Readonly<Record<string, string>> = {
  active: "In progress",
  approved: "Approved",
  completed: "Completed",
  cancelled: "Cancelled",
  deferred: "Put off for now",
  needs_clarification: "Needs clarification",
  pending: "Awaiting review",
  open: "Still open",
  resolved: "Resolved",
  closed: "Closed",
  reported: "Caregiver report",
  observed: "Direct observation",
  verified: "Verified",
  inferred: "Not yet confirmed",
  uncertain: "Unclear",
  conflicting: "Reports differ",
  missing: "Not recorded",
  not_recorded: "Not recorded",
  given: "Reported as given",
  not_given: "Reported as not given",
  refused: "Reported as refused",
  missed: "Reported as missed",
  scheduled: "Scheduled; not confirmed",
  expired: "Expired",
  rejected: "Not accepted",
  suspended: "Temporarily unavailable",
};

const INFORMATION_LABELS: Readonly<Record<string, string>> = {
  reported: "Caregiver report",
  observed: "Direct observation",
  verified: "Verified",
  inferred: "Not yet confirmed",
  uncertain: "Unclear",
  conflicting: "Reports differ",
  missing: "Not recorded",
};

export function caregiverStatusLabel(value?: string | null): string | null {
  if (!value) return null;
  return STATUS_LABELS[value.trim().toLowerCase()] ?? null;
}

export function caregiverInformationLabel(value?: string | null): string | null {
  if (!value) return null;
  return INFORMATION_LABELS[value.trim().toLowerCase()] ?? null;
}

const TECHNICAL_DIAGNOSTIC_PATTERNS = [
  /database schema/i,
  /schema (?:is )?unavailable/i,
  /sql(?:ite|alchemy)?\b/i,
  /\b(?:postgres(?:ql)?|mysql)\b/i,
  /\b(?:stack trace|traceback|exception|internal server error)\b/i,
  /\b(?:http|status)\s*\d{3}\b/i,
  /\b(?:sha-?256|uuid|primary key|foreign key)\b/i,
  /\b(?:endpoint|payload|request id|response body)\b/i,
  /\b(?:migration|column|table) (?:missing|does not exist|not found)/i,
  /\b(?:freshness assessment storage|persisted change assessment)\b/i,
];

export function isTechnicalDiagnosticText(value: string): boolean {
  return TECHNICAL_DIAGNOSTIC_PATTERNS.some((pattern) => pattern.test(value));
}

/** Return null for technical diagnostics so callers can show a safe fallback. */
export function caregiverSafeAssistantText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || isTechnicalDiagnosticText(text)) return null;
  return text;
}

export function caregiverSafeErrorMessage(): string {
  return "SolenOS couldn’t complete that step. Check your connection and try again. If you were saving information, check whether it appears before trying again.";
}
