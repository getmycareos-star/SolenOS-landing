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
    follow_up_items: [],
    decision_trace: {
      events: [],
      assumptions: [],
      unknowns: ["TIMEFRAME", "SUCCESS_CRITERIA", "SCOPE_BOUNDARIES"],
      evidence_sources: [],
    },
    confidence_state: {
      overall_confidence: "low",
      completeness: 0,
      reasoning_limits: ["Input lacks structure for safe interpretation."],
    },
    trust_layer: {
      known: [],
      assumed: [],
      unknown: [
        { statement: "TIMEFRAME", drives_clarification: true },
        { statement: "SUCCESS_CRITERIA", drives_clarification: true },
        { statement: "SCOPE_BOUNDARIES", drives_clarification: true },
      ],
      recency: {
        last_updated_at: null,
        freshness_score: 0,
        interpretation: "potentially outdated (>7–14 days)",
      },
      confidence: 0.2,
    },
    transparency_panel: {
      data_used: { care_events: [], timeline_segments: [], caregiver_inputs: [] },
      data_ignored: { conflicting: [], low_confidence: [], stale_or_decayed: [] },
      reason_for_output: "Awaiting structured care input to produce traceable reasoning.",
      evidence_breakdown: [],
      confidence_scores: { overall_pct: 15, tier: "low" },
      recency: { last_update_at: null, critical_event_ages: [], decay_status: "stale" },
      observed: [],
      inferred: [],
    },
  });
}

/** @deprecated Use createInitialState */
export const createStateMemory = createInitialState;
/** @deprecated Use SolenOSState */
export type StateMemory = SolenOSState;
