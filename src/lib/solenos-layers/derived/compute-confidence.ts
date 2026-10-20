import type { BeliefItem } from "../types";
import type { CrisisRisk } from "./compute-crisis-risks";
import type { CaregiverLoadState } from "../../caregiver-load-index/types";
import type { Demand } from "../../demand-engine/types";

export type ConfidenceState = {
  /** Internal 0–100 reassurance index — never surface as caregiving confidence % in UI. */
  confidence: number;
  missingCriticalActions: number;
  unresolvedHighRiskSituations: number;
  explanation: string;
};

export type ComputeConfidenceInputs = {
  demands: readonly Demand[];
  activeSituations: readonly {
    id: string;
    title: string;
    priority?: string;
    status: string;
  }[];
  beliefs: readonly BeliefItem[];
  caregiverLoadState: CaregiverLoadState;
  caregiverLoadScore?: number;
  emotionalBurnoutProbability?: number;
  conflictConfidencePenalty?: number;
  openConflictCount?: number;
  criticalUnassignedCount?: number;
  overdueResponsibilityCount?: number;
  failSafeEngaged?: boolean;
  crisisRisks?: readonly CrisisRisk[];
  completedCriticalToday?: number;
};

function clamp0100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function countMissingCriticalActions(
  demands: readonly Demand[],
  criticalUnassigned: number,
  overdue: number,
): number {
  const overdueCritical = demands.filter(
    (d) =>
      (d.status === "pending" || d.status === "in_progress") &&
      d.pressureScore >= 70 &&
      d.dueDate &&
      new Date(d.dueDate).getTime() < Date.now(),
  ).length;
  const highPressureOpen = demands.filter(
    (d) =>
      (d.status === "pending" || d.status === "in_progress") &&
      d.pressureScore >= 80,
  ).length;
  return criticalUnassigned + overdue + overdueCritical + Math.max(0, highPressureOpen - 1);
}

function countUnresolvedHighRisk(
  situations: ComputeConfidenceInputs["activeSituations"],
): number {
  return situations.filter((s) => {
    const p = (s.priority ?? "MEDIUM").toUpperCase();
    return (
      (s.status === "ACTIVE" || s.status === "active") &&
      (p === "HIGH" || p === "CRITICAL")
    );
  }).length;
}

function avgBeliefUncertainty(beliefs: readonly BeliefItem[]): number {
  const active = beliefs.filter((b) => b.status === "active");
  if (active.length === 0) return 0;
  const sum = active.reduce((acc, b) => acc + (1 - b.confidence), 0);
  return sum / active.length;
}

function buildConfidenceExplanation(params: {
  confidence: number;
  missingCritical: number;
  unresolvedHighRisk: number;
  completedCritical: number;
  crisisCount: number;
  loadState: CaregiverLoadState;
  failSafeEngaged: boolean;
}): string {
  if (params.failSafeEngaged) {
    return "SolenOS paused because critical details are still missing — clarifying first is the right call, not a sign you fell behind.";
  }

  if (
    params.completedCritical >= 3 &&
    params.missingCritical === 0 &&
    params.unresolvedHighRisk === 0
  ) {
    return "You have completed the three highest-risk actions today.";
  }

  if (params.missingCritical === 0 && params.unresolvedHighRisk === 0) {
    if (params.crisisCount > 0) {
      return "No critical actions are currently overdue. A few items may need attention later, but nothing urgent is slipping right now.";
    }
    return "No critical actions are currently overdue.";
  }

  if (params.missingCritical > 0 && params.unresolvedHighRisk === 0) {
    return params.missingCritical === 1
      ? "One high-pressure item still needs attention, but you are not behind on the most dangerous risks."
      : `${params.missingCritical} important items still need attention, but the remaining work is manageable.`;
  }

  if (params.loadState === "HIGH" || params.loadState === "CRITICAL") {
    return "Several care demands are open in the record — focus on what reduces harm first.";
  }

  if (params.confidence >= 70) {
    return "The remaining items are important but not urgent.";
  }

  if (params.unresolvedHighRisk > 0) {
    return `${params.unresolvedHighRisk} high-risk situation${params.unresolvedHighRisk > 1 ? "s" : ""} still need resolution — address those before lower-priority tasks.`;
  }

  return "You are keeping up with what matters most right now.";
}

/**
 * DERIVED — internal reassurance index over STATE + BELIEF + crisis signals.
 * Not a Care Understanding Confidence screen / score for caregivers (FUTURE capability).
 * Reassures ("Am I doing enough?") — never replaces priority ranking.
 */
export function computeConfidenceState(inputs: ComputeConfidenceInputs): ConfidenceState {
  const missingCriticalActions = countMissingCriticalActions(
    inputs.demands,
    inputs.criticalUnassignedCount ?? 0,
    inputs.overdueResponsibilityCount ?? 0,
  );
  const unresolvedHighRiskSituations = countUnresolvedHighRisk(inputs.activeSituations);

  const completedCritical =
    inputs.completedCriticalToday ??
    inputs.demands.filter(
      (d) =>
        d.status === "completed" &&
        d.pressureScore >= 70 &&
        d.completedAt &&
        new Date(d.completedAt).toDateString() === new Date().toDateString(),
    ).length;

  let score = 82;

  score += Math.min(12, completedCritical * 4);
  score -= missingCriticalActions * 7;
  score -= unresolvedHighRiskSituations * 6;

  const loadPenalty: Record<CaregiverLoadState, number> = {
    LOW: 0,
    MODERATE: 4,
    HIGH: 12,
    CRITICAL: 22,
  };
  score -= loadPenalty[inputs.caregiverLoadState] ?? 0;

  const uncertainty = avgBeliefUncertainty(inputs.beliefs);
  score -= uncertainty * 18;

  const conflictPenalty = inputs.conflictConfidencePenalty ?? 0;
  score -= conflictPenalty * 28;
  score -= (inputs.openConflictCount ?? 0) * 3;

  const crisisProbSum = (inputs.crisisRisks ?? [])
    .slice(0, 3)
    .reduce((acc, r) => acc + r.probability, 0);
  score -= Math.min(25, crisisProbSum * 30);

  const burnout = inputs.emotionalBurnoutProbability ?? 0;
  score -= burnout * 15;

  if (inputs.failSafeEngaged) {
    score = Math.min(score, 42);
  }

  const confidence = clamp0100(score);
  const explanation = buildConfidenceExplanation({
    confidence,
    missingCritical: missingCriticalActions,
    unresolvedHighRisk: unresolvedHighRiskSituations,
    completedCritical,
    crisisCount: inputs.crisisRisks?.length ?? 0,
    loadState: inputs.caregiverLoadState,
    failSafeEngaged: inputs.failSafeEngaged ?? false,
  });

  return {
    confidence,
    missingCriticalActions,
    unresolvedHighRiskSituations,
    explanation,
  };
}
