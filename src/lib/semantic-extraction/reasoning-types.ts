/**
 * Qwen Reasoning Layer — multi-pass synthesis, intent modeling, trajectory
 * reasoning, contradiction resolution, baseline enrichment, uncertainty
 * explanation.
 *
 * These are REASONING capabilities, not extraction. The deterministic engines
 * still validate and compose; Qwen proposes richer understanding for them
 * to work with.
 *
 * Boundaries preserved:
 * - No diagnosis, triage, or clinical judgment
 * - No invented precision — every claim grounded in a caregiver quote
 * - No response composition — composer remains sole authority
 * - No memory — context passed in each call, never stored
 */

import type { SemanticExtraction, CaregiverLoadSignal } from "./types";
import type { CanonicalCareEvent } from "../situation-entry/types";

// ─── Caregiver Intent & Emotional State ───────────────────────────────────

export type CaregiverIntent =
  | "reporting_fact"
  | "asking_question"
  | "expressing_struggle"
  | "seeking_reassurance"
  | "questioning_system"
  | "providing_update"
  | "sharing_feeling"
  | "making_decision"
  | "unclear";

export type CaregiverEmotionalState = {
  primary: string;
  secondary?: string | null;
  intensity: "low" | "medium" | "high";
  evidence: string[];
};

export type CaregiverTrustLevel = "trusting" | "neutral" | "hedging" | "skeptical";

export type CaregiverUrgency = {
  level: "can_wait" | "soon" | "today" | "immediate";
  reason: string | null;
  evidence: string | null;
};

export type CaregiverIntentAnalysis = {
  intent: CaregiverIntent;
  emotional_state: CaregiverEmotionalState;
  trust_level: CaregiverTrustLevel;
  urgency: CaregiverUrgency;
  unspoken_needs: string[];
  confusion_risk: boolean;
  confusion_explanation: string | null;
  summary: string;
};

// ─── Cross-Observation Synthesis ──────────────────────────────────────────

export type DomainTrajectory = {
  domain: string;
  direction: "worsening" | "improving" | "stable" | "fluctuating" | "insufficient_data";
  confidence: "high" | "medium" | "low";
  evidence: string[];
  summary: string;
};

export type InflectionPoint = {
  date_approximate: string | null;
  description: string;
  why_significant: string;
  evidence: string[];
};

export type CrossObservationSynthesis = {
  story_arc: string;
  domain_trajectories: DomainTrajectory[];
  inflection_points: InflectionPoint[];
  co_occurring_patterns: Array<{
    domains: string[];
    relationship: "likely_related" | "independent" | "unclear";
    reasoning: string;
  }>;
  trend_summary: string;
};

// ─── Contradiction Resolution Hypotheses ──────────────────────────────────

export type ContradictionHypothesis = {
  hypothesis: string;
  explanation: string;
  supporting_evidence: string[];
  likelihood: "likely" | "possible" | "unlikely";
};

export type ContradictionResolution = {
  contradiction_id: string;
  field: string;
  claim_a: string;
  claim_b: string;
  hypotheses: ContradictionHypothesis[];
  recommended_action: "preserve_both" | "clarify_with_caregiver" | "defer_to_next_turn";
};

// ─── Baseline Enrichment ──────────────────────────────────────────────────

export type BaselineEnrichment = {
  stability_signals: string[];
  onset_signals: string[];
  functional_baseline: string[];
  trait_vs_state: Array<{
    statement: string;
    classification: "trait" | "state" | "unclear";
    reasoning: string;
  }>;
  quantity_departures: Array<{
    domain: string;
    current: string;
    baseline: string;
    unit: string | null;
    difference_phrase: string;
  }>;
  summary: string;
};

// ─── Uncertainty Explanation ──────────────────────────────────────────────

export type UncertaintyExplanation = {
  explanations: Array<{
    what_is_uncertain: string;
    why_uncertain: string;
    evidence: string;
    would_help: string;
  }>;
  summary: string;
};

// ─── Full Reasoning Output ────────────────────────────────────────────────

export type QwenReasoningOutput = {
  intent_analysis: CaregiverIntentAnalysis | null;
  cross_observation: CrossObservationSynthesis | null;
  contradiction_resolutions: ContradictionResolution[] | null;
  baseline_enrichment: BaselineEnrichment | null;
  uncertainty_explanation: UncertaintyExplanation | null;
  overall_summary: string;
  what_would_help_most: string[];
  degraded: boolean;
  model: string;
  duration_ms: number;
};