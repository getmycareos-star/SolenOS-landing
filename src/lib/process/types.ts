import { validateAIResponse } from "../response-validator";
import type { RiskLevel, SolenOSOutput } from "../output-contract/types";

export type Classification =
  | "emergency"
  | "care_update"
  | "emotional_signal"
  | "question"
  | "document"
  | "ambiguous";

export type DomainTag =
  | "medical"
  | "post-care"
  | "chronic-care"
  | "emergency-care"
  | "administrative-care";

export type InternalRiskLevel = "RED" | "ORANGE" | "YELLOW" | "GREEN";

export interface InferredSignal {
  signal: string;
  confidence: number;
}

export interface SignalVector {
  urgency_signals: number[];
  medical_entities: string[];
  emotional_intensity: number;
  uncertainty_markers: string[];
  context_entities: string[];
  inferred: InferredSignal[];
}

export interface DecisionState {
  primary_action: string;
  next_question: string;
  priority_score: number;
  risk_level: InternalRiskLevel;
  confidence: number;
  blocking_factor: string;
}

export interface RiskState {
  internal: InternalRiskLevel;
  output: RiskLevel;
}

export interface SessionMemory {
  baseline_facts: string[];
  provider_names: string[];
  unresolved_issues: string[];
  session_summaries: string[];
  medications: string[];
  turn_count: number;
  last_question: string;
}

export type DecisionCard = SolenOSOutput;

export interface SolenOSState {
  input: string;
  classification: Classification;
  signals: SignalVector;
  domain: DomainTag;
  secondary_domains: DomainTag[];
  decision: DecisionState;
  risk: RiskState;
  memory: SessionMemory;
  output: DecisionCard;
  safe_mode: boolean;
}

export interface ProcessResult {
  output: DecisionCard;
  new_state: SolenOSState;
}

export const EMPTY_SIGNALS: SignalVector = {
  urgency_signals: [],
  medical_entities: [],
  emotional_intensity: 0,
  uncertainty_markers: [],
  context_entities: [],
  inferred: [],
};

export const EMPTY_DECISION: DecisionState = {
  primary_action: "",
  next_question: "",
  priority_score: 0,
  risk_level: "GREEN",
  confidence: 0,
  blocking_factor: "",
};

export const EMPTY_MEMORY: SessionMemory = {
  baseline_facts: [],
  provider_names: [],
  unresolved_issues: [],
  session_summaries: [],
  medications: [],
  turn_count: 0,
  last_question: "",
};

export function createInitialState(): SolenOSState {
  return {
    input: "",
    classification: "ambiguous",
    signals: { ...EMPTY_SIGNALS, inferred: [] },
    domain: "medical",
    secondary_domains: [],
    decision: { ...EMPTY_DECISION },
    risk: { internal: "GREEN", output: "low" },
    memory: { ...EMPTY_MEMORY },
    output: emptyDecisionCard(),
    safe_mode: false,
  };
}

export function emptyDecisionCard(): DecisionCard {
  return validateAIResponse({
    what_is_happening: "Awaiting structured input.",
    what_matters_now: "Unable to determine priority until context is provided.",
    what_to_ask_next: "What is the one missing fact right now?",
    risk_level: "low",
    what_can_wait: "Non-urgent items until situation is structured.",
  });
}

/** @deprecated Use createInitialState */
export const createStateMemory = createInitialState;
/** @deprecated Use SolenOSState */
export type StateMemory = SolenOSState;
