/**
 * SolenOS Ops Console — event names that answer continuum questions.
 * If a metric does not help answer "is SolenOS becoming external memory?" — do not emit it.
 */

export const OPS_EVENT_NAMES = [
  // Acquisition
  "page_view",
  "signup_started",
  "signup_completed",
  // Core usage
  "care_case_created",
  "input_submitted",
  "document_uploaded",
  "step_completed",
  // Continuity
  "care_record_viewed",
  "appointment_preparation_opened",
  "return_visit",
  // Reliability
  "error_triggered",
] as const;

export type OpsEventName = (typeof OPS_EVENT_NAMES)[number];

export function isOpsEventName(value: string): value is OpsEventName {
  return (OPS_EVENT_NAMES as readonly string[]).includes(value);
}

export const OPS_SESSION_STORAGE_KEY = "solenos_ops_session_id";
export const OPS_USER_STORAGE_KEY = "solenos_telemetry_user_id";
