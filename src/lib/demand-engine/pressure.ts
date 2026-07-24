import { PRESSURE_WEIGHTS } from "./contract-constants";

/** Clamp a numeric score into 0–100. */
export function clampScore100(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n * 100) / 100));
}

/**
 * Cognitive pressure — effort is EXCLUDED by design.
 * pressureScore =
 *   urgency * 0.35 +
 *   riskImpact * 0.35 +
 *   uncertainty * 0.20 +
 *   emotionalLoad * 0.10
 */
export function computePressureScore(input: {
  urgency: number;
  riskImpact: number;
  uncertainty: number;
  emotionalLoad: number;
  /** Accepted but never used in formula (anti-drift). */
  effort?: number;
}): number {
  void input.effort;
  const raw =
    clampScore100(input.urgency) * PRESSURE_WEIGHTS.urgency +
    clampScore100(input.riskImpact) * PRESSURE_WEIGHTS.riskImpact +
    clampScore100(input.uncertainty) * PRESSURE_WEIGHTS.uncertainty +
    clampScore100(input.emotionalLoad) * PRESSURE_WEIGHTS.emotionalLoad;
  return clampScore100(raw);
}

/** Reattach derived pressureScore onto a Demand (pure). */
export function withPressureScore<T extends {
  urgency: number;
  riskImpact: number;
  uncertainty: number;
  emotionalLoad: number;
  effort: number;
}>(demand: T): T & { pressureScore: number } {
  return {
    ...demand,
    pressureScore: computePressureScore(demand),
  };
}
