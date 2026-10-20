import fs from "node:fs";
import path from "node:path";
import {
  ASSUMPTION_INSTABILITY_VOLATILITY_WEIGHT,
  BASE_RISK_LEVELS,
  DEPENDENCY_MULTIPLIER_PCT,
  OVERLOAD_PRIORITY_TOP_N,
  OVERLOAD_RISK_THRESHOLD,
  OVERLAP_PENALTY_MAX_PCT,
  OVERLAP_PENALTY_MIN_PCT,
  SITUATION_RISK_REGISTER_LAYER_FORBIDDEN,
  SITUATION_RISK_REGISTER_LAYER_IDENTITY,
  SITUATION_RISK_REGISTER_LAYER_ONE_LINE_TRUTH,
  SITUATION_RISK_REGISTER_LAYER_PIPELINE_POSITION,
  UNCERTAINTY_PENALTY_COEFFICIENT,
  aggregateSystemRisk,
  applyOverloadSafetySimplification,
  applySystemRiskToPriorityScore,
  buildRiskClusters,
  computeDependencyMultiplier,
  computeOverlapPenalty,
  computeSituationRisk,
  computeUncertaintyPenalty,
  detectOverload,
  emptyOverloadSignals,
  formatSituationRiskRegisterObservation,
  processSituationRiskRegisterLayer,
  resolvePriorityTopNWithOverload,
  toSituationRiskRegisterLayerPayload,
  type SituationRisk,
} from "../src/lib/situation-risk-register";
import {
  createEmptyTrackedSituation,
  processResolutionEngineLayer,
  resetResolutionStoreForTests,
  resolveSituation,
} from "../src/lib/resolution-engine";
import { processPriorityEngineLayer } from "../src/lib/priority-engine";
import { DEFAULT_CARE_PROFILE } from "../src/lib/care-profile";
import { computeCareContext } from "../src/lib/care-context/situational";
import { classifyInputSurface } from "../src/lib/input-classification";
import { detectUrgencyLevel } from "../src/lib/urgency-detection";
import { processTimeEngineLayer } from "../src/lib/time-engine";
import { createDefaultMemoryInfluenceState } from "../src/lib/memory-influence";
import { DEFAULT_SOLENOS_SETTINGS } from "../src/lib/settings-governance";
import type { SolenOSResponse } from "../src/lib/response-validator";

console.log("=== SolenOS Situation Risk Register ===\n");

if (!SITUATION_RISK_REGISTER_LAYER_IDENTITY.includes("systemic caregiving risk")) {
  throw new Error("risk register identity contract drift");
}
if (!SITUATION_RISK_REGISTER_LAYER_ONE_LINE_TRUTH.includes("total risk burden")) {
  throw new Error("risk register one-line truth drift");
}
if (!SITUATION_RISK_REGISTER_LAYER_PIPELINE_POSITION.includes("GLOBAL modifier")) {
  throw new Error("risk register must feed Priority Engine as GLOBAL modifier");
}
if (!SITUATION_RISK_REGISTER_LAYER_FORBIDDEN.some((r) => r.includes("UI badges"))) {
  throw new Error("risk register must forbid UI-badge-only representation");
}
if (BASE_RISK_LEVELS.join(",") !== "LOW,MEDIUM,HIGH,CRITICAL") {
  throw new Error("base risk levels drift");
}
if (OVERLOAD_RISK_THRESHOLD !== 75) {
  throw new Error("overload threshold must be 75");
}
if (OVERLAP_PENALTY_MIN_PCT !== 8 || OVERLAP_PENALTY_MAX_PCT !== 15) {
  throw new Error("overlap penalty range must be 8–15%");
}
if (UNCERTAINTY_PENALTY_COEFFICIENT !== 0.6) {
  throw new Error("uncertainty penalty coefficient must be 0.6");
}
if (DEPENDENCY_MULTIPLIER_PCT !== 5) {
  throw new Error("dependency multiplier must be 5%");
}
console.log("✓ contract constants");

resetResolutionStoreForTests();
const sessionId = "risk-verify-session";
const s1 = createEmptyTrackedSituation({
  title: "Hospital discharge medication dose unclear",
  careSessionId: sessionId,
  id: "sit-a",
});
const s2 = createEmptyTrackedSituation({
  title: "Clinic medication refill and dose schedule",
  careSessionId: sessionId,
  id: "sit-b",
});
const s3 = createEmptyTrackedSituation({
  title: "Insurance prior auth for medical coverage",
  careSessionId: sessionId,
  id: "sit-c",
});

const input =
  "Mom needs urgent hospital follow-up for medication dose and insurance prior auth today.";
