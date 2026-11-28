/**
 * Caregiver-safe presentation helpers.
 *
 * Backend enums and exception messages are internal values. Unknown values are
 * deliberately omitted or replaced with a neutral message; never prettified.
 */

const STATUS_LABELS: Readonly<Record<string, string>> = {
  created: "Follow-up added",
  updated: "Follow-up updated",
  response_recorded: "Response recorded",
  action_recorded: "Action recorded",
  contradiction_reconciled: "Different reports reviewed",
  outcome_reported: "Outcome reported",
  outcome_unknown: "Outcome not recorded",
  outcome_attested: "Outcome checked by caregiver",
  outcome_corroborated: "Checked against another report",
  closure_verified: "Marked as complete",
  reopened: "Reopened",
  reassessed: "Follow-up reviewed",
  active: "Active",
  new: "New",
  worsened: "May be getting worse",
  improved: "May be improving",
  approved: "Approved",
  completed: "Completed",
  cancelled: "Cancelled",
  deferred: "Waiting before deciding",
  needs_clarification: "Needs checking",
  pending: "Waiting for review",
  open: "Open",
  unresolved: "Still needs attention",
  partially_resolved: "Partly complete",
  qualified: "Some details still need checking",
  resolved: "Resolved",
  closed: "Closed after review",
  reported: "Reported by caregiver",
  caregiver_reported_at: "Time reported by caregiver",
  caregiver_reported: "Time reported by caregiver",
  caregiver_observed: "Time observed by caregiver",
  caregiver_entered: "Time entered by caregiver",
  caregiver_recorded: "Time recorded by caregiver",
  reported_by_caregiver: "Time reported by caregiver",
  server_recorded_at: "No event time was provided; SolenOS used the time it received this update",
  entry_time_defaulted: "No event time was provided; SolenOS used the time it received this update",
  document_date: "Date shown on the document",
  extracted_discharge: "Time taken from discharge paperwork",
  imported_document: "Time taken from an imported document",
  observed_at_from_source_assertions: "Time taken from saved observations",
  observed_at_from_source_bound_numeric_observations: "Time taken from saved measurements",
  observed: "Seen by a caregiver",
  verified: "Checked against another note or report",
  inferred: "Possible explanation",
  uncertain: "Not sure yet",
  conflicting: "Reports do not match",
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
  follow_up_candidate: "Possible follow-up",
  followup_candidate: "Possible follow-up",
  candidate: "Possible follow-up",
  potential_worsening: "May be getting worse",
  potential_improvement: "May be improving",
  potential_resolution: "May no longer be happening",
  recurring: "Happening again",
  confirmed: "Marked as confirmed by a caregiver",
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
  insufficient_evidence: "Not enough information to tell",
  increasing: "Increasing",
  decreasing: "Decreasing",
  stable: "No change recorded",
  fluctuating: "Changing over time",
  weak: "Limited information",
  moderate: "Some repeated information",
  strong: "Repeated information",
  daily_care: "Daily Care",
  structured_daily_capture: "Daily care update",
  daily_care_entry: "Daily care update",
  daily_capture: "Daily care update",
  ai_companion: "Care Assistant",
  companion: "Care Assistant",
  caregiver: "Caregiver",
  family_caregiver: "Family caregiver",
  care_professional: "Healthcare professional",
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
  appointment_date: "Appointment date",
  disputed: "Reports differ",
  retracted: "Withdrawn",
  superseded: "Replaced by newer information",
  waiting: "Waiting",
  in_progress: "In progress",
  waiting_for_information: "Waiting for information",
  waiting_for_action: "Waiting for someone to act",
  awaiting_response: "Waiting for a response",
  professional_input: "Waiting for input from a healthcare professional",
  unconfirmed_outcome: "Waiting to confirm the result",
  pending_action: "Waiting for someone to act",
  follow_up: "Needs follow-up",
  pending_decision: "Waiting for a decision",
  pending_closure_verification: "Waiting to confirm completion",
  needs_attention: "Needs attention",
  needs_attention_now: "Needs attention now",
  being_monitored: "Being monitored",
  no_longer_relevant: "No longer relevant",
  not_started: "Not started",
  blocked: "Waiting for another step",
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
  shared_origin: "From the same original",
  same_origin: "From the same original",
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
  exact_quote_reference_validation_passed: "Original wording checked",
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
  observed: "Seen by a caregiver",
  verified: "Checked against another note or report",
  inferred: "Possible explanation",
  uncertain: "Not sure yet",
  conflicting: "Reports do not match",
  missing: "Not recorded",
};

