import {
  BURNOUT_FORMULA_WEIGHTS,
  COGNITIVE_FATIGUE_BANDS,
  RECOVERY_TIME_STUB_MINUTES,
  STRESS_INDICATOR_WEIGHTS,
} from "./contract-constants";
import type {
  BurnoutProbability,
  CognitiveFatigue,
  CognitiveFatigueLevel,
  EmotionalLoadSignal,
  EmotionalLoadSignalInputs,
  RecoveryTimeEstimate,
  SituationEmotionalLoadContribution,
  StressIndicators,
} from "./types";

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, Math.round(n * 1000) / 1000));
}

export function clamp100(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n * 100) / 100));
}

/**
 * Stress indicators from invisible behavioral signals — not self-report.
 */
export function computeStressIndicators(input: EmotionalLoadSignalInputs): StressIndicators {
  const switchingBase = input.activeSituationCount + input.unresolvedSituationCount * 0.6;
  const situationSwitching = clamp100(
    Math.min(100, switchingBase * 14 + (input.unresolvedSituationCount > 2 ? 20 : 0)),
  );

  const urgencyRatio =
    input.activeDemandCount > 0
      ? input.highUrgencyDemandCount / input.activeDemandCount
      : 0;
  const highUrgencyClustering = clamp100(
    input.highPressureDemandCount * 12 +
      input.highUrgencyDemandCount * 10 +
      urgencyRatio * 35,
  );

  const unresolvedConflicts = clamp100(
    input.pendingConflictCount * 22 +
      input.conflictLoad * 0.55 +
      (input.conflictLoad > 50 ? 15 : 0),
  );

  const escalatingNotifications = clamp100(
    input.highPressureDemandCount * 15 +
      Math.max(0, input.activeDemandCount - 3) * 8 +
      input.uncertaintyLoad * 0.12,
  );

  const interruptionFrequency = clamp100(
    input.activeDemandCount * 10 +
      input.activeSituationCount * 8 +
      input.highPressureDemandCount * 6,
  );

  const w = STRESS_INDICATOR_WEIGHTS;
  const composite = clamp100(
    situationSwitching * w.situationSwitching +
      highUrgencyClustering * w.highUrgencyClustering +
      unresolvedConflicts * w.unresolvedConflicts +
      escalatingNotifications * w.escalatingNotifications +
      interruptionFrequency * w.interruptionFrequency,
  );

  return {
    situationSwitching,
    highUrgencyClustering,
    unresolvedConflicts,
    escalatingNotifications,
    interruptionFrequency,
    composite,
  };
}

export function computeBurnoutProbability(
  stress: StressIndicators,
  input: EmotionalLoadSignalInputs,
): BurnoutProbability {
  const w = BURNOUT_FORMULA_WEIGHTS;
  const value = clamp01(
    (stress.composite / 100) * w.stressComposite +
      (input.operationalLoadScore / 100) * w.operationalLoad +
      input.emotionalBias * w.emotionalBias +
      input.depletionFactor * w.depletionFactor +
      (input.conflictLoad / 100) * w.conflictLoad +
      (stress.situationSwitching / 100) * w.situationSwitching,
  );

  const contributors: string[] = [];
  if (stress.composite >= 55) contributors.push(`elevated stress composite (${stress.composite.toFixed(0)})`);
  if (input.operationalLoadScore >= 51) {
    contributors.push(`operational load ${input.operationalLoadScore.toFixed(0)}/100`);
  }
  if (input.emotionalBias >= 0.25) contributors.push(`memory emotional bias ${input.emotionalBias.toFixed(2)}`);
  if (input.depletionFactor >= 0.45) contributors.push("behavioral depletion signals");
  if (input.conflictLoad >= 40) contributors.push(`conflict load ${input.conflictLoad.toFixed(0)}/100`);
  if (stress.situationSwitching >= 50) contributors.push("frequent situation switching");

  const reasoning =
    contributors.length > 0
      ? `Burnout probability ${(value * 100).toFixed(0)}% driven by: ${contributors.slice(0, 3).join("; ")}.`
      : `Burnout probability ${(value * 100).toFixed(0)}% — load within manageable behavioral range.`;

  return { value, reasoning };
}

export function classifyCognitiveFatigue(compositeScore: number): CognitiveFatigueLevel {
  const s = clamp100(compositeScore);
  if (s <= COGNITIVE_FATIGUE_BANDS.LOW.max) return "LOW";
  if (s <= COGNITIVE_FATIGUE_BANDS.MEDIUM.max) return "MEDIUM";
  if (s <= COGNITIVE_FATIGUE_BANDS.HIGH.max) return "HIGH";
  return "CRITICAL";
}