const classification = classifyInputSurface(input);
const urgency = detectUrgencyLevel(input, classification.mode);
const careCtx = computeCareContext({
  input,
  inputMode: classification.mode,
  urgencyDetection: urgency,
});
const careProfile = {
  ...DEFAULT_CARE_PROFILE,
  careRelationships: {
    dependents: ["mom"],
    sharedCareWith: ["sister"],
    externalCaregivers: ["home-aide"],
  },
  conditionSignals: {
    medicationReminders: true,
    mobilityAssistance: false,
  },
};
const memory = createDefaultMemoryInfluenceState();
const timeLayer = processTimeEngineLayer({
  input,
  governanceSettings: DEFAULT_SOLENOS_SETTINGS,
  careProfile,
  careContext: careCtx.context,
  memoryState: memory,
  urgencyDetection: urgency,
});

const riskA = computeSituationRisk({
  situation: s1,
  careContext: careCtx.context,
  careProfile,
  timeEngine: timeLayer,
  urgencyDetection: urgency,
  openMissingInfo: [
    {
      id: "mi-1",
      situationId: s1.id,
      question: "What is the current dose?",
      importance: "HIGH",
      source: "reasoning",
      status: "open",
      createdAt: new Date().toISOString(),
    },
  ],
  assumptionEnvelope: {
    compositeBias: 0.2,
    influenceableCount: 1,
    influenceHints: ["dose may have changed"],
    staleInfluenceCount: 1,
    health: {
      activeAssumptions: 1,
      expiredAssumptions: 0,
      invalidatedAssumptions: 0,
      staleAssumptions: 1,
    },
  },
});
if (riskA.adjustedRisk < 0 || riskA.adjustedRisk > 100) {
  throw new Error("adjustedRisk must be 0–100");
}
if (!riskA.riskDrivers.uncertaintyFactor || riskA.riskDrivers.uncertaintyFactor <= 0) {
  throw new Error("missing info must raise uncertaintyFactor");
}
console.log("✓ SituationRisk computation + drivers");

const mediumA: SituationRisk = {
  situationId: "m1",
  baseRisk: "MEDIUM",
  adjustedRisk: 45,
  riskDrivers: {
    urgency: 0.5,
    medicalSeverity: 0.4,
    dependencyLevel: 0.3,
    timeSensitivity: 0.4,
    uncertaintyFactor: 0.2,
  },
};
const mediumB: SituationRisk = {
  ...mediumA,
  situationId: "m2",
};
const singleMedium = aggregateSystemRisk({
  situationRisks: [mediumA],
  clusters: [{ situations: ["m1"], clusterRiskLevel: "MEDIUM", clusterKind: "singleton" }],
});
const dualMedium = aggregateSystemRisk({
  situationRisks: [mediumA, mediumB],
  clusters: [
    {
      situations: ["m1", "m2"],
      clusterRiskLevel: "MEDIUM",
      clusterKind: "same_dependent",
    },
  ],
  careProfile,
});
if (dualMedium.systemRisk.totalRiskExposure <= singleMedium.systemRisk.totalRiskExposure) {
  throw new Error("multiple MEDIUM must raise systemic exposure vs single MEDIUM");
}
if (dualMedium.breakdown.sumAdjustedRisk !== 90) {
  throw new Error("Σ(adjustedRisk) must equal 45+45=90");
}
console.log("✓ aggregation: multiple MEDIUM compounds systemic stress");

const highPair: SituationRisk[] = [
  { ...mediumA, situationId: "h1", baseRisk: "HIGH", adjustedRisk: 70 },
  { ...mediumA, situationId: "h2", baseRisk: "CRITICAL", adjustedRisk: 88 },
];
const overlap = computeOverlapPenalty(highPair, [
  {
    situations: ["h1", "h2"],
    clusterRiskLevel: "CRITICAL",
    clusterKind: "high_risk_overlap",
  },
]);
if (overlap < 2 * OVERLAP_PENALTY_MIN_PCT || overlap > 2 * OVERLAP_PENALTY_MAX_PCT) {
  throw new Error("overlapPenalty must be situationsInHighRiskCluster × 8–15%");
}
const uncertainty = computeUncertaintyPenalty({
  missingInformationEnvelope: {
    openCount: 3,
    highPriorityOpenCount: 2,
    confidencePenalty: 0.3,
    uncertaintyBoost: 0.25,
    needsNext: [],
    health: { openItems: 3, highPriorityItems: 2, resolvedItems: 0 },
  },
  assumptionEnvelope: {
    compositeBias: 0.2,
    influenceableCount: 1,
    influenceHints: [],
    staleInfluenceCount: 1,
    health: {
      activeAssumptions: 1,
      expiredAssumptions: 0,
      invalidatedAssumptions: 0,
      staleAssumptions: 1,
    },
  },
  situationRisks: highPair,
});
if (uncertainty <= 0) throw new Error("uncertaintyPenalty must be positive");
const dep = computeDependencyMultiplier(careProfile);
if (dep !== (1 + 1 + Math.max(0, 1 - 1)) * DEPENDENCY_MULTIPLIER_PCT) {
  // sharedCareWith(1) + external(1) + max(0, dependents-1)=0 → 2*5=10
  if (dep !== 10) throw new Error(`dependencyMultiplier expected 10, got ${dep}`);
}
console.log("✓ overlap / uncertainty / dependency formulas");