const CARE_FIELD_LABELS: Readonly<Record<string, string>> = {
  medication_name: "Medication name as reported",
  name: "Name as reported",
  dose: "Dose as reported",
  strength: "Strength as reported",
  medication_status: "Medication status as reported",
  status: "Status as reported",
  vitamin_c: "Vitamin C",
  poor_sleep: "Sleep",
  sleep: "Sleep",
  appetite: "Appetite",
  mobility: "Movement",
  pain: "Pain",
  mood: "Mood",
  blood_pressure: "Blood pressure",
  blood_pressure_systolic: "Blood pressure (top number)",
  blood_pressure_diastolic: "Blood pressure (bottom number)",
  oxygen_saturation: "Oxygen level",
  heart_rate: "Heart rate",
  caregiver_note: "Caregiver note",
  caregiver_reported_observation: "Caregiver report",
  reported_weight_change: "Weight change reported",
  medication: "Medication",
  hydration: "Fluid intake",
  food_intake: "Food intake",
};

const CARE_INFORMATION_AREA_LABELS: Readonly<Record<string, string>> = {
  facts: "Saved care details",
  care_facts: "Saved care details",
  events: "Care updates",
  daily_care: "Daily Care updates",
  daily_logs: "Daily Care updates",
  care_events: "Care updates",
  appointments: "Appointments",
  assertions: "Caregiver reports",
  care_assertions: "Caregiver reports",
  open_questions: "Questions to answer",
  open_loop_records: "Follow-ups",
  information_gaps: "Details not yet recorded",
  uncertainty_assessments: "Details that still need checking",
  contradictions: "Reports that do not match",
  conflicts: "Reports that do not match",
  reconciliations: "Reports checked against each other",
  evidence_freshness_assessments: "How recent the information is",
  medications_and_allergies: "Medicines and allergies",
  documents: "Documents",
  evidence: "Notes and documents",
  document_evidence: "Documents",
  caregiver_observations: "What a caregiver noticed",
  caregiver_reports: "Caregiver reports",
  professional_reports: "Information from healthcare professionals",
  caregiver_perspectives: "What caregivers shared",
  decisions: "Care decisions",
  decision_outcomes: "What happened after a decision",
  handoffs: "Care information shared with another caregiver",
};

export function caregiverInformationAreaLabel(value?: string | null): string | null {
  if (!value) return null;
  const key = value.trim().toLowerCase();
  return CARE_INFORMATION_AREA_LABELS[key] ?? caregiverProductTermLabel(key);
}

/** Human-readable labels for saved care fields; unknown keys are not prettified. */
export function caregiverFieldLabel(value?: string | null): string | null {
  if (!value) return null;
  const key = value.trim().toLowerCase();
  return CARE_FIELD_LABELS[key] ?? caregiverProductTermLabel(key);
}

export function caregiverStatusLabel(value?: string | null): string | null {
  if (!value) return null;
  return STATUS_LABELS[value.trim().toLowerCase()] ?? null;
}

