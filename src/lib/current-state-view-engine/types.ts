import type { CURRENT_STATE_VIEW_RULES } from "./contract-constants";
import type { CareRecord, CareTruth, TimelineEvent } from "../care-timeline-engine/types";
import type { ExtractedTask } from "../task-extraction-engine/types";

export type CurrentStateAlert = {
  alert_id: string;
  message: string;
  severity: "high" | "medium" | "low";
  source_event_id: string | null;
};

export type CurrentStateView = {
  patient_id: string;
  timestamp: string;
  active_medications: CareRecord["patient_state"]["active_medications"];
  recent_changes: TimelineEvent[];
  open_tasks: ExtractedTask[];
  alerts: CurrentStateAlert[];
  unresolved_issues: CareTruth["conflicts"];
  snapshot_summary: string;
};

export type CurrentStateViewResult = {
  active: boolean;
  view: CurrentStateView;
  rules_upheld: readonly (typeof CURRENT_STATE_VIEW_RULES)[number][];
  defining_principle: string;
};

export type ProcessCurrentStateViewInput = {
  care_recipient_id: string;
  care_record: CareRecord;
  care_truth: CareTruth;
  tasks: ExtractedTask[];
  what_matters_most?: string;
  as_of?: string;
};
