import type {
  CURVE_DEFAULT_THRESHOLDS,
  TIME_CURVE_TYPES,
} from "./contract-constants";

export type TimeCurveType = (typeof TIME_CURVE_TYPES)[number];

/**
 * Every situation defines these (hours until deadline / action needed).
 * Example medication refill: safe 72h, warning 24h, critical <6h.
 */
export type TimeThresholds = {
  /** Hours remaining at which situation is still considered safe. */
  safeThresholdTime: number;
  /** Hours remaining at which warning zone begins. */
  warningThresholdTime: number;
  /** Hours remaining at/below which situation is critical. */
  criticalThresholdTime: number;
};

export type ThresholdZone = "safe" | "warning" | "critical";

export type CurveKParams = {
  /** Acute medical k (0.8–1.5). */
  acuteK?: number;
  /** Medication-dependent k (1.2–2.0). */
  medicationK?: number;
};

/**
 * Signals for situation → curve classification (heuristics only — never LLM).
 */
export type CurveClassificationSignals = {
  /** Care-context SituationType when available. */
  situationType?: string;
  /** Demand category when available. */
  demandCategory?: string;
  /** Free-text title / summary for keyword heuristics. */
  text?: string;
  /** Risk register / STATE priority hint. */
  riskLevel?: string;
  /** Explicit override when caller already knows the curve. */
  explicitCurveType?: TimeCurveType;
};

export type CurveClassificationResult = {
  curveType: TimeCurveType;
  thresholds: TimeThresholds;
  /** Why this curve was chosen (deterministic audit). */
  reasons: readonly string[];
};

export type RiskOverTimeResult = {
  curveType: TimeCurveType;
  /** Pressure hours: how far past / into the unsafe window (increases with urgency). */
  pressureHours: number;
  /** Normalized τ = pressureHours / safeThreshold (scale-free). */
  tau: number;
  /** TimeCurveType(t) multiplier (≥ ~0). */
  curveMultiplier: number;
  /** BaseRisk × curveMultiplier. */
  riskOverTime: number;
  thresholdZone: ThresholdZone;
  thresholds: TimeThresholds;
};

export type CurveDefaultKey = keyof typeof CURVE_DEFAULT_THRESHOLDS;

/**
 * Inputs for Priority Contract curve path.
 * Replaces linear TimeDecayFactor = 1/(hours+1) when present.
 */
export type CurvePrioritySignals = {
  timeCurveType: TimeCurveType;
  thresholds?: TimeThresholds;
  /** Hours until deadline (preferred). */
  hoursUntilDeadline?: number;
  /** Optional explicit pressure hours (elapsed urgency). */
  pressureHours?: number;
  curveK?: CurveKParams;
};
