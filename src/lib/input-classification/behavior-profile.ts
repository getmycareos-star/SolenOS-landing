import type { InputMode } from "./contract-constants";

export type EscalationSensitivity = "low" | "standard" | "high" | "maximum";
export type UncertaintyStrictness = "standard" | "strict";
export type PrioritizationAggressiveness = "standard" | "elevated";
export type EmotionalAcknowledgmentIntensity = "minimal" | "standard" | "elevated";

/** Behavioral constraints for downstream generation — schema and semantics unchanged. */
export interface BehaviorProfile {
  mode: InputMode;
  verbosity_factor: number;
  escalation_sensitivity: EscalationSensitivity;
  uncertainty_strictness: UncertaintyStrictness;
  prioritization_aggressiveness: PrioritizationAggressiveness;
  emotional_acknowledgment: EmotionalAcknowledgmentIntensity;
}

const PROFILES: Record<InputMode, Omit<BehaviorProfile, "mode">> = {
  crisis_urgent: {
    verbosity_factor: 0.85,
    escalation_sensitivity: "maximum",
    uncertainty_strictness: "strict",
    prioritization_aggressiveness: "elevated",
    emotional_acknowledgment: "minimal",
  },
  medical_document: {
    verbosity_factor: 0.95,
    escalation_sensitivity: "low",
    uncertainty_strictness: "strict",
    prioritization_aggressiveness: "standard",
    emotional_acknowledgment: "minimal",
  },
  emotional_narrative: {
    verbosity_factor: 1,
    escalation_sensitivity: "standard",
    uncertainty_strictness: "standard",
    prioritization_aggressiveness: "standard",
    emotional_acknowledgment: "elevated",
  },
  administrative_legal: {
    verbosity_factor: 1,
    escalation_sensitivity: "low",
    uncertainty_strictness: "standard",
    prioritization_aggressiveness: "standard",
    emotional_acknowledgment: "minimal",
  },
};

export function selectBehaviorProfile(classification: { mode: InputMode }): BehaviorProfile {
  return { mode: classification.mode, ...PROFILES[classification.mode] };
}

export function formatBehaviorConstraint(profile: BehaviorProfile): string {
  return [
    `INPUT_MODE: ${profile.mode}`,
    `ESCALATION_SENSITIVITY: ${profile.escalation_sensitivity}`,
    `UNCERTAINTY_STRICTNESS: ${profile.uncertainty_strictness}`,
    `PRIORITIZATION: ${profile.prioritization_aggressiveness}`,
    `EMOTIONAL_ACK: ${profile.emotional_acknowledgment}`,
  ].join(" | ");
}
