/**
 * Situation Priority Contract (GLOBAL RULE) — deterministic scoring law.
 *
 * Core principle: a situation is more important ONLY if it increases
 * real-world harm risk OR reduces future decision uncertainty under time pressure.
 *
 * NOT: user preference, task count, emotional weight alone, UI visibility.
 * NOT: LLM judgment, hardcoded UI importance, preference overrides.
 *
 * PriorityScore =
 *   (RiskWeight × Severity)
 * + (TimeUrgency × TimeDecayFactor)
 * + (UncertaintyWeight × MissingInformationLoad)
 * + (DependencyWeight × DownstreamImpact)
 * - (ResolutionProgress × CompletionFactor)
 *
 * TIME WEIGHTING (CRITICAL SYSTEM RULE):
 *   Caregiving time is NOT linear. Prefer TimeCurveType path:
 *   RiskOverTime(t) = BaseRisk × TimeCurveType(t)
 *   When timeCurveType is set, TimeDecayFactor is curve-derived (not 1/(h+1)).
 *   WRONG: risk = baseRisk + time. CORRECT: risk = baseRisk × timeCurve(...).
 *
 * Safety override (highest precedence):
 *   IF RiskWeight is CRITICAL AND TimeUrgency is NOW → ALWAYS top.
 */

import type { StatePriority } from "../types";
import type { TimeCurveType, TimeThresholds } from "../../time-weighting/types";
import {
  computeCurveTimeDecayFactor,
  linearTimeDecayFactor,
  resolvePriorityTimeSignals,
} from "../../time-weighting/priority-bridge";
import { computeRiskOverTime } from "../../time-weighting/risk-over-time";

/** RiskWeight — PRIMARY driver (harm if nothing is done). */
export const RISK_WEIGHT = {
  CRITICAL: 1.0,
  HIGH: 0.8,
  MEDIUM: 0.5,
  LOW: 0.2,
} as const;

/** TimeUrgency — how fast things break. */
export const TIME_URGENCY = {
  NOW: 1.0,
  SOON: 0.7,
  TODAY: 0.5,
  LATER: 0.2,
} as const;

/** CompletionFactor — reduces priority as resolution progresses. */
export const COMPLETION_FACTOR = {
  RESOLVED: 1.0,
  PARTIAL: 0.5,
  ACTIVE: 0.0,
} as const;

/** Per missing critical field — UncertaintyWeight coefficient. */
export const UNCERTAINTY_FIELD_COEFFICIENT = 0.3;

/** Per dependent situation — DependencyWeight coefficient. */
export const DEPENDENCY_SITUATION_COEFFICIENT = 0.2;

export const PRIORITY_CONTRACT_ONE_LINE =
  "Situation Priority is a deterministic scoring system that ranks caregiving situations based on risk, time urgency, uncertainty, dependency, and completion — with hard overrides for critical real-world harm under immediate time pressure.";

export type RiskLevel = keyof typeof RISK_WEIGHT;
export type TimeUrgencyKey = keyof typeof TIME_URGENCY;
export type CompletionLevel = keyof typeof COMPLETION_FACTOR;

/**
 * Explicit situation inputs for the Priority Contract.
 * All values are objective signals — never preference or emotion.
 */
