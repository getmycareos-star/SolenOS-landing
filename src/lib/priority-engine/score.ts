import { normalizeScore01, clampUnit } from "./normalize";
import type {
  DependencyGraphInput,
  EmotionalAmplificationInput,
  MemoryReinforcementInput,
  PriorityScoreInputs,
  PriorityWeights,
  RiskPenaltyInput,
} from "./types";

/**
 * dependencyWeight = log(1 + affectedUsers) — logarithmic, not linear.
 * Then scaled by dependencySeverityMultiplier and normalized to 0–1.
 *
 * dependencyBoost = numberOfDependentsAffected × dependencySeverityMultiplier
 * (boost is intermediate; weight uses log of unique affected users).
 */
export function computeDependencyWeight(input: DependencyGraphInput): {
  affectedUsers: number;
  dependencyBoost: number;
  dependencyWeight: number;
} {
  // Never collapse multi-dependency into a single user — count unique ids.
  const unique = new Set<string>();
  for (const id of input.dependents) {
    if (id.trim()) unique.add(id.trim());
  }
  for (const id of input.sharedCareWith ?? []) {
    if (id.trim()) unique.add(`shared:${id.trim()}`);
  }
  // External caregivers are part of the shared-care graph but are not dependents
  // affected as primary subjects — still count as graph stakeholders for clarity.
  for (const id of input.externalCaregivers ?? []) {
    if (id.trim()) unique.add(`external:${id.trim()}`);
  }

  const affectedUsers = unique.size;
  const severity = Math.max(0, input.dependencySeverityMultiplier);
  const dependencyBoost = affectedUsers * severity;
  const rawLog = Math.log(1 + affectedUsers);
  // log(1+n) grows slowly; normalize against a practical care-graph ceiling (log(1+20)).
  const logNorm = normalizeScore01(rawLog / Math.log(1 + 20));
  const dependencyWeight = clampUnit(logNorm * Math.min(1.5, severity));

  return { affectedUsers, dependencyBoost, dependencyWeight };
}

/**
 * E = emotionalLoad × vulnerabilityFactor
 * Burnout increases urgency (amplifies E).
 * Grief reduces action aggressiveness but increases priority sensitivity —
 * applied as weight modifiers in applyEmotionalWeightModifiers (not logic override).
 */
export function computeEmotionalAmplification(
  input: EmotionalAmplificationInput,
): number {
  let load = Math.max(0, input.emotionalLoad);
  let vulnerability = Math.max(0, input.vulnerabilityFactor);

  if (input.burnout) {
    load *= 1.25;
    vulnerability = Math.max(vulnerability, 1.1);
  }

  if (input.grief) {
    // Grief increases priority sensitivity (higher E contribution from load),
    // not action aggressiveness (handled via weight modifiers).
    vulnerability *= 1.15;
  }

  return clampUnit(load * vulnerability);
}

/**
 * M = frequency × recency × importanceDecay
 */
export function computeMemoryReinforcement(
  input: MemoryReinforcementInput,
): number {
  const frequency = clampUnit(input.frequency);
  const recency = clampUnit(input.recency);
  const importanceDecay = clampUnit(input.importanceDecay);
  return clampUnit(frequency * recency * importanceDecay);
}

/**
 * R = medicalRisk + financialRisk + uncertaintyRisk
 * High risk suppresses score but does not eliminate (enforced at fusion + constraints).
 */
export function computeRiskPenalty(input: RiskPenaltyInput): number {
  const medical = clampUnit(input.medicalRisk);
  const financial = clampUnit(input.financialRisk);
  const uncertainty = clampUnit(input.uncertaintyRisk);
  // Sum then re-normalize so R stays in 0–1.
  return clampUnit((medical + financial + uncertainty) / 3);
}

/**
 * PriorityScore = (T * Wt) + (E * We) + (M * Wm) + (D * Wd) - (R * Wr)
 * All component inputs expected normalized 0–1; result clamped 0–1.
 */
export function computePriorityScore(
  inputs: PriorityScoreInputs,
  weights: PriorityWeights,
): number {
  const T = normalizeScore01(inputs.temporalUrgency);
  const E = normalizeScore01(inputs.emotionalLoad);
  const M = normalizeScore01(inputs.memoryReinforcement);
  const D = normalizeScore01(inputs.dependencyWeight);
  const R = normalizeScore01(inputs.riskPenalty);

  const raw =
    T * weights.Wt +
    E * weights.We +
    M * weights.Wm +
    D * weights.Wd -
    R * weights.Wr;

  return clampUnit(raw);
}

/**
 * Emotional signals MODIFY weighting only — do not override fusion logic.
 * Burnout → slight Wt boost (urgency).
 * Grief → reduce aggressiveness (lower Wt) while increasing priority sensitivity (higher We).
 */
export function applyEmotionalWeightModifiers(
  weights: PriorityWeights,
  emotional: Pick<EmotionalAmplificationInput, "burnout" | "grief">,
): PriorityWeights {
  let { Wt, We, Wm, Wd, Wr } = weights;

  if (emotional.burnout) {
    Wt = Wt * 1.1;
  }

  if (emotional.grief) {
    Wt = Wt * 0.85;
    We = We * 1.2;
  }

  return { Wt, We, Wm, Wd, Wr };
}

/**
 * Uncertainty from: missing time, missing memory, conflicting signals,
 * low dependency clarity, and high-priority missing-information gaps.
 * confidence = 1 - uncertainty
 */
export function computeUncertainty(flags: {
  missingTime: boolean;
  missingMemory: boolean;
  conflictingSignals: boolean;
  lowDependencyClarity: boolean;
  highPriorityGaps?: boolean;
}): { uncertainty: number; confidence: number } {
  let uncertainty = 0;
  if (flags.missingTime) uncertainty += 0.25;
  if (flags.missingMemory) uncertainty += 0.2;
  if (flags.conflictingSignals) uncertainty += 0.25;
  if (flags.lowDependencyClarity) uncertainty += 0.2;
  if (flags.highPriorityGaps) uncertainty += 0.25;
  uncertainty = clampUnit(uncertainty);
  return { uncertainty, confidence: clampUnit(1 - uncertainty) };
}
