/**
 * verify-emotional-load-signal.mts
 * Asserts Emotional Load Signal v1.0: formulas, protection mode, pipeline wiring.
 */

import fs from "node:fs";
import path from "node:path";

import {
  BURNOUT_FORMULA_WEIGHTS,
  BURNOUT_PROTECTION_THRESHOLD,
  COGNITIVE_FATIGUE_BANDS,
  EMOTIONAL_LOAD_SIGNAL_FORBIDDEN,
  EMOTIONAL_LOAD_SIGNAL_IDENTITY,
  EMOTIONAL_LOAD_SIGNAL_ONE_LINE_TRUTH,
  EMOTIONAL_LOAD_SIGNAL_PIPELINE_POSITION,
  FATIGUE_SURFACE_LIMITS,
  STRESS_INDICATOR_WEIGHTS,
  applyPostDecisionEmotionalLoad,
  classifyCognitiveFatigue,
  computeBurnoutProbability,
  computeEmotionalLoadSignal,
  computeLoadAwarePriorityAdjustment,
  computeRecommendationLoadMetadata,
  computeStressIndicators,
  evaluateCaregiverProtectionMode,
  processEmotionalLoadSignalLayer,
} from "../src/lib/emotional-load-signal";
import { FACADE_DEPRECATION, LAYER_ARCHITECTURE_MAP } from "../src/lib/solenos-layers";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Emotional Load Signal (v1.0) ===\n");

assert(
  EMOTIONAL_LOAD_SIGNAL_IDENTITY.includes("invisible caregiver stress"),
  "identity",
);
assert(
  EMOTIONAL_LOAD_SIGNAL_ONE_LINE_TRUTH.includes("derived function"),
  "derived truth",
);
assert(
  EMOTIONAL_LOAD_SIGNAL_PIPELINE_POSITION.includes("EMOTIONAL LOAD SIGNAL ENGINE"),
  "pipeline position",
);
assert(
  EMOTIONAL_LOAD_SIGNAL_FORBIDDEN.some((f) => f.includes("competing persistent")),
  "forbids competing engine",
);
console.log("✓ contract constants");

assert(STRESS_INDICATOR_WEIGHTS.situationSwitching === 0.22, "switching weight");
assert(BURNOUT_FORMULA_WEIGHTS.stressComposite === 0.2, "burnout stress weight");
assert(BURNOUT_PROTECTION_THRESHOLD === 0.65, "protection threshold");
assert(FATIGUE_SURFACE_LIMITS.CRITICAL === 1, "CRITICAL fatigue = 1 action");
assert(FATIGUE_SURFACE_LIMITS.HIGH === 2, "HIGH fatigue = 2 actions");
console.log("✓ formula weights + fatigue limits");

const baseInput = {
  activeSituationCount: 3,
  unresolvedSituationCount: 2,
  activeDemandCount: 5,
  highPressureDemandCount: 2,
  highUrgencyDemandCount: 3,
  pendingConflictCount: 1,
  uncertaintyLoad: 45,
  conflictLoad: 35,
  operationalLoadScore: 58,
  emotionalBias: 0.28,
  depletionFactor: 0.55,
  demandsBySituation: {
    "sit-1": { demandCount: 3, highPressure: 1, urgencySum: 210 },
    "sit-2": { demandCount: 2, highPressure: 1, urgencySum: 140 },
  },
};

const stress = computeStressIndicators(baseInput);
assert(stress.composite >= 0 && stress.composite <= 100, "stress composite 0–100");
assert(stress.situationSwitching > 0, "situation switching > 0");
assert(stress.highUrgencyClustering > 0, "urgency clustering > 0");

const burnout = computeBurnoutProbability(stress, baseInput);
assert(burnout.value >= 0 && burnout.value <= 1, "burnout 0–1");
assert(burnout.reasoning.length > 10, "burnout reasoning");

const signal = computeEmotionalLoadSignal(baseInput);
assert(signal.perSituation.length >= 2, "per-situation contributions");
assert(signal.recoveryTimeEstimate.estimatedMinutes > 0, "recovery stub");
console.log("✓ stress + burnout + per-situation + recovery stub");

assert(classifyCognitiveFatigue(0) === "LOW", "0 LOW");
assert(classifyCognitiveFatigue(COGNITIVE_FATIGUE_BANDS.LOW.max) === "LOW", "29 LOW");
assert(classifyCognitiveFatigue(COGNITIVE_FATIGUE_BANDS.MEDIUM.min) === "MEDIUM", "30 MEDIUM");
assert(classifyCognitiveFatigue(COGNITIVE_FATIGUE_BANDS.HIGH.min) === "HIGH", "55 HIGH");
assert(classifyCognitiveFatigue(COGNITIVE_FATIGUE_BANDS.CRITICAL.min) === "CRITICAL", "75 CRITICAL");
console.log("✓ cognitive fatigue bands");