/** Labels caregiver-confirmed situation states without presenting them as clinical conclusions. */
export function caregiverSituationStateLabel(value?: string | null): string | null {
  switch (value?.trim().toLowerCase()) {
    case "active": return "Active";
    case "worsening": return "Caregiver reports worsening";
    case "improving": return "Caregiver reports improvement";
    case "resolved": return "Resolved";
    case "unknown": return "Needs more information";
    case "evolved": return "Earlier situation";
    default: return null;
  }
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

const CAREGIVER_PRODUCT_TERMS: Readonly<Record<string, string>> = {
  "living care record": "Care Record", lcr: "Care Record",
  "care continuity": "Keeping care information together",
  reconciliation: "Updating your care information",
  provenance: "Where this information came from",
  evidence: "Related notes and documents",
  "delta engine": "Changes since your last visit", delta_engine: "Changes since your last visit",
  retrieval: "Finding earlier care information",
  "open loops": "Things that still need attention", open_loops: "Things that still need attention",
  "longitudinal history": "Care history over time", longitudinal_history: "Care history over time",
  "ai companion": "Ask SolenOS", ai_companion: "Ask SolenOS",
  "epistemic status": "What is known, what is unclear, or not recorded",
  assessment_coverage: "What information was checked",
  "source attribution": "Who shared this information",
};
export function caregiverProductTermLabel(value?: string | null): string | null {
  if (!value) return null;
  return CAREGIVER_PRODUCT_TERMS[value.trim().toLowerCase()] ?? null;
}

const TECHNICAL_DIAGNOSTIC_PATTERNS = [
  /\b(?:LCR|Delta Engine|AI Companion|Qwen)\b/i,
  /database schema/i,
  /\b(?:provenance|reconciliation|assertion|assertions|schema|database|api|json|ocr|freshness|lineage|algorithm|metadata|pipeline|backend|frontend|checksum|fingerprint)\b/i,
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
/**
 * Preserve caregiver-authored notes and original source text exactly.
 * Use only for user-provided or source-document content, never generated AI copy
 * or backend diagnostics. React renders the returned string as escaped text.
 */
export function caregiverSourceText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.trim() ? value : null;
}

export function caregiverSafeAssistantText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || isTechnicalDiagnosticText(text)) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object") return null;
    if (typeof parsed === "string") {
      const parsedText = parsed.trim();
      if (!parsedText || isTechnicalDiagnosticText(parsedText)) return null;
      return parsedText;
    }
    // Booleans and null are serialized values, not caregiver-facing prose.
    // Keep numeric-only notes readable because they may be real care measurements.
    if (typeof parsed === "boolean" || parsed === null) return null;
  } catch {
    // Ordinary caregiver text is not required to be valid JSON.
  }
  return text;
}

/** Apply a stricter vocabulary boundary to text generated by SolenOS, not original caregiver wording. */
const CAREGIVER_GENERATED_INTERNAL_LANGUAGE = /\b(?:epistemic(?: status)?|provenance|reconciliation(?: review)?|assertion(?:s)?(?: record| candidate| payload)?|schema|database|backend|frontend|endpoint|payload|telemetry|inference(?: pipeline)?|retrieval(?: result| pipeline)?|extraction pipeline|lineage|pipeline|migration|idempotent|persistence layer|postgres(?:ql)?|sqlite|qwen|companion|fastapi|sqlalchemy|alembic|tika|tesseract|lcr|delta engine|open loops|diagnostic (?:payload|schema|pipeline|trace|log|output)|metadata|audit trail|api|json|ocr|checksum|fingerprint|uuid|http|(?:evidence|source|record)(?:[_ ]id)|(?:person|caregiver|document|appointment|handoff|analysis|workflow|event|upload|job|trace|run)(?:[_ ]id)|generation[_ ]status|epistemic[_ ]state|information[_ ]status|retrieval[_ ](?:scan|projection)[_ ]complete|candidate[_ ]scan[_ ]complete|missing[_ ]required[_ ]sources|selection[_ ]truncated|(?:awaiting|pending|processing|failed|unavailable|partial|rejected|accepted|verified|unverified|conflicting|missing|withdrawn|superseded)_[a-z0-9_]+|(?:evidence|source|record) (?:payload|schema|projection|candidate|reference|lineage|review|assessment|completeness|freshness|retrieval|pipeline|chain)|claim (?:assessment|provenance|candidate|id)|candidate projection|longitudinal|corroborat(?:e|ion|ed|ing)|triangulat(?:e|ion)|baseline comparison|observation window|ai interpretation|ai-generated|ai-assisted|anonymous session|care session|session token|assessment coverage|confidence (?:scores?|levels?|thresholds?)|hash(?:es)?|system prompt|model instructions?|hidden reasoning|internal reasoning|internal processing|raw statuses?|machine-readable metadata|(?:low|high|moderate|medium) confidence|technical (?:details|diagnostic|diagnostics|error)|data integrity|stored workflow status|truth judgment|independent truth)\b/i;

/** Apply a stricter vocabulary boundary to text generated by SolenOS, not original caregiver wording. */
export function caregiverSafeGeneratedText(value: unknown): string | null {
  const text = caregiverSafeAssistantText(value);
  if (!text) return null;
  return CAREGIVER_GENERATED_INTERNAL_LANGUAGE.test(text) ? null : text;
}

/**
 * Change explanations are generated from internal comparison fields. Do not
 * expose engine identifiers or observation-coverage jargon in caregiver UI.
 * Return null so the caller can use a plain-language, evidence-bounded fallback.
 */
/**
 * Turn a saved Daily Care capture into readable caregiver text.
 * Only known care fields are displayed; internal request keys and serialized
 * implementation metadata are never shown as source wording.
 */
