import type { BehaviorProfile } from "../input-classification";
import type { ModuleWeights } from "../settings-governance/types";
import type { CareProfile, CareProfileWeightEnvelope } from "./types";

const ROLE_WEIGHTS: Record<CareProfile["roleInCareGraph"], number> = {
  primary_caregiver: 1,
  secondary_caregiver: 0.7,
  shared_caregiver: 0.85,
  observer: 0.3,
};

const WORKLOAD_URGENCY: Record<CareProfile["workloadIntensity"], number> = {
  HIGH: 1.3,
  MEDIUM: 1,
  LOW: 0.85,
};

const WORKLOAD_SUGGESTION: Record<CareProfile["workloadIntensity"], number> = {
  HIGH: 0.7,
  MEDIUM: 1,
  LOW: 1.2,
};

const WORKLOAD_COMPRESSION: Record<CareProfile["workloadIntensity"], number> = {
  HIGH: 0.75,
  MEDIUM: 1,
  LOW: 1.1,
};

const TIME_HORIZON: Record<CareProfile["timeSensitivity"], number> = {
  morning: 1.15,
  night: 1.1,
  unpredictable: 1,
};

function clamp(value: number, min = 0, max = 2): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Derive weighting envelope from care profile — modifies module weighting, not logic.
 */
export function computeCareProfileWeightEnvelope(profile: CareProfile): CareProfileWeightEnvelope {
  const roleWeight = ROLE_WEIGHTS[profile.roleInCareGraph];
  let emotionalSensitivity = roleWeight;

  if (profile.conditionSignals.medicationReminders) emotionalSensitivity *= 1.1;
  if (profile.conditionSignals.mobilityAssistance) emotionalSensitivity *= 1.08;

  const urgencyPrioritization = WORKLOAD_URGENCY[profile.workloadIntensity] * roleWeight;
  const suggestionExpansion = WORKLOAD_SUGGESTION[profile.workloadIntensity];
  const compressionFactor = WORKLOAD_COMPRESSION[profile.workloadIntensity];
  const timeHorizonWeight = TIME_HORIZON[profile.timeSensitivity];
  const notificationIntensity = clamp(urgencyPrioritization * 1.1);

  return {
    roleWeight: clamp(roleWeight),
    urgencyPrioritization: clamp(urgencyPrioritization),
    emotionalSensitivity: clamp(emotionalSensitivity),
    timeHorizonWeight: clamp(timeHorizonWeight),
    suggestionExpansion: clamp(suggestionExpansion),
    notificationIntensity,
    compressionFactor: clamp(compressionFactor),
  };
}

/**
 * Apply care profile weighting to behavior constraints — pre-reasoning envelope only.
 */
export function applyCareProfileBehaviorWeighting(
  profile: BehaviorProfile,
  envelope: CareProfileWeightEnvelope,
): BehaviorProfile {
  let escalation = profile.escalation_sensitivity;
  if (envelope.urgencyPrioritization >= 1.2) {
    escalation =
      escalation === "low"
        ? "standard"
        : escalation === "standard"
          ? "high"
          : escalation === "high"
            ? "maximum"
            : escalation;
  } else if (envelope.suggestionExpansion >= 1.1 && escalation === "maximum") {
    escalation = "high";
  }

  let prioritization = profile.prioritization_aggressiveness;
  if (envelope.urgencyPrioritization >= 1.15) {
    prioritization = "elevated";
  }

  let emotional = profile.emotional_acknowledgment;
  if (envelope.emotionalSensitivity >= 1.1 && emotional === "minimal") {
    emotional = "standard";
  } else if (envelope.compressionFactor < 0.85) {
    emotional = "minimal";
  }

  return {
    ...profile,
    verbosity_factor: clamp(
      profile.verbosity_factor * envelope.compressionFactor * envelope.suggestionExpansion,
      0.6,
      1.2,
    ),
    escalation_sensitivity: escalation,
    prioritization_aggressiveness: prioritization,
    emotional_acknowledgment: emotional,
  };
}

/**
 * Merge care profile envelope into governance module weights.
 */
export function mergeCareProfileWithModuleWeights(
  weights: ModuleWeights,
  envelope: CareProfileWeightEnvelope,
): ModuleWeights {
  return {
    memory: clamp(weights.memory * (0.8 + envelope.roleWeight * 0.2)),
    emotional: clamp(weights.emotional * envelope.emotionalSensitivity),
    time: clamp(weights.time * envelope.timeHorizonWeight),
    priority: clamp(weights.priority * envelope.urgencyPrioritization),
    safety: weights.safety,
    notification: clamp(weights.notification * envelope.notificationIntensity),
  };
}
