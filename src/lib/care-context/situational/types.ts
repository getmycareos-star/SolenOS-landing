import type {
  CARE_CONTEXT_URGENCY_LEVELS,
  INTERRUPTION_RISK_LEVELS,
  LOCATION_CONTEXTS,
  SITUATION_TYPES,
  TIME_PRESSURE_LEVELS,
} from "./contract-constants";

export type SituationType = (typeof SITUATION_TYPES)[number];

export type CareContextUrgencyLevel = (typeof CARE_CONTEXT_URGENCY_LEVELS)[number];

export type LocationContext = (typeof LOCATION_CONTEXTS)[number];

export type TimePressure = (typeof TIME_PRESSURE_LEVELS)[number];

export type InterruptionRisk = (typeof INTERRUPTION_RISK_LEVELS)[number];

/** Ephemeral situational snapshot — NOT longitudinal journey context or Care Profile. */
export type SituationalCareContext = {
  timestamp: string;
  situationType: SituationType;
  urgencyLevel: CareContextUrgencyLevel;
  environmentSignals: {
    locationContext?: LocationContext;
    timePressure: TimePressure;
    interruptionRisk: InterruptionRisk;
  };
  activeConstraints: string[];
  recentEvents: string[];
  unresolvedItems: string[];
  userIntentSignal: {
    explicitIntent?: string;
    inferredIntent?: string;
    confidence: number;
  };
};

export type CareContextWeightEnvelope = {
  urgencyMultiplier: number;
  emotionalSensitivity: number;
  timeHorizonCompression: number;
  crisisEscalation: number;
  compressionFactor: number;
  uncertaintyWeight: number;
  stepReduction: number;
};

export type CareContextSystemGuaranteeResult = {
  ok: boolean;
  violations: string[];
};

export type CareContextLayerResult = {
  context: SituationalCareContext;
  envelope: CareContextWeightEnvelope;
  guarantee: CareContextSystemGuaranteeResult;
};

export type CareContextLayerPayload = {
  situationType: SituationType;
  urgencyLevel: CareContextUrgencyLevel;
  locationContext?: LocationContext;
  timePressure: TimePressure;
  interruptionRisk: InterruptionRisk;
  intentConfidence: number;
  unresolvedCount: number;
  constraintCount: number;
  envelope: CareContextWeightEnvelope;
};
