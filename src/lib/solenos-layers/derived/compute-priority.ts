import { HIGH_MISSING_INFO_CONFIDENCE_CAP } from "../contract-constants";

import { computeBeliefInfluence } from "../belief/influence";

import type { ConflictBeliefInput } from "../belief/influence";

import type {

  BeliefItem,

  DerivedPriorityResult,

  DerivedRiskResult,

  StateSituation,

} from "../types";

import {

  computePressureScore,

  rankDemandsByPressure,

} from "./compute-demand-pressure";

import type { Demand } from "../../demand-engine/types";

import {

  PriorityContract,

  type CompletionLevel,

  type PriorityContractInput,

  type PriorityContractResult,

  type RiskLevel,

  type TimeUrgencyKey,

  formatPriorityExplanation,

  riskLevelFromStatePriority,

} from "./priority-contract";

import {

  classifyTimeCurve,

  type TimeCurveType,

  type TimeThresholds,

} from "../../time-weighting";



/** Minimal demand shape for priority ranking (STATE + derived pressure). */

export type PriorityDemandInput = {

  id: string;

  status: string;

  urgency: number;

  riskImpact: number;

  uncertainty: number;

  emotionalLoad: number;

  effort?: number;

  pressureScore?: number;

};



/**

 * Optional per-situation temporal / dependency / completion signals.

 * When omitted, defaults are derived objectively from STATE + BELIEF only

 * (never preference or emotion).

 */

export type SituationPrioritySignal = {

  situationId: string;

  timeUrgency?: TimeUrgencyKey;

  hoursUntilDeadline?: number;

  numberOfDependentSituations?: number;

  downstreamImpact?: number;

  completion?: CompletionLevel;

  resolutionProgress?: number;

  /** Override severity 0–1; otherwise from derived risk when available. */

  severity?: number;

  riskLevel?: RiskLevel;

  /** TIME WEIGHTING: explicit curve class (skips classifier when set). */

  timeCurveType?: TimeCurveType;

  /** Optional safe/warning/critical hour thresholds. */

  timeThresholds?: Partial<TimeThresholds>;

  /** Care-context situationType for curve classification. */

  situationType?: string;

  /** Demand category for curve classification. */

  demandCategory?: string;

  /** When true, keep signal timeUrgency even if curve zone remaps it. */

  lockTimeUrgency?: boolean;

};



export type ComputePriorityParams = {

  situations: readonly StateSituation[];

  beliefs: readonly BeliefItem[];

  risk?: DerivedRiskResult;

  /** Optional candidate action ids — when omitted, returns clarification-first. */

  candidateActionIds?: readonly string[];

  /**

   * When provided, Priority ranks **demands** (by pressureScore), not situations.

   * Effort is ignored in pressure.

   */

  demands?: readonly PriorityDemandInput[];

  /** Optional OBJECTIVE signals (time / dependency / completion) per situation. */

  situationSignals?: readonly SituationPrioritySignal[];

  /** Optional Conflict Detection soft influence (modulates BELIEF confidence only). */

  conflictBelief?: ConflictBeliefInput | null;

};



function completionFromSituation(s: StateSituation): CompletionLevel {

  if (s.status === "resolved" || s.status === "archived") return "RESOLVED";

  if (s.actionStatus === "completed") return "PARTIAL";

  if (s.actionStatus === "pending" || s.actionStatus === "blocked") return "ACTIVE";

  return "ACTIVE";

}



function countMissingCriticalFields(

  beliefs: readonly BeliefItem[],

  situationId: string,

): number {

  return beliefs.filter(

    (b) =>

      b.situationId === situationId &&

      b.type === "missing_information" &&

      b.status === "active" &&

      b.importance === "HIGH",

  ).length;

}



function missingInformationLoadForSituation(

  beliefs: readonly BeliefItem[],

  situationId: string,

): number {

  const open = beliefs.filter(

    (b) =>

      b.situationId === situationId &&

      b.type === "missing_information" &&

      b.status === "active" &&

      b.importance === "HIGH",

  );

  if (open.length === 0) return 1;

  const gap =

    open.reduce((acc, b) => acc + (1 - Math.max(0, Math.min(1, b.confidence))), 0) /

    open.length;

  // Load stays near 1; modest boost from low-confidence gaps (not emotion).

  return 1 + gap;

}



/**

 * Build Priority Contract inputs from STATE + BELIEF (+ optional objective signals).

 */