export type PriorityContractInput = {
  situationId: string;
  /** Harm category — maps to RiskWeight. */
  riskLevel: RiskLevel;
  /**
   * Continuous harm magnitude 0–1 (e.g. adjusted risk / 100).
   * Defaults to 1 so RiskWeight alone drives the risk term when omitted.
   */
  severity?: number;
  timeUrgency: TimeUrgencyKey;
  /** Hours until deadline; used as TimeDecayFactor = 1 / (hours + 1) when no curve. */
  hoursUntilDeadline?: number;
  /**
   * TIME WEIGHTING: situation curve class. When set, TimeDecayFactor becomes
   * curve-derived and timeUrgency may be reconciled from threshold zones
   * (unless lockTimeUrgency is true).
   */
  timeCurveType?: TimeCurveType;
  /** Optional situation thresholds (safe / warning / critical hours remaining). */
  timeThresholds?: Partial<TimeThresholds>;
  /**
   * When true, keep caller timeUrgency even if curve zone would remapping it.
   * Curve still replaces linear TimeDecayFactor.
   */
  lockTimeUrgency?: boolean;
  /** Count of missing critical fields (HIGH missing_information beliefs). */
  numberOfMissingCriticalFields?: number;
  /**
   * Load multiplier for uncertainty term (default 1).
   * Does not encode emotion — typically 1 or average gap severity 0–1+.
   */
  missingInformationLoad?: number;
  /** Count of situations blocked / dependent on this one. */
  numberOfDependentSituations?: number;
  /** Downstream impact multiplier (default 1). */
  downstreamImpact?: number;
  completion: CompletionLevel;
  /**
   * Resolution progress 0–1 applied with CompletionFactor (default 1).
   * ACTIVE still subtracts 0 because CompletionFactor is 0.
   */
  resolutionProgress?: number;
};

export type PriorityComponentBreakdown = {
  riskWeight: number;
  severity: number;
  riskContribution: number;
  timeUrgency: number;
  timeDecayFactor: number;
  timeContribution: number;
  /** Present when Time Weighting curve path was used. */
  timeCurveType?: TimeCurveType;
  /** BaseRisk × TimeCurveType(t) when curve path was used. */
  riskOverTime?: number;
  usedTimeCurve: boolean;
  uncertaintyWeight: number;
  missingInformationLoad: number;
  uncertaintyContribution: number;
  dependencyWeight: number;
  downstreamImpact: number;
  dependencyContribution: number;
  resolutionProgress: number;
  completionFactor: number;
  completionReduction: number;
};

export type PriorityContractResult = {
  situationId: string;
  priorityScore: number;
  /** CRITICAL × NOW — always forced to top regardless of score. */
  safetyOverride: boolean;
  riskLevel: RiskLevel;
  timeUrgency: TimeUrgencyKey;
  completion: CompletionLevel;
  components: PriorityComponentBreakdown;
  /** Human-readable WHY for Decision Surface / EXPLANATION. */
  reasons: readonly string[];
};

export type PriorityContractRankResult = {
  ranked: readonly PriorityContractResult[];
  rankedSituationIds: readonly string[];
  topSituationId: string | undefined;
  overrideApplied: boolean;
};