const layer = processEmotionalLoadSignalLayer({
  caregiverLoad: {
    score: 58,
    state: "HIGH",
    activeDemandCount: 5,
    highPressureDemandCount: 2,
    unresolvedSituationCount: 2,
    uncertaintyLoad: 45,
    conflictLoad: 35,
    coordinationLoad: 20,
    timePressureLoad: 40,
    updatedAt: new Date().toISOString(),
  },
  demands: [
    {
      id: "d1",
      situationId: "sit-1",
      title: "Med follow-up",
      description: "Call clinic",
      category: "medical",
      status: "pending",
      urgency: 80,
      riskImpact: 70,
      effort: 30,
      emotionalLoad: 55,
      uncertainty: 40,
      pressureScore: 72,
      createdAt: new Date().toISOString(),
    },
  ],
  baseTopN: 2,
});
assert(layer.guarantee.ok, `layer guarantee: ${layer.guarantee.violations.join(", ")}`);
assert(layer.priorityAdjustment.adjustedTopN <= 2, "adjusted topN <= base");
console.log("✓ processEmotionalLoadSignalLayer guarantee");

const highFatigueSignal = computeEmotionalLoadSignal({
  ...baseInput,
  operationalLoadScore: 88,
  depletionFactor: 0.85,
  emotionalBias: 0.45,
  pendingConflictCount: 3,
  highPressureDemandCount: 4,
});
const adj = computeLoadAwarePriorityAdjustment(highFatigueSignal, 4, true);
assert(adj.deferNonCritical, "high load defers non-critical");
assert(adj.adjustedTopN <= 2, "high fatigue reduces topN");
console.log("✓ load-aware priority adjustment");

const protection = evaluateCaregiverProtectionMode(
  { ...highFatigueSignal, burnoutProbability: { value: 0.72, reasoning: "test" } },
  { outputRiskLevel: "high", priorityOverrideApplied: false },
  true,
);
assert(protection.engaged, "protection mode when burnout + high risk");
assert(protection.constraints.maxActions === 1, "protection max 1 action");
assert(!protection.constraints.allowBranching, "no branching in protection");
console.log("✓ Caregiver Protection Mode");

const meta = computeRecommendationLoadMetadata({
  signal: highFatigueSignal,
  chosenActionId: "d1",
  chosenDemand: {
    id: "d1",
    situationId: "sit-1",
    title: "Test",
    description: "x",
    category: "medical",
    status: "pending",
    urgency: 80,
    riskImpact: 70,
    effort: 50,
    emotionalLoad: 60,
    uncertainty: 40,
    pressureScore: 72,
    createdAt: new Date().toISOString(),
  },
});
assert(meta.cognitiveLoadRequired, "cognitiveLoadRequired present");
assert(meta.emotionalImpact, "emotionalImpact present");
assert(meta.burnoutContribution >= 0 && meta.burnoutContribution <= 1, "burnoutContribution 0–1");
console.log("✓ recommendation load metadata");

const post = applyPostDecisionEmotionalLoad({
  layer,
  chosenActionId: "d1",
  baseSurfaceLimit: 2,
  riskContext: { outputRiskLevel: "medium" },
});
assert(post.guarantee.ok, `post-decision guarantee: ${post.guarantee.violations.join(", ")}`);
assert(post.recommendationMetadata.cognitiveLoadRequired, "post metadata");
console.log("✓ post-decision emotional load");

assert(
  LAYER_ARCHITECTURE_MAP.DERIVED.owns.some((o) => o.includes("computeEmotionalLoadSignal")),
  "architecture map owns ELS",
);
assert(
  FACADE_DEPRECATION["emotional-load-signal"] === "derived/computeEmotionalLoad",
  "facade deprecation",
);
console.log("✓ layered architecture registration");

const pipelineSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);
const decisionIdx = pipelineSource.indexOf("// Decision Engine assembly");
const elsPostIdx = pipelineSource.indexOf("// EMOTIONAL LOAD SIGNAL — AFTER Decision Engine");
const failSafeIdx = pipelineSource.indexOf("// FAIL-SAFE MODE — AFTER Emotional Load Signal");
const humanTrustIdx = pipelineSource.indexOf("// HUMAN TRUST LAYER — AFTER");
const elsEarlyIdx = pipelineSource.indexOf("processEmotionalLoadSignalLayer({");
const priorityIdx = pipelineSource.indexOf("processPriorityEngineLayer({");

assert(decisionIdx > 0 && elsPostIdx > decisionIdx, "ELS post-decision after Decision Engine");
assert(failSafeIdx > elsPostIdx, "Fail-Safe after ELS post-decision");
assert(humanTrustIdx > failSafeIdx, "Human Trust after Fail-Safe");
assert(elsEarlyIdx > 0 && elsEarlyIdx < priorityIdx, "ELS early pass before Priority Engine");
console.log("✓ analyze-pipeline wiring order");

console.log("\n✓ Emotional Load Signal v1.0 verified");
