import type { BehaviorProfile } from "../../input-classification";
import type { ModuleWeights } from "../../settings-governance/types";
import type {
  CareContextUrgencyLevel,
  CareContextWeightEnvelope,
  SituationalCareContext,
} from "./types";

function clamp(value: number, min = 0.5, max = 2): number {
  return Math.max(min, Math.min(max, value));
}

const URGENCY_MULTIPLIER: Record<CareContextUrgencyLevel, number> = {
  LOW: 0.85,
  MEDIUM: 1,
  HIGH: 1.25,
  CRITICAL: 1.5,
};

const CRISIS_ESCALATION: Record<CareContextUrgencyLevel, number> = {
  LOW: 0.8,
  MEDIUM: 1,
  HIGH: 1.2,
  CRITICAL: 1.5,
};

/**
 * Derive weighting envelope from situational care context.
 * HIGH time pressure → compress output; HIGH interruption risk → reduce steps;
 * UNKNOWN location → increase uncertainty weighting.
 */
export function computeCareContextWeightEnvelope(
  context: SituationalCareContext,
): CareContextWeightEnvelope {
  const { environmentSignals, urgencyLevel, situationType } = context;

  let compressionFactor = 1;
  let stepReduction = 0;
  let uncertaintyWeight = 1;

  if (environmentSignals.timePressure === "high") {
    compressionFactor *= 0.75;
  } else if (environmentSignals.timePressure === "medium") {
    compressionFactor *= 0.88;
  }

  if (environmentSignals.interruptionRisk === "high") {
    stepReduction = 2;
    compressionFactor *= 0.82;
  } else if (environmentSignals.interruptionRisk === "medium") {
    stepReduction = 1;
    compressionFactor *= 0.92;
  }

  const location = environmentSignals.locationContext ?? "unknown";
  if (location === "unknown") {
    uncertaintyWeight = 1.3;
  }

  if (situationType === "uncertain_state") {
    uncertaintyWeight = Math.max(uncertaintyWeight, 1.25);
  }

  let emotionalSensitivity = urgencyLevel === "CRITICAL" ? 1.15 : 1;
  if (situationType === "emergency") {
    emotionalSensitivity = 1.2;
  }

  const urgencyMultiplier = URGENCY_MULTIPLIER[urgencyLevel];
  const crisisEscalation = CRISIS_ESCALATION[urgencyLevel];
  const timeHorizonCompression =
    environmentSignals.timePressure === "high"
      ? 0.7
      : environmentSignals.timePressure === "medium"
        ? 0.85
        : 1;

  return {
    urgencyMultiplier: clamp(urgencyMultiplier),
    emotionalSensitivity: clamp(emotionalSensitivity),
    timeHorizonCompression: clamp(timeHorizonCompression, 0.5, 1.2),
    crisisEscalation: clamp(crisisEscalation),
    compressionFactor: clamp(compressionFactor, 0.55, 1.1),
    uncertaintyWeight: clamp(uncertaintyWeight, 0.8, 1.5),
    stepReduction,
  };
}

/**
 * Apply situational care context weighting to behavior constraints — pre-reasoning only.
 */
export function applyCareContextBehaviorWeighting(
  profile: BehaviorProfile,
  layer: { context: SituationalCareContext; envelope: CareContextWeightEnvelope },
): BehaviorProfile {
  const { envelope, context } = layer;

  let escalation = profile.escalation_sensitivity;
  if (envelope.crisisEscalation >= 1.3) {
    escalation =
      escalation === "low"
        ? "standard"
        : escalation === "standard"
          ? "high"
          : escalation === "high"
            ? "maximum"
            : escalation;
  }

  let prioritization = profile.prioritization_aggressiveness;
  if (envelope.urgencyMultiplier >= 1.2) {
    prioritization = "elevated";
  }

  let emotional = profile.emotional_acknowledgment;
  if (envelope.emotionalSensitivity >= 1.1 && emotional === "minimal") {
    emotional = "standard";
  }

  const verbosity = clamp(
    profile.verbosity_factor * envelope.compressionFactor,
    0.55,
    1.15,
  );

  if (context.userIntentSignal.confidence < 0.6 && prioritization === "elevated") {
    prioritization = "standard";
  }

  return {
    ...profile,
    verbosity_factor: verbosity,
    escalation_sensitivity: escalation,
    prioritization_aggressiveness: prioritization,
    emotional_acknowledgment: emotional,
  };
}

/**
 * Merge situational care context envelope into governance module weights.
 */
export function mergeCareContextWithModuleWeights(
  weights: ModuleWeights,
  envelope: CareContextWeightEnvelope,
): ModuleWeights {
  return {
    memory: clamp(weights.memory * (2 - envelope.uncertaintyWeight * 0.3)),
    emotional: clamp(weights.emotional * envelope.emotionalSensitivity),
    time: clamp(weights.time * envelope.timeHorizonCompression),
    priority: clamp(weights.priority * envelope.urgencyMultiplier),
    safety: clamp(weights.safety * envelope.crisisEscalation),
    notification: clamp(weights.notification * envelope.urgencyMultiplier),
  };
}