export function caregiverReadableCaptureText(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const fallback = "Saved care information";
  const safeText = (item: unknown): string => {
    if (typeof item === "string") return caregiverSafeAssistantText(item.trim()) || "";
    if (typeof item === "number" && Number.isFinite(item)) return String(item);
    return "";
  };
  const sourceText = (item: unknown): string => {
    if (typeof item === "number" && Number.isFinite(item)) return String(item);
    return caregiverSourceText(item) || "";
  };
  const readableLabel = (item: unknown): string => {
    const raw = safeText(item);
    if (!raw) return "";
    return caregiverFieldLabel(raw) || caregiverStatusLabel(raw) || caregiverInformationAreaLabel(raw) || (raw.includes("_") || isTechnicalDiagnosticText(raw) ? "" : raw);
  };
  try {
    const trimmedValue = value.trim();
    const capturePayload = trimmedValue.replace(
      /^(?:structured daily capture|daily care capture|daily care update|quick check-in)\s*[—:-]\s*/i,
      "",
    );
    const parsed: unknown = JSON.parse(capturePayload);
    if (typeof parsed === "string") return sourceText(parsed) || fallback;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fallback;
    const root = parsed as Record<string, unknown>;
    const capture = root.original_capture && typeof root.original_capture === "object" && !Array.isArray(root.original_capture)
      ? root.original_capture as Record<string, unknown>
      : root;
    const lines: string[] = [];
    const vitalLabels: Record<string, string> = {
      bp_systolic: "Blood pressure (top number)",
      bp_diastolic: "Blood pressure (bottom number)",
      heart_rate: "Heart rate",
      temperature: "Temperature",
      oxygen_saturation: "Oxygen level",
      weight: "Weight",
    };
    if (typeof capture.axis === "string" && capture.score !== undefined) {
      const label = readableLabel(capture.axis) || "Rating";
      const score = safeText(capture.score);
      const note = sourceText(capture.note);
      if (score || note) lines.push([label + (score ? ": " + score : ""), note].filter(Boolean).join(" — "));
    }
    if (typeof capture.vital_type === "string" && capture.value !== undefined) {
      const kind = safeText(capture.vital_type);
      const label = vitalLabels[kind] || readableLabel(kind) || "Measurement";
      const measurement = [sourceText(capture.value), sourceText(capture.unit)].filter(Boolean).join(" ");
      const note = sourceText(capture.note);
      if (measurement || note) lines.push([label + (measurement ? ": " + measurement : ""), note].filter(Boolean).join(" — "));
    }
    if (typeof capture.medication_name === "string" || typeof capture.name === "string") {
      const name = sourceText(capture.medication_name) || sourceText(capture.name);
      const details = [
        sourceText(capture.dose) ? "Dose recorded: " + sourceText(capture.dose) : "",
        safeText(capture.status) ? "Status: " + readableLabel(capture.status) : "",
        sourceText(capture.note),
      ].filter(Boolean);
      if (name) lines.push(details.length ? name + " — " + details.join("; ") : name);
    }
    const quick = capture.quick_check_in && typeof capture.quick_check_in === "object" && !Array.isArray(capture.quick_check_in)
      ? capture.quick_check_in as Record<string, unknown>
      : null;
    const quickLabels: Record<string, string> = {
      same_as_usual: "About the same as usual",
      change: "Something changed",
      concern: "A concern was reported",
      care_completed: "Care was reported as completed",
      uncertain: "The caregiver was unsure",
    };
    if (quick) {
      lines.push(quickLabels[String(quick.kind)] || "Caregiver check-in recorded");
      const areas = Array.isArray(quick.selected_areas)
        ? quick.selected_areas.map(readableLabel).filter(Boolean)
        : [];
      if (areas.length) lines.push("Areas mentioned: " + areas.join(", "));
    }
    for (const key of ["notes", "original_notes", "text", "description", "observation", "summary"]) {
      const safe = sourceText(capture[key]);
      if (safe && !lines.includes(safe)) lines.push(safe);
    }
    if (Array.isArray(capture.scales)) {
      for (const raw of capture.scales) {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
        const scale = raw as Record<string, unknown>;
        const label = readableLabel(scale.axis) || "Rating";
        const score = safeText(scale.score);
        const note = sourceText(scale.note);
        if (score || note) lines.push([label + (score ? ": " + score : ""), note].filter(Boolean).join(" — "));
      }
    }
    if (Array.isArray(capture.vitals)) {
      for (const raw of capture.vitals) {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
        const vital = raw as Record<string, unknown>;
        const kind = safeText(vital.vital_type);
        const label = vitalLabels[kind] || readableLabel(kind) || "Measurement";
        const measurement = [sourceText(vital.value), sourceText(vital.unit)].filter(Boolean).join(" ");
        const note = sourceText(vital.note);
        if (measurement || note) lines.push([label + (measurement ? ": " + measurement : ""), note].filter(Boolean).join(" — "));
      }
    }
    if (Array.isArray(capture.medications)) {
      for (const raw of capture.medications) {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
        const medicine = raw as Record<string, unknown>;
        const name = sourceText(medicine.medication_name) || "Medicine";
        const details = [
          sourceText(medicine.dose) ? "Dose recorded: " + sourceText(medicine.dose) : "",
          safeText(medicine.status) ? "Status: " + readableLabel(medicine.status) : "",
          sourceText(medicine.note),
        ].filter(Boolean);
        lines.push(details.length ? name + " — " + details.join("; ") : name);
      }
    }
    if (!lines.length) return fallback;
    if (["medications", "vitals", "scales"].some((key) => Array.isArray(capture[key]) && (capture[key] as unknown[]).length > 0)) {
      lines.push("Measurements and ratings are shown as entered; they have not been independently checked.");
    }
    return lines.join("\n");
  } catch {
    const trimmed = value.trimStart();
    return trimmed.startsWith("{") || trimmed.startsWith("[")
      ? fallback
      : caregiverSourceText(value) || fallback;
  }
}

