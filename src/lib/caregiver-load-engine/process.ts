import type { HighSignalStressPatternResult } from "../caregiver-psychological-load/types";
import type { InteractionLoadSignalResult } from "../interaction-load-signal/types";
import {
  evaluateLoadFirstMode,
  deriveActionReduction,
} from "./action-reduction";
import { computeBurnoutRisk } from "./burnout-risk";
import {
  buildBurdenMessages,
  buildBurdenSummary,
  buildPrimaryContributors,
} from "./burden-messages";
import { detectLoadSignalFamilies } from "./detect-signals";
import { inferDependencyStage } from "./dementia-context";
import { runCaregiverLoadEngineGuarantee } from "./guarantee";
import { scoreLoadDimensions } from "./score-loads";
import type {
  CaregiverLoadEngineLayerPayload,
  CaregiverLoadEngineLoadInterpretation,
  CaregiverLoadEngineResult,
  CaregiverState,
} from "./types";

export type ProcessCaregiverLoadEngineParams = {
  rawInput: string;
  highSignalStress?: HighSignalStressPatternResult;
  interactionLoadLayer?: InteractionLoadSignalResult;
  emotionalBurnoutProbability?: number;
};

export function buildCaregiverState(params: ProcessCaregiverLoadEngineParams): CaregiverState {
  const signals = detectLoadSignalFamilies(params.rawInput);
  const scores = scoreLoadDimensions(signals);
  const dependencyStage = inferDependencyStage({
    rawInput: params.rawInput,
    dependencyLoadScore: scores.dependencyLoadScore,
  });

  const acuteBurnoutTriggered =
    params.highSignalStress?.acuteCaregiverBurnoutRiskState === true;

  const burnout = computeBurnoutRisk({
    scores,
    burnoutLanguageSignal: signals.burnoutLanguage,
    acuteBurnoutTriggered,
    emotionalBurnoutProbability: params.emotionalBurnoutProbability,
  });

  const primaryContributors = buildPrimaryContributors(scores);
  const loadFirstMode = evaluateLoadFirstMode(
    scores,
    burnout.probability,
    signals.matchedFamilies.length,
  );

  const burdenStatements = buildBurdenMessages({
    scores,
    burnoutProbability: burnout.probability,
    burnoutTrend: burnout.trend,
    dependencyStage,
    primaryContributors,
  });

  const actionReduction = deriveActionReduction({
    scores,
    loadFirstMode,
    burnoutProbability: burnout.probability,
    acuteBurnoutTriggered,
    interactionLoadDetected: params.interactionLoadLayer?.detected,
    sleepProtectionEngaged: params.interactionLoadLayer?.sleepProtectionMode.engaged,
  });

  return {
    scores,
    burnout,
    loadFirstMode,
    burdenStatements,
    primaryContributors,
    actionReduction,
    dependencyStage,
    signals,
  };
}

function toLoadInterpretation(state: CaregiverState): CaregiverLoadEngineLoadInterpretation {
  return {
    emotionalLoadScore: state.scores.emotionalLoadScore,
    sleepRisk: state.scores.sleepRiskScore / 100,
    burnoutProbability: state.burnout.probability,
    uncertaintyIndex: state.scores.uncertaintyIndex,
    primaryContributors: [...state.primaryContributors],
    burdenSummary: buildBurdenSummary(state.burdenStatements),
    loadFirstMode: state.loadFirstMode,
  };
}

/**
 * Master product module — early pipeline pass after input classification.
 */
export function processCaregiverLoadEngine(
  params: ProcessCaregiverLoadEngineParams,
): CaregiverLoadEngineResult {
  const state = buildCaregiverState(params);
  const loadInterpretation = toLoadInterpretation(state);
  const result: CaregiverLoadEngineResult = {
    state,
    loadInterpretation,
    guarantee: { ok: true, violations: [] },
  };
  result.guarantee = runCaregiverLoadEngineGuarantee(result);
  return result;
}

export function toCaregiverLoadEngineLayerPayload(
  result: CaregiverLoadEngineResult,
): CaregiverLoadEngineLayerPayload {
  const { state, loadInterpretation } = result;
  return {
    cognitiveLoadScore: state.scores.cognitiveLoadScore,
    emotionalLoadScore: state.scores.emotionalLoadScore,
    sleepRiskScore: state.scores.sleepRiskScore,
    uncertaintyIndex: state.scores.uncertaintyIndex,
    dependencyLoadScore: state.scores.dependencyLoadScore,
    burnoutProbability: state.burnout.probability,
    burnoutTrend: state.burnout.trend,
    burnoutTier: state.burnout.tier,
    acuteBurnoutTriggered: state.burnout.acuteTriggered,
    loadFirstMode: state.loadFirstMode,
    burdenSummary: loadInterpretation.burdenSummary,
    primaryContributors: [...state.primaryContributors],
    dependencyStage: state.dependencyStage,
    maxActions: state.actionReduction.maxActions,
  };
}

export function formatCaregiverLoadEngineObservation(
  result: CaregiverLoadEngineResult,
): string {
  const s = result.state.scores;
  return `OBSERVATION: CAREGIVER_LOAD_ENGINE emotional=${s.emotionalLoadScore} cognitive=${s.cognitiveLoadScore} sleep=${s.sleepRiskScore} uncertainty=${s.uncertaintyIndex.toFixed(2)} dependency=${s.dependencyLoadScore} burnout=${result.state.burnout.probability.toFixed(2)} loadFirst=${result.state.loadFirstMode}`;
}
