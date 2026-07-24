/**
 * Thin facade: Priority Engine situation scoring → PriorityContract.
 * Situations MUST use the Situation Priority Contract — never emotion,
 * preference, LLM, or UI visibility.
 */

import {
  PriorityContract,
  type PriorityContractInput,
  type PriorityContractResult,
  type PriorityContractRankResult,
  type RiskLevel,
  type TimeUrgencyKey,
  type CompletionLevel,
} from "../solenos-layers/derived/priority-contract";
import type { TrackedSituation } from "../resolution-engine/types";
import { filterSituationsForPriority } from "../resolution-engine/filters";
import type { TimeHorizonKey } from "../time-engine/types";
import { classifyTimeCurve, type TimeCurveType } from "../time-weighting";

export type TrackedSituationPriorityParams = {
  trackedSituations: readonly TrackedSituation[];
  /** Risk level per situation id — from STATE priority / risk register. */
  riskLevelBySituationId?: Readonly<Record<string, RiskLevel>>;
  /** Severity 0–1 per situation (e.g. adjustedRisk/100). */
  severityBySituationId?: Readonly<Record<string, number>>;
  /** Shared time horizon from Time Engine (objective). */
  timeUrgency?: TimeUrgencyKey;
  hoursUntilDeadline?: number;
  /** Missing critical field counts per situation. */
  missingCriticalBySituationId?: Readonly<Record<string, number>>;
  missingLoadBySituationId?: Readonly<Record<string, number>>;
  /** Care-context situation type for Time Weighting curve classification. */
  situationType?: string;
  /** Optional per-situation curve overrides. */
  timeCurveBySituationId?: Readonly<Record<string, TimeCurveType>>;
};

function horizonToTimeUrgency(horizon?: TimeHorizonKey | "UNSCHEDULED"): TimeUrgencyKey {
  if (horizon === "NOW") return "NOW";
  if (horizon === "SOON") return "SOON";
  if (horizon === "TODAY") return "TODAY";
  return "LATER";
}

function completionForTracked(s: TrackedSituation): CompletionLevel {
  if (s.status === "RESOLVED" || s.status === "ARCHIVED") return "RESOLVED";
  return "ACTIVE";
}

function defaultRiskLevel(title: string): RiskLevel {
  if (/discharge|emergency|critical|hospital/i.test(title)) return "CRITICAL";
  if (/medicat|anticoagul|dose|prescri/i.test(title)) return "HIGH";
  if (/comfort|bathroom|preference/i.test(title)) return "LOW";
  return "MEDIUM";
}

/**
 * Map ACTIVE tracked situations → Priority Contract inputs (objective only).
 * Applies TIME WEIGHTING curve classification per situation title.
 */
export function trackedSituationsToPriorityInputs(
  params: TrackedSituationPriorityParams,
): PriorityContractInput[] {
  const active = filterSituationsForPriority(params.trackedSituations);
  const timeUrgency = params.timeUrgency ?? "LATER";
  const hours = params.hoursUntilDeadline ?? 72;

  return active.map((s) => {
    const dependents = s.referencedBySituationIds?.length ?? 0;
    const unresolved = s.unresolvedDependencyIds?.length ?? 0;
    const riskLevel =
      params.riskLevelBySituationId?.[s.id] ?? defaultRiskLevel(s.title);
    const classified = classifyTimeCurve({
      text: s.title,
      situationType: params.situationType,
      riskLevel,
      explicitCurveType: params.timeCurveBySituationId?.[s.id],
    });
    return {
      situationId: s.id,
      riskLevel,
      severity: params.severityBySituationId?.[s.id] ?? 1,
      timeUrgency,
      hoursUntilDeadline: hours,
      timeCurveType: classified.curveType,
      timeThresholds: classified.thresholds,
      numberOfMissingCriticalFields:
        params.missingCriticalBySituationId?.[s.id] ?? 0,
      missingInformationLoad: params.missingLoadBySituationId?.[s.id] ?? 1,
      numberOfDependentSituations: dependents,
      downstreamImpact: 1 + unresolved * 0.1,
      completion: completionForTracked(s),
      resolutionProgress: 1,
    } satisfies PriorityContractInput;
  });
}

/**
 * Sole situation-ranking path for Priority Engine facade.
 * Delegates entirely to PriorityContract.calculate / rank.
 */
export function rankSituationsViaPriorityContract(
  params: TrackedSituationPriorityParams,
): PriorityContractRankResult {
  const inputs = trackedSituationsToPriorityInputs(params);
  return PriorityContract.calculateAndRank(inputs);
}

export function scoreSituationViaPriorityContract(
  input: PriorityContractInput,
): PriorityContractResult {
  return PriorityContract.calculate(input);
}

export { horizonToTimeUrgency, PriorityContract };
