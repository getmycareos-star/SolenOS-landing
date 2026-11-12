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
  available: "Available",
  unavailable: "Not available",
  unavailable_schema: "Not available",
  not_authorized: "Not available",
  no_assessments_returned: "Not checked",
  high: "High",
  medium: "Medium",
  low: "Low",
  urgent: "Urgent",
  reported_at: "When the caregiver reported it",
  observed_at: "When it was observed",
  recorded_at: "When it was saved",
  event_time: "When it happened",
  document_date: "Date on the document",
  appointment_date: "Appointment date",
  within_review_window: "Recently reviewed",
  needs_confirmation: "Needs a fresh check",
  historical: "Older information",
  time_bound_observation: "Time-specific information",
  not_assessed: "Not checked",
  preparation: "Before the appointment",
  during_visit: "During the appointment",
  outcome_pending: "Waiting for appointment details",
  ready_for_review: "Ready to review",
  pending_authorization: "Waiting for your review",
  accepted_by_caregiver: "Accepted as a caregiver report",
  rejected_by_caregiver: "Not accepted",
  no_outcome_information: "No appointment details recorded",
  outcome_verified: "Outcome checked",
  failed: "Could not be completed",
  partial: "Partly complete",
  independent: "Reported separately",
  shared_origin: "From the same original source",
  current: "Up to date",
  stale: "May be out of date",
  unknown: "Not checked",
  not_current: "May be out of date",
  pending_review: "Needs your review",
  corrected_pending_approval: "Correction ready for review",
  accepted_by_caregiver: "Added to care record",
  rejected_by_caregiver: "Not added",
  generated: "Prepared",
  validated: "Ready to review",
  exact_quote_reference_validation_passed: "Source wording checked",
  shared: "Shared",
  revoked: "Access removed",
  acknowledged: "Received",
  received: "Received",
  draft: "Draft",
  prepared: "Prepared",
  ready: "Ready",
  verified: "Verified",
  unverified: "Not verified",
  expired: "Expired",
  accepted: "Accepted",
  declined: "Not accepted",
  cancelled: "Cancelled",
  pending: "Waiting for review",
  pending_acceptance: "Waiting for recipient",
  pending_recipients: "Waiting for recipients",
  reviewed: "Reviewed",
  active: "Active",
  blocked: "Not available",
  ineligible: "Not eligible",
  no_eligible_recipients: "No eligible recipients",
  not_applicable: "Not applicable",
  not_recorded: "Not recorded",
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

const ROLE_LABELS: Readonly<Record<string, string>> = {
  caregiver: "Caregiver",
  family_caregiver: "Family caregiver",
  family_member: "Family member",
  care_professional: "Healthcare professional",
  professional: "Healthcare professional",
  healthcare_professional: "Healthcare professional",
  clinician: "Healthcare professional",
  care_recipient: "Person receiving care",
  person_receiving_care: "Person receiving care",
  self: "You",
  other: "Someone else",
  unknown: "Not recorded",
  not_recorded: "Not recorded",
};

export function caregiverRoleLabel(value?: string | null): string | null {
  if (!value) return null;
  return ROLE_LABELS[value.trim().toLowerCase()] ?? null;
}

const TECHNICAL_DIAGNOSTIC_PATTERNS = [
  /database schema/i,
  /\b(?:provenance|reconciliation|assertion|assertions|schema|database|api|json|ocr|freshness|extraction|lineage|algorithm|metadata|pipeline|backend|frontend|checksum|fingerprint)\b/i,
  /\b(?:model inference|inference pipeline|extraction pipeline|source lineage)\b/i,
  /\b(?:epistemic|serialization|normalization|embedding|vector index)\b/i,
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
