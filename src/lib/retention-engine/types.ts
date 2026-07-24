import type { RETURN_STATE_SECTIONS, RETENTION_RULES } from "./contract-constants";

export type ReturnStateSectionKey = (typeof RETURN_STATE_SECTIONS)[number];

export type ReturnStateSections = Record<ReturnStateSectionKey, string[]>;

export type SessionSnapshot = {
  caregiver_id: string;
  last_visit_at: string;
  event_count: number;
  care_recipient_id: string;
  context_updated_at: string;
};

export type ReturnStateOfCare = {
  computed_at: string;
  last_visit_at: string | null;
  inactive_ms: number;
  is_return_session: boolean;
  sections: ReturnStateSections;
  headline: string;
};

export type RetentionEngineResult = {
  active: boolean;
  return_state: ReturnStateOfCare;
  session_recorded: boolean;
  rules_upheld: readonly (typeof RETENTION_RULES)[number][];
  defining_principle: string;
};

export type ProcessRetentionEngineInput = {
  caregiver_id: string;
  context: import("../situation-entry/types").CareContextRoot;
  care_context_diff?: import("../care-context-diff-engine/types").CareContextDiffResult;
  continuity_decay?: import("../continuity-decay-engine/types").ContinuityDecayResult;
  contradiction_detection?: import("../contradiction-detection-engine/types").ContradictionDetectionResult;
  tasks?: import("../task-extraction-engine/types").TaskExtractionResult;
  state_of_care?: import("../state-of-care-summary-engine/types").StateOfCareSummaryResult;
  as_of?: string;
};
