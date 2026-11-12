/**
 * Caregiver-safe presentation helpers.
 *
 * Backend enums and exception messages are internal values. Unknown values are
 * deliberately omitted or replaced with a neutral message; never prettified.
 */

const STATUS_LABELS: Readonly<Record<string, string>> = {
  active: "Active",
  approved: "Approved",
  completed: "Completed",
  cancelled: "Cancelled",
  deferred: "Waiting before deciding",
  needs_clarification: "Needs clarification",
  pending: "Waiting for review",
  open: "Open",
  resolved: "Resolved",
  closed: "Closed after review",
  reported: "Reported by caregiver",
  observed: "Observed",
  verified: "Verified",
  inferred: "Possible interpretation",
  uncertain: "Not confirmed",
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
  awaiting_confirmation: "Needs review",
  detected: "Possible change",
  confirmed: "Reviewed and confirmed by a caregiver",
  inconclusive: "Could not be confirmed",
  accepted_by_caregiver: "Added to care record",
  rejected_by_caregiver: "Not added",
  emergence: "First noticed in saved information",
  onset: "First reported",
  cessation: "No longer reported",
  increase: "Reported more often",
  decrease: "Reported less often",
  transition: "Changed",
  persistence: "Continued over time",
  fluctuation: "Changed over time",
  stabilization: "More steady over time",
  recovery: "Reported as improving",
  disappearance: "No longer recorded",
  trend: "Change over time",
  acceleration: "Changing faster",
  clustering: "Several events close together",
  instability: "Changes over time",
  deviation: "Different from usual",
  convergence: "Similar changes in different areas",
  divergence: "Different changes in different areas",
  meaningful_candidate: "May be important",
  not_meaningful: "No clear importance found",
  insufficient_evidence: "Not enough information to judge",
  increasing: "Increasing",
  decreasing: "Decreasing",
  stable: "No change recorded",
  fluctuating: "Changing over time",
  weak: "Limited information",
  moderate: "Some repeated information",
  strong: "Repeated information",
  daily_care: "Daily care",
  care_recipient: "Person receiving care",
  medication: "Medication",
  mobility: "Movement",
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
  disputed: "Reports differ",
  retracted: "Withdrawn",
  superseded: "Replaced by newer information",
  waiting: "Waiting",
  blocked: "Not available",
  review_abandoned: "Needs another look",
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
  no_outcome_information: "No appointment details recorded",
  outcome_verified: "Outcome checked",
  failed: "Could not be completed",
  partial: "Partly complete",
  independent: "Reported separately",
  shared_origin: "From the same original source",
  same_origin: "From the same original source",
  needs_review: "Needs your review",
  awaiting_review: "Needs your review",
  in_review: "Under review",
  ready_to_review: "Ready for review",
  pending_approval: "Waiting for approval",
  not_confirmed: "Not confirmed",
  not_verified: "Not verified",
  current: "Up to date",
  stale: "May be out of date",
  unknown: "Not checked",
  not_current: "May be out of date",
  pending_review: "Needs your review",
  corrected_pending_approval: "Correction ready for review",
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
  unverified: "Not verified",
  accepted: "Accepted",
  declined: "Not accepted",
  pending_acceptance: "Waiting for recipient",
  pending_recipients: "Waiting for recipients",
  reviewed: "Reviewed",
  ineligible: "Not eligible",
  no_eligible_recipients: "No eligible recipients",
  not_applicable: "Not applicable",
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
  /\b(?:source|evidence|record|claim|assessment|person|caregiver)[ _-]?id\s*[:=]\s*[a-z0-9_-]+/i,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
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
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object") return null;
    if (typeof parsed === "string") return parsed.trim() || null;
    // Booleans and null are serialized values, not caregiver-facing prose.
    // Keep numeric-only notes readable because they may be real care measurements.
    if (typeof parsed === "boolean" || parsed === null) return null;
  } catch {
    // Ordinary caregiver text is not required to be valid JSON.
  }
  return text;
}

export function caregiverSafeErrorMessage(): string {
  return "SolenOS couldn’t complete that step. Check your connection and try again. If you were saving information, check whether it appears before trying again.";
}