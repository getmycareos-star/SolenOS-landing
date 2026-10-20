import type { CareContextState } from "../post-care-insight/contract-constants";
import type { SolenOSResponse } from "../response-validator";
import type { PersistenceTriggerId } from "./contract-constants";

export type CareStateMode = "ephemeral" | "persistent";

export interface CareGraphSummary {
  what_is_happening: string;
  what_matters_now: string;
  risk_level: SolenOSResponse["risk_level"];
  care_context_state: CareContextState;
  interaction_id?: string;
}

export interface MemoryNode {
  node_id: string;
  interaction_id: string;
  input_ref: string;
  stored_at: string;
  is_conclusion: false;
}

export interface ActiveDecision {
  decision_id: string;
  interaction_id: string;
  risk_level: SolenOSResponse["risk_level"];
  what_matters_now: string;
  bound_at: string;
}

export interface CareGraphState {
  care_graph_id: string;
  nodes: CareGraphSummary[];
  created_at: string;
  updated_at: string;
}

export interface IdentityContinuityState {
  care_session_id: string;
  user_id?: string;
  mode: CareStateMode;
  care_graph: CareGraphState;
  memory_nodes: MemoryNode[];
  active_decisions: ActiveDecision[];
  has_stored_care_graph: boolean;
  auth_enabled: boolean;
}

export interface PersistenceSignals {
  care_graph_created: boolean;
  memory_node_created: boolean;
  multi_step_dependency_detected: boolean;
  user_remember_request: boolean;
  return_behavior_detected: boolean;
  document_uploaded: boolean;
  /** At least one care decision was generated in this interaction. */
  care_decision_generated: boolean;
}

export type ContinuityPromptAction = "none" | "prompt_signup" | "prompt_login";

export type ContinuityPromptReason = "continuity_needed" | "resume_context";

export interface ContinuityPrompt {
  action: ContinuityPromptAction;
  reason?: ContinuityPromptReason;
  message: string;
  care_graph_summary?: CareGraphSummary;
}

export interface ContinuityLayerPayload {
  continuity_prompt: ContinuityPrompt;
  identity_state: {
    mode: CareStateMode;
    care_session_id: string;
    has_stored_care_graph: boolean;
    auth_enabled: boolean;
  };
  persistence_triggers: PersistenceTriggerId[];
}

export interface RehydratedCareState {
  care_graph: CareGraphState;
  memory_nodes: MemoryNode[];
  active_decisions: ActiveDecision[];
  continuity_state: IdentityContinuityState;
}
