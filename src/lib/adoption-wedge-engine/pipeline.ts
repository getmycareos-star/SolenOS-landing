import {
  ACCEPTED_INPUT_TYPES,
  ADOPTION_WEDGE_DEFINING_PRINCIPLE,
  ADOPTION_WEDGE_RULES,
  INGESTION_READY_MESSAGE,
  ORGANIZED_LEAD_MESSAGE,
} from "./contract-constants";
import type { AdoptionWedgeSections, ProcessAdoptionWedgeInput, AdoptionWedgeResult } from "./types";

export function processAdoptionWedge(input: ProcessAdoptionWedgeInput): AdoptionWedgeResult {
  const ingestion_ready =
    input.entry_mode === "initialization" ||
    (input.is_first_situation && input.events_created_count === 0);

  if (ingestion_ready) {
    return {
      active: true,
      is_first_value: false,
      ingestion_ready: true,
      sections: {
        structured_summary_of_chaos: [INGESTION_READY_MESSAGE],
        current_state_snapshot: ["Care record not yet established — awaiting first input."],
        actionable_output: [
          `Accepted formats: ${ACCEPTED_INPUT_TYPES.map((t) => t.replace(/_/g, " ")).join(", ")}`,
        ],
      },
      accepted_input_types: [...ACCEPTED_INPUT_TYPES],
      events_extracted: 0,
      medications_detected: [],
      symptoms_detected: [],
      tasks_surfaced: 0,
      alerts_surfaced: 0,
      rules_upheld: [...ADOPTION_WEDGE_RULES],
      defining_principle: ADOPTION_WEDGE_DEFINING_PRINCIPLE,
    };
  }

  const timeline = input.care_timeline?.care_truth;
  const state = input.current_state?.view;
  const tasks = input.tasks?.open_tasks ?? [];

  const medications_detected =
    timeline?.facts.filter((f) => f.type === "medication").map((f) => f.name) ?? [];
  const symptoms_detected =
    timeline?.facts.filter((f) => f.type === "symptom").map((f) => f.name) ?? [];

  const structured_summary_of_chaos: string[] = [];
  if (input.events_created_count > 0) {
    structured_summary_of_chaos.push(ORGANIZED_LEAD_MESSAGE);
    structured_summary_of_chaos.push(
      `${input.events_created_count} event(s) extracted from input`,
    );
  }
  for (const event of timeline?.timeline.slice(-5) ?? []) {
    structured_summary_of_chaos.push(event.abstract_label);
  }
  if (medications_detected.length > 0) {
    structured_summary_of_chaos.push(
      `Medications identified: ${medications_detected.join(", ")}`,
    );
  }
  if (symptoms_detected.length > 0) {
    structured_summary_of_chaos.push(`Symptoms detected: ${symptoms_detected.join(", ")}`);
  }
  if (structured_summary_of_chaos.length === 0) {
    structured_summary_of_chaos.push("Input processed — care state updated");
  }

  const current_state_snapshot: string[] = [];
  if (state?.snapshot_summary) {
    current_state_snapshot.push(state.snapshot_summary);
  }
  for (const med of state?.active_medications.slice(0, 5) ?? []) {
    current_state_snapshot.push(
      `${med.name}${med.state.value ? ` (${med.state.value})` : ""} — active`,
    );
  }
  for (const change of state?.recent_changes.slice(-3) ?? []) {
    current_state_snapshot.push(change.abstract_label);
  }
  for (const issue of state?.unresolved_issues.slice(0, 3) ?? []) {
    current_state_snapshot.push(issue.shared_message);
  }

  const actionable_output: string[] = [];
  for (const task of tasks.slice(0, 5)) {
    actionable_output.push(task.description);
  }
  for (const alert of state?.alerts.slice(0, 3) ?? []) {
    actionable_output.push(alert.message);
  }
  const missing = input.care_timeline?.care_record.patient_state.open_issues.length ?? 0;
  if (missing > 0) {
    actionable_output.push(`${missing} unresolved contradiction(s) require attention`);
  }
  if (actionable_output.length === 0) {
    actionable_output.push("Continue monitoring — forward updates as they occur");
  }

  const sections: AdoptionWedgeSections = {
    structured_summary_of_chaos,
    current_state_snapshot,
    actionable_output,
  };

  return {
    active: true,
    is_first_value: input.is_first_situation || input.events_created_count > 0,
    ingestion_ready: false,
    sections,
    accepted_input_types: [...ACCEPTED_INPUT_TYPES],
    events_extracted: input.events_created_count,
    medications_detected,
    symptoms_detected,
    tasks_surfaced: tasks.length,
    alerts_surfaced: state?.alerts.length ?? 0,
    rules_upheld: [...ADOPTION_WEDGE_RULES],
    defining_principle: ADOPTION_WEDGE_DEFINING_PRINCIPLE,
  };
}
