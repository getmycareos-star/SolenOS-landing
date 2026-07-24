import {
  CURRENT_STATE_VIEW_DEFINING_PRINCIPLE,
  CURRENT_STATE_VIEW_RULES,
} from "./contract-constants";
import type {
  CurrentStateAlert,
  CurrentStateView,
  CurrentStateViewResult,
  ProcessCurrentStateViewInput,
} from "./types";

function buildAlerts(input: ProcessCurrentStateViewInput): CurrentStateAlert[] {
  const alerts: CurrentStateAlert[] = [];

  for (const conflict of input.care_truth.conflicts.filter((c) => c.status === "unresolved")) {
    alerts.push({
      alert_id: `alert_${conflict.conflict_id}`,
      message: conflict.shared_message,
      severity: "high",
      source_event_id: conflict.related_events[0] ?? null,
    });
  }

  for (const event of input.care_record.patient_state.recent_events) {
    if (event.type === "symptom_reported" && event.confidence >= 0.65) {
      alerts.push({
        alert_id: `alert_${event.id}`,
        message: event.abstract_label,
        severity: "medium",
        source_event_id: event.id,
      });
    }
  }

  return alerts.slice(0, 5);
}

export function processCurrentStateView(
  input: ProcessCurrentStateViewInput,
): CurrentStateViewResult {
  const timestamp = input.as_of ?? new Date().toISOString();
  const recent = input.care_record.patient_state.recent_events;

  const snapshot_summary =
    input.what_matters_most ??
    (recent[recent.length - 1]?.abstract_label ?? "Care state established — monitoring active domains");

  const view: CurrentStateView = {
    patient_id: input.care_recipient_id,
    timestamp,
    active_medications: input.care_record.patient_state.active_medications,
    recent_changes: recent,
    open_tasks: input.tasks.filter((t) => t.status === "open"),
    alerts: buildAlerts(input),
    unresolved_issues: input.care_truth.conflicts.filter((c) => c.status === "unresolved"),
    snapshot_summary,
  };

  return {
    active: true,
    view,
    rules_upheld: [...CURRENT_STATE_VIEW_RULES],
    defining_principle: CURRENT_STATE_VIEW_DEFINING_PRINCIPLE,
  };
}
