import type { SolenOSState } from "../process/types";

export type Timestamp = string;

export interface CognitiveVersion {
  kernel_version: string;
  reasoning_spec_version: string;
  decision_engine_version: string;
  risk_engine_version: string;
  schema_version: string;
}

export type CareEventType =
  | "input_received"
  | "classification_completed"
  | "signal_extracted"
  | "decision_generated"
  | "risk_assessed"
  | "safe_mode_triggered"
  | "user_override";

export interface User {
  id: string;
  created_at: Timestamp;
  profile: {
    role?: "caregiver" | "patient" | "family" | "admin";
    region?: string;
  };
}

export interface Session {
  session_id: string;
  user_id: string;
  started_at: Timestamp;
  last_active: Timestamp;
  kernel_version: string;
  current_state_ref?: string;
}

export interface CareEvent {
  event_id: string;
  session_id: string;
  user_id: string;
  type: CareEventType;
  payload: Record<string, unknown>;
  temporal: {
    event_time: Timestamp;
    processing_time: Timestamp;
  };
  cognitive_version: CognitiveVersion;
  integrity: {
    checksum: string;
    immutable: true;
  };
}

export interface SignalSnapshot {
  signal_id: string;
  session_id: string;
  source_event_id: string;
  urgency_signals: number[];
  medical_entities: string[];
  emotional_intensity: number;
  uncertainty_markers: string[];
  context_entities: string[];
  created_at: Timestamp;
  cognitive_version: CognitiveVersion;
}

export interface MemoryItem {
  memory_id: string;
  user_id: string;
  session_id: string;
  fact: string;
  weight: number;
  recency: number;
  emotional_salience: number;
  contradiction_flag: boolean;
  source_event_id: string;
  created_at: Timestamp;
}

export interface DecisionRecord {
  decision_id: string;
  session_id: string;
  source_event_id: string;
  primary_action: string;
  priority_score: number;
  risk_level: "RED" | "ORANGE" | "YELLOW" | "GREEN";
  decision_trace: {
    signals_used: string[];
    risk_factors: string[];
    prioritization_logic: string[];
    confidence_drivers: string[];
  };
  safe_mode: boolean;
  created_at: Timestamp;
  cognitive_version: CognitiveVersion;
}

export interface StateSnapshot {
  snapshot_id: string;
  session_id: string;
  kernel_state: SolenOSKernelState;
  event_offset: number;
  created_at: Timestamp;
  cognitive_version: CognitiveVersion;
}

export type SolenOSKernelState = SolenOSState;

export interface CausalLink {
  source_event_id: string;
  target_event_id: string;
  relationship: "triggered" | "contradicted" | "reinforced" | "resolved";
}

export interface TrustState {
  session_id: string;
  system_confidence: number;
  user_override_rate: number;
  contradiction_rate: number;
  stable_decision_score: number;
  updated_at: Timestamp;
}

export interface SolenOSStore {
  users: User[];
  sessions: Session[];
  events: CareEvent[];
  signals: SignalSnapshot[];
  decisions: DecisionRecord[];
  memory: MemoryItem[];
  snapshots: StateSnapshot[];
  causal_links: CausalLink[];
  trust_state: TrustState[];
}

export interface ExecuteTurnResult {
  output: import("../output-contract/types").SolenOSOutput;
  session_id: string;
  user_id: string;
  event_offset: number;
  cognitive_version: CognitiveVersion;
}