function clampNonNeg(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/**
 * Legacy linear TimeDecayFactor = 1 / (hoursUntilDeadline + 1).
 * Prefer computeCurveTimeDecayFactor / resolvePriorityTimeSignals when a curve is known.
 */
export function computeTimeDecayFactor(hoursUntilDeadline: number): number {
  return linearTimeDecayFactor(clampNonNeg(hoursUntilDeadline));
}

export function riskLevelFromStatePriority(priority: StatePriority): RiskLevel {
  return priority;
}

export function formatPriorityExplanation(result: PriorityContractResult): string {
  const parts = [
    `score=${result.priorityScore.toFixed(4)}`,
    `risk=${result.riskLevel}×${result.components.severity.toFixed(2)}`,
    result.components.usedTimeCurve && result.components.timeCurveType
      ? `time=${result.timeUrgency}×curve(${result.components.timeCurveType})${result.components.timeDecayFactor.toFixed(3)}`
      : `time=${result.timeUrgency}×decay${result.components.timeDecayFactor.toFixed(3)}`,
    `uncertainty=${result.components.uncertaintyContribution.toFixed(3)}`,
    `dependency=${result.components.dependencyContribution.toFixed(3)}`,
    `completion−${result.components.completionReduction.toFixed(3)}`,
  ];
  if (result.safetyOverride) {
    parts.unshift("SAFETY_OVERRIDE=CRITICAL×NOW");
  }
  return parts.join("; ");
}

function buildReasons(
  input: PriorityContractInput,
  components: PriorityComponentBreakdown,
  safetyOverride: boolean,
): string[] {
  const reasons: string[] = [];
  if (safetyOverride) {
    reasons.push(
      "Safety override: CRITICAL risk with NOW urgency — forced to top regardless of score",
    );
  }
  reasons.push(
    `Risk contribution ${components.riskContribution.toFixed(3)} (RiskWeight=${components.riskWeight} × Severity=${components.severity.toFixed(3)})`,
  );
  if (components.usedTimeCurve && components.timeCurveType) {
    reasons.push(
      `Time contribution ${components.timeContribution.toFixed(3)} (curve=${components.timeCurveType}; TimeUrgency=${components.timeUrgency} × CurveTimeDecay=${components.timeDecayFactor.toFixed(4)}; RiskOverTime=${(components.riskOverTime ?? 0).toFixed(3)})`,
    );
  } else {
    reasons.push(
      `Time contribution ${components.timeContribution.toFixed(3)} (TimeUrgency=${components.timeUrgency} × TimeDecayFactor=${components.timeDecayFactor.toFixed(4)})`,
    );
  }
  if (components.uncertaintyContribution > 0) {
    reasons.push(
      `Uncertainty contribution ${components.uncertaintyContribution.toFixed(3)} (${input.numberOfMissingCriticalFields ?? 0} critical gaps × ${UNCERTAINTY_FIELD_COEFFICIENT} × load ${components.missingInformationLoad.toFixed(3)})`,
    );
  }
  if (components.dependencyContribution > 0) {
    reasons.push(
      `Dependency contribution ${components.dependencyContribution.toFixed(3)} (${input.numberOfDependentSituations ?? 0} dependents × ${DEPENDENCY_SITUATION_COEFFICIENT} × impact ${components.downstreamImpact.toFixed(3)})`,
    );
  }
  if (components.completionReduction > 0) {
    reasons.push(
      `Completion reduces priority by ${components.completionReduction.toFixed(3)} (${input.completion})`,
    );
  } else if (input.completion === "ACTIVE") {
    reasons.push("Active situation — no completion reduction");
  }
  return reasons;
}

/**
 * Authoritative Priority Contract calculator — pure, deterministic.
 * Same inputs → same PriorityScore always.
 */
export function calculatePriorityContract(
  input: PriorityContractInput,
): PriorityContractResult {
  const severity = clamp01(input.severity ?? 1);
  const hours = clampNonNeg(input.hoursUntilDeadline ?? 0);
  const missingFields = Math.max(0, Math.floor(input.numberOfMissingCriticalFields ?? 0));
  const missingLoad = clampNonNeg(input.missingInformationLoad ?? 1);
  const dependents = Math.max(0, Math.floor(input.numberOfDependentSituations ?? 0));
  const downstream = clampNonNeg(input.downstreamImpact ?? 1);
  const resolutionProgress = clamp01(input.resolutionProgress ?? 1);

  const riskWeight = RISK_WEIGHT[input.riskLevel];

  // TIME WEIGHTING: curve path replaces linear decay; may reconcile TimeUrgency.
  let resolvedUrgencyKey: TimeUrgencyKey = input.timeUrgency;
  let timeDecayFactor: number;
  let usedTimeCurve = false;
  let timeCurveType: TimeCurveType | undefined;
  let riskOverTime: number | undefined;

  if (input.timeCurveType) {
    const resolved = resolvePriorityTimeSignals({
      curveType: input.timeCurveType,
      hoursUntilDeadline: hours,
      thresholds: input.timeThresholds,
      fallbackTimeUrgency: input.timeUrgency,
    });
    usedTimeCurve = true;
    timeCurveType = input.timeCurveType;
    timeDecayFactor = resolved.timeDecayFactor;
    riskOverTime = resolved.riskOverTime;
    if (!input.lockTimeUrgency) {
      resolvedUrgencyKey = resolved.timeUrgency;
    } else {
      timeDecayFactor = computeCurveTimeDecayFactor({
        curveType: input.timeCurveType,
        hoursUntilDeadline: hours,
        thresholds: input.timeThresholds,
        baseRisk: severity,
      });
    }
    // Keep RiskOverTime audit even when urgency locked.
    if (riskOverTime === undefined) {
      riskOverTime = computeRiskOverTime({
        baseRisk: riskWeight * severity,
        curveType: input.timeCurveType,
        hoursUntilDeadline: hours,
        thresholds: input.timeThresholds,
      }).riskOverTime;
    }
  } else {
    timeDecayFactor = computeTimeDecayFactor(hours);
  }

  const timeUrgency = TIME_URGENCY[resolvedUrgencyKey];
  const uncertaintyWeight = missingFields * UNCERTAINTY_FIELD_COEFFICIENT;
  const dependencyWeight = dependents * DEPENDENCY_SITUATION_COEFFICIENT;
  const completionFactor = COMPLETION_FACTOR[input.completion];

  const riskContribution = riskWeight * severity;
  const timeContribution = timeUrgency * timeDecayFactor;
  const uncertaintyContribution = uncertaintyWeight * missingLoad;
  const dependencyContribution = dependencyWeight * downstream;
  const completionReduction = resolutionProgress * completionFactor;

  const priorityScore =
    riskContribution +
    timeContribution +
    uncertaintyContribution +
    dependencyContribution -
    completionReduction;

  const safetyOverride =
    input.riskLevel === "CRITICAL" && resolvedUrgencyKey === "NOW";

  const components: PriorityComponentBreakdown = {
    riskWeight,
    severity,
    riskContribution,
    timeUrgency,
    timeDecayFactor,
    timeContribution,
    timeCurveType,
    riskOverTime,
    usedTimeCurve,
    uncertaintyWeight,
    missingInformationLoad: missingLoad,
    uncertaintyContribution,
    dependencyWeight,
    downstreamImpact: downstream,
    dependencyContribution,
    resolutionProgress,
    completionFactor,
    completionReduction,
  };

  return {
    situationId: input.situationId,
    priorityScore,
    safetyOverride,
    riskLevel: input.riskLevel,
    timeUrgency: resolvedUrgencyKey,
    completion: input.completion,
    components,
    reasons: buildReasons(
      { ...input, timeUrgency: resolvedUrgencyKey },
      components,
      safetyOverride,
    ),
  };
}

function comparePriorityResults(
  a: PriorityContractResult,
  b: PriorityContractResult,
): number {
  if (b.priorityScore !== a.priorityScore) {
    return b.priorityScore - a.priorityScore;
  }
  return a.situationId.localeCompare(b.situationId);
}

/**
 * Sort by PriorityScore DESC, then push CRITICAL×NOW overrides to top.
 * Deterministic tie-break on situationId.
 */
export function rankByPriorityContract(
  results: readonly PriorityContractResult[],
): PriorityContractRankResult {
  const scored = [...results].sort(comparePriorityResults);
  const overrides = scored.filter((r) => r.safetyOverride);
  const rest = scored.filter((r) => !r.safetyOverride);
  const ranked = [...overrides, ...rest];
  const rankedSituationIds = ranked.map((r) => r.situationId);
  return {
    ranked,
    rankedSituationIds,
    topSituationId: rankedSituationIds[0],
    overrideApplied: overrides.length > 0,
  };
}

/**
 * Calculate + rank a batch of situations under the Priority Contract.
 */
export function calculateAndRankSituations(
  inputs: readonly PriorityContractInput[],
): PriorityContractRankResult {
  const results = inputs.map(calculatePriorityContract);
  return rankByPriorityContract(results);
}

/**
 * Namespace API requested by contract:
 *   PriorityContract.calculate(situation)
 */
export const PriorityContract = {
  RISK_WEIGHT,
  TIME_URGENCY,
  COMPLETION_FACTOR,
  UNCERTAINTY_FIELD_COEFFICIENT,
  DEPENDENCY_SITUATION_COEFFICIENT,
  ONE_LINE: PRIORITY_CONTRACT_ONE_LINE,
  calculate: calculatePriorityContract,
  rank: rankByPriorityContract,
  calculateAndRank: calculateAndRankSituations,
  timeDecayFactor: computeTimeDecayFactor,
  /** Curve-derived TimeDecayFactor (TIME WEIGHTING MODEL). */
  curveTimeDecayFactor: computeCurveTimeDecayFactor,
  formatExplanation: formatPriorityExplanation,
  riskLevelFromStatePriority,
} as const;