export function buildCognitiveFatigueExplanation(
  level: CognitiveFatigueLevel,
  stress: StressIndicators,
): string {
  switch (level) {
    case "LOW":
      return "Cognitive capacity appears sufficient for current demand load.";
    case "MEDIUM":
      return `Moderate fatigue from ${stress.interruptionFrequency >= 40 ? "interruption frequency" : "clustered demands"} — simplify where possible.`;
    case "HIGH":
      return `High fatigue — limit to 1–2 actions, avoid branching; stress composite ${stress.composite.toFixed(0)}/100.`;
    case "CRITICAL":
      return `Critical fatigue — protect caregiver stability; max 1 simple action, defer non-critical tasks.`;
    default:
      return "Cognitive fatigue assessed from behavioral signals.";
  }
}

export function computeSituationContributions(
  input: EmotionalLoadSignalInputs,
  stress: StressIndicators,
): SituationEmotionalLoadContribution[] {
  const bySituation = input.demandsBySituation ?? {};
  const entries = Object.entries(bySituation);
  if (entries.length === 0) {
    return [
      {
        situationId: "global",
        loadScore: stress.composite,
        primaryDriver: "interruption",
        demandCount: input.activeDemandCount,
        unresolvedConflictWeight: input.pendingConflictCount,
      },
    ];
  }

  return entries
    .map(([situationId, stats]) => {
      const urgencyAvg =
        stats.demandCount > 0 ? stats.urgencySum / stats.demandCount : 0;
      const loadScore = clamp100(
        stats.demandCount * 8 +
          stats.highPressure * 18 +
          urgencyAvg * 0.35 +
          input.pendingConflictCount * 4,
      );

      let primaryDriver: SituationEmotionalLoadContribution["primaryDriver"] = "interruption";
      const drivers: [SituationEmotionalLoadContribution["primaryDriver"], number][] = [
        ["urgency_cluster", stats.highPressure * 20 + urgencyAvg * 0.3],
        ["conflict", input.pendingConflictCount * 15],
        ["notifications", stats.highPressure * 12],
        ["interruption", stats.demandCount * 10],
        ["switching", input.unresolvedSituationCount * 8],
        ["uncertainty", input.uncertaintyLoad * 0.2],
      ];
      drivers.sort((a, b) => b[1] - a[1]);
      primaryDriver = drivers[0]?.[0] ?? "interruption";

      return {
        situationId,
        loadScore,
        primaryDriver,
        demandCount: stats.demandCount,
        unresolvedConflictWeight: input.pendingConflictCount,
      };
    })
    .sort((a, b) => b.loadScore - a.loadScore);
}

/** Recovery time modeling stub — decays after resolution (not persisted). */
export function estimateRecoveryTime(level: CognitiveFatigueLevel): RecoveryTimeEstimate {
  const estimatedMinutes = RECOVERY_TIME_STUB_MINUTES[level];
  return {
    estimatedMinutes,
    level,
    note: `Stub: expect ~${estimatedMinutes}min recovery after resolving primary stress driver (not persisted).`,
  };
}

/**
 * Composite emotional load score blends stress, operational load, and emotional bias.
 */
export function computeCompositeEmotionalScore(
  stress: StressIndicators,
  input: EmotionalLoadSignalInputs,
  burnout: BurnoutProbability,
): number {
  return clamp100(
    stress.composite * 0.45 +
      input.operationalLoadScore * 0.3 +
      input.emotionalBias * 100 * 0.15 +
      burnout.value * 100 * 0.1,
  );
}

export function computeEmotionalLoadSignal(
  input: EmotionalLoadSignalInputs,
  nowIso = new Date().toISOString(),
): EmotionalLoadSignal {
  const stressIndicators = computeStressIndicators(input);
  const burnoutProbability = computeBurnoutProbability(stressIndicators, input);
  const compositeScore = computeCompositeEmotionalScore(
    stressIndicators,
    input,
    burnoutProbability,
  );
  const level = classifyCognitiveFatigue(compositeScore);
  const cognitiveFatigue: CognitiveFatigue = {
    level,
    explanation: buildCognitiveFatigueExplanation(level, stressIndicators),
  };
  const perSituation = computeSituationContributions(input, stressIndicators);
  const recoveryTimeEstimate = estimateRecoveryTime(level);

  return {
    stressIndicators,
    burnoutProbability,
    cognitiveFatigue,
    compositeScore,
    perSituation,
    recoveryTimeEstimate,
    updatedAt: nowIso,
  };
}
