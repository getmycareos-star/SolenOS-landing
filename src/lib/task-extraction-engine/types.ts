import type { TASK_EXTRACTION_RULES, TASK_STATUSES } from "./contract-constants";
import type { TimelineEvent } from "../care-timeline-engine/types";

export type TaskStatus = (typeof TASK_STATUSES)[number];

export type ExtractedTask = {
  id: string;
  description: string;
  owner: string | null;
  due_date: string | null;
  source_event: string;
  status: TaskStatus;
  kind: string;
};

export type TaskExtractionResult = {
  active: boolean;
  tasks: ExtractedTask[];
  open_tasks: ExtractedTask[];
  rules_upheld: readonly (typeof TASK_EXTRACTION_RULES)[number][];
  defining_principle: string;
};

export type ProcessTaskExtractionInput = {
  caregiver_id: string;
  care_recipient_id: string;
  timeline_events: TimelineEvent[];
  events_created: TimelineEvent[];
};