export function buildPriorityContractInputs(params: {

  situations: readonly StateSituation[];

  beliefs: readonly BeliefItem[];

  risk?: DerivedRiskResult;

  situationSignals?: readonly SituationPrioritySignal[];

}): PriorityContractInput[] {

  const signalById = new Map(

    (params.situationSignals ?? []).map((s) => [s.situationId, s]),

  );



  return params.situations.map((s) => {

    const signal = signalById.get(s.id);

    const sitRisk = params.risk?.situationRisks.find((r) => r.situationId === s.id);

    const severity =

      signal?.severity ??

      (sitRisk !== undefined ? Math.max(0, Math.min(1, sitRisk.adjustedRisk / 100)) : 1);

    const riskLevel =

      signal?.riskLevel ?? riskLevelFromStatePriority(s.priority);

    const classified = classifyTimeCurve({
      text: s.summary,
      situationType: signal?.situationType,
      demandCategory: signal?.demandCategory,
      riskLevel,
      explicitCurveType: signal?.timeCurveType,
    });

    return {

      situationId: s.id,

      riskLevel,

      severity,

      timeUrgency: signal?.timeUrgency ?? "LATER",

      hoursUntilDeadline: signal?.hoursUntilDeadline ?? 72,

      timeCurveType: classified.curveType,

      timeThresholds: signal?.timeThresholds ?? classified.thresholds,

      lockTimeUrgency: signal?.lockTimeUrgency,

      numberOfMissingCriticalFields: countMissingCriticalFields(params.beliefs, s.id),

      missingInformationLoad: missingInformationLoadForSituation(params.beliefs, s.id),

      numberOfDependentSituations: signal?.numberOfDependentSituations ?? 0,

      downstreamImpact: signal?.downstreamImpact ?? 1,

      completion: signal?.completion ?? completionFromSituation(s),

      resolutionProgress: signal?.resolutionProgress ?? 1,

    } satisfies PriorityContractInput;

  });

}



/**

 * Priority = PriorityContract.calculate — deterministic pure function over State + Belief.

 * HIGH importance missing_information beliefs block high-confidence irreversible decisions.

 * When demands are supplied, rankedDemandIds are ordered by cognitive pressure.

 * Situation ranking NEVER uses emotion, preference, LLM, or UI visibility.

 */

export function computePriority(params: ComputePriorityParams): DerivedPriorityResult {

  const influence = computeBeliefInfluence(params.beliefs, params.conflictBelief);

  const risk = params.risk ?? {

    situationRisks: [],

    systemRiskExposure: 0,

    overload: false,

  };



  const contractInputs = buildPriorityContractInputs({

    situations: params.situations,

    beliefs: params.beliefs,

    risk,

    situationSignals: params.situationSignals,

  });

  const situationRank = PriorityContract.calculateAndRank(contractInputs);

  const situationScores: PriorityContractResult[] = [...situationRank.ranked];



  let rankedDemandIds: string[] | undefined;

  let topDemandId: string | undefined;



  if (params.demands && params.demands.length > 0) {

    const active = params.demands

      .filter((d) => d.status === "pending" || d.status === "in_progress")

      .map((d) => {

        const pressureScore =

          d.pressureScore ??

          computePressureScore({

            urgency: d.urgency,

            riskImpact: d.riskImpact,

            uncertainty: d.uncertainty,

            emotionalLoad: d.emotionalLoad,

            effort: d.effort,

          });

        return {

          id: d.id,

          situationId: "",

          title: d.id,

          description: "",

          category: "monitoring" as const,

          status: d.status as Demand["status"],

          urgency: d.urgency,

          riskImpact: d.riskImpact,

          effort: d.effort ?? 0,

          emotionalLoad: d.emotionalLoad,

          uncertainty: d.uncertainty,

          pressureScore,

          createdAt: "",

        } satisfies Demand;

      });

    const ranked = rankDemandsByPressure(active);

    rankedDemandIds = ranked.map((d) => d.id);

    topDemandId = rankedDemandIds[0];

  }



  const candidates = [

    ...(params.candidateActionIds ??

      (topDemandId ? [topDemandId] : ["clarify_before_action"])),

  ];



  const topSituationBoost = situationRank.topSituationId;

  const overrideBoost = situationRank.overrideApplied ? 0.5 : 0;



  const scored = candidates.map((actionId, index) => {

    let score = 1 - index * 0.05;

    if (influence.highMissingInfoBlocked || influence.criticalConflictBlocked) {
      const irreversible =
        /medical|financial|irreversible|aggressive|critical/i.test(actionId);
      if (irreversible || influence.criticalConflictBlocked) {
        score *= 0.45;
      } else if (actionId.includes("clarify") || actionId.includes("confirm")) {
        score += 0.35;
      }
    }
    score -= influence.conflictConfidencePenalty * 0.35

    score += risk.systemRiskExposure / 500;

    score -= influence.missingInfoConfidencePenalty * 0.3;

    if (topDemandId && actionId === topDemandId) {

      score += 0.4;

    }

    // Prefer actions that target the Priority-Contract top situation when encoded in id.

    if (topSituationBoost && actionId.includes(topSituationBoost)) {

      score += 0.25 + overrideBoost;

    }

    return { actionId, score };

  });



  scored.sort((a, b) => {

    if (b.score !== a.score) return b.score - a.score;

    return a.actionId.localeCompare(b.actionId);

  });



  const rankedActionIds = scored.map((s) => s.actionId);

  const explanationLines = situationScores.map(

    (r) => `${r.situationId}: ${formatPriorityExplanation(r)}`,

  );



  return {

    rankedActionIds,

    topActionId: rankedActionIds[0] ?? "clarify_before_action",

    highMissingInfoBlocked: influence.highMissingInfoBlocked,
    criticalConflictBlocked: influence.criticalConflictBlocked,
    confidenceCap:
      influence.highMissingInfoBlocked || influence.criticalConflictBlocked
        ? HIGH_MISSING_INFO_CONFIDENCE_CAP
        : undefined,

    rankedDemandIds,

    topDemandId,

    rankedSituationIds: situationRank.rankedSituationIds,

    topSituationId: situationRank.topSituationId,

    situationScores,

    priorityOverrideApplied: situationRank.overrideApplied,

    explanationLines,

  };

}