export function caregiverSafeChangeText(value: unknown): string | null {
  const text = caregiverSafeAssistantText(value);
  if (!text) return null;
  const containsInternalIdentifier = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/.test(text);
  const containsEngineLanguage = /\b(?:baseline observation coverage|observation window|comparable prior events|current observation window|not a claim about onset|event\(s\)|source record refs?)\b/i.test(text);
  return containsInternalIdentifier || containsEngineLanguage ? null : text;
}

/**
 * Translate HTTP failures before their messages can enter caregiver UI.
 * Raw response details remain available on ApiResponseError.detail for narrow
 * programmatic conflict handling, but are never copied into Error.message.
 */
export function caregiverSafeApiErrorMessage(status: number, error?: unknown): string {
  if (error && typeof error === "object" && !Array.isArray(error)) {
    const candidate = error as Record<string, unknown>;
    const message = candidate.user_message ?? candidate.caregiver_message;
    if (typeof message === "string") {
      return caregiverSafeGeneratedText(message) || caregiverSafeErrorMessage();
    }
  }

  switch (status) {
    case 401: return "Your session has expired. Please sign in again.";
    case 403: return "You don't have permission to view this information.";
    case 404: return "We couldn't find that information.";
    case 409: return "This information has changed. Refresh and review the latest details before trying again.";
    case 422: return "Please check the information and try again.";
    case 429: return "Please wait a moment and try again.";
    case 503: return "This service is temporarily unavailable. Please try again shortly.";
    default: return status >= 500
      ? "We couldn't complete that request right now. Please try again."
      : "We couldn't complete that request. Please try again.";
  }
}

const CAREGIVER_SAFE_ERROR_FALLBACK = "SolenOS couldn’t complete that step. Check your connection and try again. If you were saving information, check whether it appears before trying again.";

/**
 * Translate an API/client failure into caregiver-safe wording.
 *
 * The API contract and original error remain untouched for callers and
 * diagnostics. Only a deliberately narrow, already-human-readable message may
 * cross this presentation boundary; structured error objects and technical
 * diagnostics always receive the neutral fallback.
 */
export function caregiverSafeErrorMessage(error?: unknown): string {
  if (error && typeof error === "object" && !Array.isArray(error)) {
    const candidate = error as Record<string, unknown>;
    // Only an explicitly designated presentation field may cross this boundary.
    // Raw strings, Error.message, API detail, response objects, IDs and statuses
    // are diagnostic inputs and must never be guessed to be caregiver copy.
    const message = candidate.user_message ?? candidate.caregiver_message;
    if (typeof message === "string") {
      return caregiverSafeGeneratedText(message) || CAREGIVER_SAFE_ERROR_FALLBACK;
    }
  }
  return CAREGIVER_SAFE_ERROR_FALLBACK;
}