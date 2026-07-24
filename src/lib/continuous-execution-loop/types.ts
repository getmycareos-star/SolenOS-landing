import type {
  EXECUTION_LOOP_PHASES,
  STATE_UPDATE_OPERATIONS,
  SYSTEM_MODES,
  UNCERTAINTY_STATES,
  UNIFIED_INPUT_TYPES,
} from "./contract-constants";
import type { CanonicalCareEvent, CareContextRoot } from "../situation-entry/types";
import type { DareIngestResult } from "../data-acquisition-resilience/types";

export type ExecutionLoopPhase = (typeof EXECUTION_LOOP_PHASES)[number];
export type UnifiedInputType = (typeof UNIFIED_INPUT_TYPES)[number];
export type StateUpdateOperation = (typeof STATE_UPDATE_OPERATIONS)[number];
export type UncertaintyState = (typeof UNCERTAINTY_STATES)[number];
export type SystemMode = (typeof SYSTEM_MODES)[number];

export type RawInputEvent = {
  id: string;
  caregiver_id: string;
  raw_text: string;
  input_type: UnifiedInputType;
  captured_at: string;
  document_ids: string[];
  target_event_id: string | null;
};

export type StateDiff = {
  newly_added_events: string[];
  updated_events: string[];
  resolved_uncertainty: string[];
  new_uncertainty: string[];
  conflicts_detected: string[];
  follow_ups_created: string[];
  follow_ups_closed: string[];
  superseded_events: string[];
  invalidated_events: string[];
};

export type UncertaintyRecord = {
  id: string;
  label: string;
  state: UncertaintyState;
  event_id: string | null;
  created_at: string;
  updated_at: string;
};

export type IdleRefreshResult = {
  since_last_loop: string[];
  at_risk_event_ids: string[];
  missing_information: string[];
  recomputed_only: true;
};

export type ContinuousExecutionLoopLayer = {
  system_mode: SystemMode;
  loop_phase: ExecutionLoopPhase;
  operation: StateUpdateOperation;
  raw_input_event: RawInputEvent;
  diff: StateDiff;
  what_changed: string[];
  uncertainty_records: UncertaintyRecord[];
  open_uncertainties: string[];
  priority_event_ids: string[];
  hidden_priority_count: number;
  output_triggered_by_diff: boolean;
  idle_refresh: IdleRefreshResult | null;
  loop_definition: string;
};

export type ProcessExecutionLoopInput = {
  caregiver_id: string;
  raw_input: string;
  input_type: UnifiedInputType;
  prior_context: CareContextRoot | null;
  context: CareContextRoot;
  events_created: CanonicalCareEvent[];
  dare: DareIngestResult | null;
  is_first_situation: boolean;
  document_ids?: string[];
  target_event_id?: string | null;
  captured_at?: string;
};

export type ReprocessLoopInput = {
  caregiver_id: string;
  trigger: "correction" | "idle_refresh";
  context: CareContextRoot;
  correction_event_id?: string | null;
};

export type { CanonicalCareEvent, CareContextRoot };