const clusters = buildRiskClusters({
  activeSituations: [s1, s2, s3],
  situationRisks: [
    computeSituationRisk({ situation: s1, careContext: careCtx.context, careProfile }),
    computeSituationRisk({ situation: s2, careContext: careCtx.context, careProfile }),
    computeSituationRisk({ situation: s3, careContext: careCtx.context, careProfile }),
  ],
  careProfile,
  careContext: careCtx.context,
  timeEngine: timeLayer,
});
if (clusters.length === 0) throw new Error("clustering must produce clusters");
if (!clusters.some((c) => c.clusterKind === "same_dependent" || c.situations.length >= 2)) {
  throw new Error("same dependent / overlap clustering expected for multi-active set");
}
console.log("✓ risk clustering engine");

const overloadLow = detectOverload({
  totalRiskExposure: 40,
  riskDistribution: { LOW: 1, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
  dominantRiskCluster: [],
  riskVolatility: 0,
  overloadRisk: 40,
});
if (overloadLow.overloadHigh) throw new Error("exposure 40 must not overload");
const overloadHigh = detectOverload({
  totalRiskExposure: 80,
  riskDistribution: { LOW: 0, MEDIUM: 0, HIGH: 2, CRITICAL: 0 },
  dominantRiskCluster: ["h1", "h2"],
  riskVolatility: 20,
  overloadRisk: 80,
});
if (!overloadHigh.overloadHigh) throw new Error("exposure >75 must overload HIGH");
if (!overloadHigh.reduceCognitiveComplexity) {
  throw new Error("overload must reduce cognitive complexity");
}
if (overloadHigh.maxPrioritySituations > OVERLOAD_PRIORITY_TOP_N) {
  throw new Error("overload must prioritize only top 1–2");
}
if (!overloadHigh.suppressSecondaryRecommendations || !overloadHigh.simplifyDecisionOutputs) {
  throw new Error("overload must suppress secondary + simplify decisions");
}
const sample: SolenOSResponse = {
  what_is_happening: "Several overlapping care demands are active with incomplete dose information.",
  what_matters_now: "Clarify the discharge medication dose and confirm insurance prior auth status.",
  what_to_ask_next: "What dose was written on the discharge papers?",
  risk_level: "high",
  what_can_wait: "Non-urgent scheduling details and secondary administrative tidy-up can wait.",
};
const simplified = applyOverloadSafetySimplification(sample, overloadHigh, []);
if (simplified.what_matters_now === sample.what_matters_now) {
  throw new Error("overload safety must alter decision outputs");
}
if (!simplified.what_matters_now.includes("Confirm before acting")) {
  throw new Error("overload must increase confirmation");
}
console.log("✓ overload detection + safety simplification");

const globalScore = applySystemRiskToPriorityScore(0.4, {
  systemRiskExposureWeight: 0.2,
  missingInfoWeight: 0.1,
  assumptionUncertainty: 0.05,
  overloadCollapseTopN: true,
  overloadTopN: 2,
});
if (Math.abs(globalScore - 0.75) > 1e-9) {
  throw new Error("priority global modifier formula drift");
}
const topN = resolvePriorityTopNWithOverload(5, {
  systemRiskExposureWeight: 0.2,
  missingInfoWeight: 0,
  assumptionUncertainty: 0,
  overloadCollapseTopN: true,
  overloadTopN: 2,
}, 3);
if (topN !== 2) throw new Error("overload must collapse Priority top-N to ≤2");
console.log("✓ Priority Engine global modifier bridge");

resetResolutionStoreForTests();
const resolution = processResolutionEngineLayer({
  input,
  careSessionId: sessionId,
  applyDetectedEvidence: false,
  situationTitle: input.slice(0, 80),
});
const layer = processSituationRiskRegisterLayer({
  trackedSituations: resolution.situations,
  careContext: careCtx.context,
  careProfile,
  timeEngine: timeLayer,
  urgencyDetection: urgency,
  missingInformationEnvelope: {
    openCount: 2,
    highPriorityOpenCount: 1,
    confidencePenalty: 0.15,
    uncertaintyBoost: 0.2,
    needsNext: ["What is the discharge dose?"],
    health: { openItems: 2, highPriorityItems: 1, resolvedItems: 0 },
  },
  assumptionEnvelope: {
    compositeBias: 0.15,
    influenceableCount: 1,
    influenceHints: ["may still be on old dose"],
    staleInfluenceCount: 0,
    health: {
      activeAssumptions: 1,
      expiredAssumptions: 0,
      invalidatedAssumptions: 0,
      staleAssumptions: 0,
    },
  },
});
if (!layer.guarantee.ok) {
  throw new Error(`guarantee failed: ${layer.guarantee.violations.join("; ")}`);
}
if (layer.situationRisks.length !== resolution.active.length) {
  throw new Error("ONLY ACTIVE situations must participate in risk register");
}
const payload = toSituationRiskRegisterLayerPayload(layer);
if (payload.totalRiskExposure !== layer.systemRisk.totalRiskExposure) {
  throw new Error("payload exposure mismatch");
}
const obs = formatSituationRiskRegisterObservation(layer);
if (!obs.includes("SITUATION_RISK_REGISTER")) {
  throw new Error("observation tag missing");
}
console.log("✓ processSituationRiskRegisterLayer + ACTIVE-only");

// RESOLVED must drop out of risk
const activeOnly = resolution.active[0];
if (!activeOnly) throw new Error("expected ACTIVE situation from resolution");
const resolved = resolveSituation(activeOnly, {
  kind: "USER_CONFIRMATION",
  detail: "resolved for test",
  source: "user_input",
  recordedAt: new Date().toISOString(),
});
if (!resolved.ok) throw new Error("resolve failed");
const afterResolve = processSituationRiskRegisterLayer({
  trackedSituations: [resolved.situation],
  careContext: careCtx.context,
  careProfile,
});
if (afterResolve.situationRisks.length !== 0) {
  throw new Error("RESOLVED situations must not contribute system risk");
}
if (afterResolve.systemRisk.totalRiskExposure !== 0) {
  throw new Error("resolved set must zero totalRiskExposure");
}
console.log("✓ RESOLVED excluded from risk (ACTIVE-only)");

const priority = processPriorityEngineLayer({
  timeEngine: timeLayer,
  careProfile,
  careContext: careCtx.context,
  urgencyDetection: urgency,
  governanceSettings: DEFAULT_SOLENOS_SETTINGS,
  trackedSituations: resolution.situations,
  systemRiskEnvelope: layer.priorityEnvelope,
});
if (layer.overload.overloadHigh && priority.rankedForActionGenerator.length > 2) {
  throw new Error("priority must collapse to top 1–2 under overload");
}
console.log("✓ priority engine consumes systemRiskEnvelope");

if (ASSUMPTION_INSTABILITY_VOLATILITY_WEIGHT <= 0) {
  throw new Error("assumption instability weight must be positive");
}
if (emptyOverloadSignals().overloadHigh) {
  throw new Error("empty overload must be false");
}
console.log("✓ defaults / assumption volatility weight");

// Analyze pipeline wiring order
const pipelineSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);
const resolutionIdx = pipelineSource.indexOf("processResolutionEngineLayer(");
const miqIdx = pipelineSource.indexOf("processMissingInformationQueueLayer(");
const riskIdx = pipelineSource.indexOf("processSituationRiskRegisterLayer(");
const priorityIdx = pipelineSource.indexOf("processPriorityEngineLayer({");
const geminiIdx = pipelineSource.indexOf("invokeGeminiExecution({");
if (
  !(
    resolutionIdx > 0 &&
    miqIdx > resolutionIdx &&
    riskIdx > miqIdx &&
    priorityIdx > riskIdx &&
    priorityIdx < geminiIdx
  )
) {
  throw new Error(
    "pipeline order must be resolution → missing-info → risk register → priority → generation",
  );
}
if (!pipelineSource.includes("systemRiskEnvelope: situationRiskRegisterLayer.priorityEnvelope")) {
  throw new Error("priority engine must receive systemRiskEnvelope from risk register");
}
if (!pipelineSource.includes("overloadSimplification: situationRiskRegisterLayer.overload")) {
  throw new Error("safety enforcement must receive overloadSimplification");
}
if (!pipelineSource.includes("situation_risk_register_layer")) {
  throw new Error("pipeline must expose situation_risk_register_layer");
}
console.log("✓ analyze pipeline wiring");

const routeSource = fs.readFileSync(
  path.join(process.cwd(), "src/app/api/analyze/route.ts"),
  "utf-8",
);
if (!routeSource.includes("situation_risk_register_layer")) {
  throw new Error("analyze API must expose situation_risk_register_layer");
}
console.log("✓ analyze API payload");

console.log("\n✓ Situation Risk Register verified");
