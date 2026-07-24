import fs from "node:fs";
import path from "node:path";
import {
  PRIORITY_ENGINE_LAYER_FORBIDDEN,
  PRIORITY_ENGINE_LAYER_IDENTITY,
  PRIORITY_ENGINE_LAYER_ONE_LINE_TRUTH,
  PRIORITY_ENGINE_LAYER_PIPELINE_POSITION,
  DEFAULT_PRIORITY_WEIGHTS,
  DEFAULT_TOP_N,
  RISK_SUPPRESSION_FLOOR,
  RISK_WEIGHT,
  TIME_URGENCY,
  PriorityContract,
  applyEmotionalWeightModifiers,
  applyHardConstraintFilter,
  applyPriorityEngineBehaviorWeighting,
  applyPriorityEngineGovernanceWeighting,
  clampUnit,
  computeDependencyWeight,
  computeEmotionalAmplification,
  computeMemoryReinforcement,
  computePriorityScore,
  computeRiskPenalty,
  computeUncertainty,
  detectPriorityConflicts,
  formatPriorityEngineObservation,
  normalize,
  normalizeScore01,
  processPriorityEngineLayer,
  readPriorityWeightsFromSettings,
  runPriorityEngineGuarantee,
  selectTopN,
  sortPriorityVectors,
  toPriorityEngineLayerPayload,
  type PriorityActionCandidate,
  type PriorityVector,
} from "../src/lib/priority-engine";
import {
  DEFAULT_SOLENOS_SETTINGS,
  applySettingsGovernance,
  mergeWithDefaultSettings,
} from "../src/lib/settings-governance";
import { createDefaultMemoryInfluenceState } from "../src/lib/memory-influence";
import { DEFAULT_CARE_PROFILE } from "../src/lib/care-profile";
import { computeCareContext } from "../src/lib/care-context/situational";
import { classifyInputSurface, selectBehaviorProfile } from "../src/lib/input-classification";
import { detectUrgencyLevel } from "../src/lib/urgency-detection";
import { processTimeEngineLayer } from "../src/lib/time-engine";
import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";

console.log("=== Priority Engine Math Model ===\n");

if (!PRIORITY_ENGINE_LAYER_IDENTITY.includes("Priority Contract") && !PRIORITY_ENGINE_LAYER_IDENTITY.includes("multi-signal fusion")) {
  throw new Error("priority engine identity contract drift");
}
if (!PRIORITY_ENGINE_LAYER_ONE_LINE_TRUTH.includes("computes scores only")) {
  throw new Error("priority engine one-line truth must forbid action generation");
}
if (!PRIORITY_ENGINE_LAYER_FORBIDDEN.some((r) => r.includes("natural language actions"))) {
  throw new Error("priority engine must forbid NL action generation");
}
if (!PRIORITY_ENGINE_LAYER_FORBIDDEN.some((r) => r.includes("LLM") || r.includes("emotional"))) {
  throw new Error("priority engine must forbid LLM / emotional situation scoring");
}
if (!PRIORITY_ENGINE_LAYER_PIPELINE_POSITION.includes("after Time Engine")) {
  throw new Error("priority engine must run after Time Engine");
}
if (!PRIORITY_ENGINE_LAYER_PIPELINE_POSITION.includes("before Conflict Resolver")) {
  throw new Error("priority engine must run before Conflict Resolver");
}
console.log("✓ priority engine contract constants");

const pc = PriorityContract.calculate({
  situationId: "verify-pc",
  riskLevel: "CRITICAL",
  severity: 1,
  timeUrgency: "NOW",
  hoursUntilDeadline: 0,
  completion: "ACTIVE",
});
if (!pc.safetyOverride) throw new Error("PriorityContract CRITICAL×NOW must set safetyOverride");
if (Math.abs(pc.priorityScore - (RISK_WEIGHT.CRITICAL + TIME_URGENCY.NOW)) > 1e-9) {
  throw new Error("PriorityContract formula drift in priority-engine verify");
}
console.log("✓ Situation Priority Contract facade (CRITICAL×NOW)");

if (
  DEFAULT_PRIORITY_WEIGHTS.Wt !== 0.35 ||
  DEFAULT_PRIORITY_WEIGHTS.We !== 0.2 ||
  DEFAULT_PRIORITY_WEIGHTS.Wm !== 0.2 ||
  DEFAULT_PRIORITY_WEIGHTS.Wd !== 0.2 ||
  DEFAULT_PRIORITY_WEIGHTS.Wr !== 0.25
) {
  throw new Error("default PriorityWeights drift");
}
if (DEFAULT_TOP_N !== 3) {
  throw new Error("default top N must be 3");
}
console.log("✓ default weights + top N");

// Normalization
if (normalize(5, 0, 10) !== 0.5) throw new Error("normalize(5,0,10) must be 0.5");
if (normalizeScore01(1.5) !== 1) throw new Error("normalizeScore01 must clamp to 1");
if (normalizeScore01(-0.2) !== 0) throw new Error("normalizeScore01 must clamp to 0");
if (clampUnit(2) !== 1) throw new Error("clampUnit must bound to 1");
console.log("✓ normalize");

// Dependency: log(1+n), not linear; multi-user not collapsed
const dep1 = computeDependencyWeight({
  dependents: ["mom", "dad"],
  sharedCareWith: ["sister"],
  dependencySeverityMultiplier: 1,
});
if (dep1.affectedUsers < 3) {
  throw new Error("must count unique dependents + shared care (not collapse)");
}
const depLinearWouldBe = 3;
const depLog = Math.log(1 + 3);
if (dep1.dependencyWeight >= depLinearWouldBe) {
  throw new Error("dependencyWeight must be logarithmic scale, not raw count");
}
if (Math.abs(Math.log(1 + dep1.affectedUsers) - depLog) > 1e-9) {
  throw new Error("dependencyWeight base must use log(1+n)");
}
const depDup = computeDependencyWeight({
  dependents: ["mom", "mom", "mom"],
  dependencySeverityMultiplier: 1,
});
if (depDup.affectedUsers !== 1) {
  throw new Error("duplicate dependent ids must not inflate affectedUsers");
}
console.log("✓ dependencyWeight = log(1+n)");

// Emotional amplification
const eBurnout = computeEmotionalAmplification({
  emotionalLoad: 0.5,
  vulnerabilityFactor: 1,
  burnout: true,
  grief: false,
});
const eBase = computeEmotionalAmplification({
  emotionalLoad: 0.5,
  vulnerabilityFactor: 1,
  burnout: false,
  grief: false,
});
if (eBurnout <= eBase) throw new Error("burnout must amplify emotional score");
const griefWeights = applyEmotionalWeightModifiers(
  { ...DEFAULT_PRIORITY_WEIGHTS },
  { burnout: false, grief: true },
);
if (griefWeights.Wt >= DEFAULT_PRIORITY_WEIGHTS.Wt) {
  throw new Error("grief must reduce temporal aggressiveness weight");
}
if (griefWeights.We <= DEFAULT_PRIORITY_WEIGHTS.We) {
  throw new Error("grief must increase emotional priority sensitivity weight");
}
console.log("✓ emotional amplification + weight modifiers");

// Memory reinforcement
const m = computeMemoryReinforcement({ frequency: 0.8, recency: 0.5, importanceDecay: 0.5 });
if (Math.abs(m - 0.8 * 0.5 * 0.5) > 1e-9) {
  throw new Error("M must equal frequency × recency × importanceDecay");
}
console.log("✓ memory reinforcement");

// Risk penalty
const r = computeRiskPenalty({ medicalRisk: 0.9, financialRisk: 0.3, uncertaintyRisk: 0.6 });
if (r <= 0) throw new Error("risk penalty must be positive for elevated risks");
const highRiskScore = computePriorityScore(
  {
    temporalUrgency: 0.9,
    emotionalLoad: 0.5,
    memoryReinforcement: 0.5,
    dependencyWeight: 0.5,
    riskPenalty: 1,
  },
  { ...DEFAULT_PRIORITY_WEIGHTS },
);
const lowRiskScore = computePriorityScore(
  {
    temporalUrgency: 0.9,
    emotionalLoad: 0.5,
    memoryReinforcement: 0.5,
    dependencyWeight: 0.5,
    riskPenalty: 0,
  },
  { ...DEFAULT_PRIORITY_WEIGHTS },
);
if (highRiskScore >= lowRiskScore) {
  throw new Error("risk penalty must suppress score");
}
if (highRiskScore < 0) throw new Error("score must remain >= 0 (no elimination via negative)");
console.log("✓ risk penalty suppresses but equation stays bounded");

// Equation check
const eq = computePriorityScore(
  {
    temporalUrgency: 1,
    emotionalLoad: 1,
    memoryReinforcement: 1,
    dependencyWeight: 1,
    riskPenalty: 0,
  },
  { Wt: 0.35, We: 0.2, Wm: 0.2, Wd: 0.2, Wr: 0.25 },
);
const expected = clampUnit(0.35 + 0.2 + 0.2 + 0.2);
if (Math.abs(eq - expected) > 1e-9) {
  throw new Error(`PriorityScore equation drift: got ${eq} expected ${expected}`);
}
console.log("✓ PriorityScore = T·Wt + E·We + M·Wm + D·Wd − R·Wr");

// Confidence / uncertainty
const { uncertainty, confidence } = computeUncertainty({
  missingTime: true,
  missingMemory: true,
  conflictingSignals: false,
  lowDependencyClarity: false,
});
if (Math.abs(confidence - (1 - uncertainty)) > 1e-9) {
  throw new Error("confidence must equal 1 - uncertainty");
}
if (uncertainty < 0.4) throw new Error("missing time+memory must raise uncertainty");
console.log("✓ confidence = 1 - uncertainty");

// Sorting + top N
const vectors: PriorityVector[] = [
  {
    actionId: "b",
    totalScore: 0.4,
    components: {
      temporalWeight: 0.4,
      emotionalWeight: 0.2,
      memoryWeight: 0.2,
      dependencyWeight: 0.2,
      riskWeight: 0.1,
    },
    confidence: 0.8,
    uncertainty: 0.2,
  },
  {
    actionId: "a",
    totalScore: 0.9,
    components: {
      temporalWeight: 0.9,
      emotionalWeight: 0.2,
      memoryWeight: 0.2,
      dependencyWeight: 0.2,
      riskWeight: 0.1,
    },
    confidence: 0.9,
    uncertainty: 0.1,
  },
  {
    actionId: "c",
    totalScore: 0.4,
    components: {
      temporalWeight: 0.3,
      emotionalWeight: 0.2,
      memoryWeight: 0.2,
      dependencyWeight: 0.2,
      riskWeight: 0.1,
    },
    confidence: 0.7,
    uncertainty: 0.3,
  },
];
const sorted = sortPriorityVectors(vectors);
if (sorted[0]!.actionId !== "a") throw new Error("sort must be descending by totalScore");
if (sorted[1]!.actionId !== "b" || sorted[2]!.actionId !== "c") {
  throw new Error("ties must break by actionId ascending");
}
const top = selectTopN(sorted, 2);
if (top.length !== 2 || top[0]!.actionId !== "a") {
  throw new Error("selectTopN must return first N sorted vectors");
}
console.log("✓ sort + top N");

// Conflict detection — flag only
const conflictCandidates: PriorityActionCandidate[] = [
  {
    actionId: "med",
    domain: "medical",
    urgencyClass: "CRITICAL",
    temporalUrgency: 0.8,
    emotional: {
      emotionalLoad: 0.2,
      vulnerabilityFactor: 1,
      burnout: false,
      grief: false,
    },
    memory: { frequency: 0.3, recency: 0.5, importanceDecay: 0.5 },
    dependency: { dependents: ["mom"], dependencySeverityMultiplier: 1 },
    risk: { medicalRisk: 0.5, financialRisk: 0.1, uncertaintyRisk: 0.2 },
    missingSignals: {
      missingTime: false,
      missingMemory: false,
      conflictingSignals: false,
      lowDependencyClarity: false,
    },
  },
  {
    actionId: "fin",
    domain: "financial",
    urgencyClass: "LOW",
    temporalUrgency: 0.75,
    emotional: {
      emotionalLoad: 0.2,
      vulnerabilityFactor: 1,
      burnout: false,
      grief: false,
    },
    memory: { frequency: 0.3, recency: 0.5, importanceDecay: 0.5 },
    dependency: { dependents: ["mom"], dependencySeverityMultiplier: 1 },
    risk: { medicalRisk: 0.1, financialRisk: 0.6, uncertaintyRisk: 0.2 },
    missingSignals: {
      missingTime: false,
      missingMemory: false,
      conflictingSignals: false,
      lowDependencyClarity: false,
    },
  },
];
const conflictVectors: PriorityVector[] = [
  {
    actionId: "med",
    totalScore: 0.72,
    components: {
      temporalWeight: 0.8,
      emotionalWeight: 0.2,
      memoryWeight: 0.2,
      dependencyWeight: 0.3,
      riskWeight: 0.3,
    },
    confidence: 0.9,
    uncertainty: 0.1,
  },
  {
    actionId: "fin",
    totalScore: 0.7,
    components: {
      temporalWeight: 0.75,
      emotionalWeight: 0.2,
      memoryWeight: 0.2,
      dependencyWeight: 0.3,
      riskWeight: 0.4,
    },
    confidence: 0.85,
    uncertainty: 0.15,
  },
];
const conflicts = detectPriorityConflicts(conflictVectors, conflictCandidates);
if (conflicts.length !== 1) throw new Error("must flag similar score / different domain+urgency");
if (!conflicts[0]!.unresolved) {
  throw new Error("conflicts must remain unresolved (Conflict Resolver owns resolution)");
}
console.log("✓ conflict detection flags only");

// Hard constraints — suppress not eliminate
const constraintResult = applyHardConstraintFilter(conflictVectors, conflictCandidates, {
  medicalSafetyStrict: true,
  financialRiskCap: 0.85,
  caregiverDependencyProtected: true,
});
for (const v of constraintResult.filtered) {
  if (v.totalScore < 0) throw new Error("hard constraints must not eliminate to negative");
}
if (RISK_SUPPRESSION_FLOOR !== 0.05) {
  throw new Error("risk suppression floor drift");
}
console.log("✓ hard constraint filter");

// Settings weight overrides
const custom = readPriorityWeightsFromSettings(undefined, { Wt: 0.5 });
if (custom.Wt !== 0.5) throw new Error("must honor PriorityWeights override");
if (custom.We !== DEFAULT_PRIORITY_WEIGHTS.We) {
  throw new Error("must not guess unspecified weight overrides");
}
const conservative = readPriorityWeightsFromSettings(
  mergeWithDefaultSettings({ systemMode: "CONSERVATIVE" }),
);
if (conservative.Wr <= DEFAULT_PRIORITY_WEIGHTS.Wr) {
  throw new Error("CONSERVATIVE mode should increase risk weight");
}
console.log("✓ settings PriorityWeights");

// Full layer process via upstream signals
const input = "Need medication within 2 hours for Mom who depends on me";
const urgencyDetection = detectUrgencyLevel(input, classifyInputSurface(input).mode);
const careContext = computeCareContext({
  input,
  inputMode: classifyInputSurface(input).mode,
  urgencyDetection,
});
const memoryState = createDefaultMemoryInfluenceState("verify-user");
memoryState.memory.operationalMemory.entries.push({
  id: "op-1",
  key: "ongoing_medication_task",
  influenceLabel: "medication pattern",
  influenceWeight: 0.7,
  confidence: 0.8,
  occurrenceCount: 5,
  tags: { outdated: false, incorrect: false, sensitive: false },
  source: "REPEATED_PATTERN",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});
const careProfile = {
  ...DEFAULT_CARE_PROFILE,
  careRelationships: {
    ...DEFAULT_CARE_PROFILE.careRelationships,
    dependents: ["mom", "sibling-dependent"],
  },
};
const timeLayer = processTimeEngineLayer({
  input,
  careProfile,
  careContext: careContext.context,
  memoryState,
  urgencyDetection,
});
const priorityLayer = processPriorityEngineLayer({
  timeEngine: timeLayer,
  memoryState,
  memoryEnvelope: {
    identityBias: 0,
    patternBias: 0.2,
    operationalBias: 0.5,
    emotionalBias: 0.3,
    compositeInfluence: 0.5,
    interpretationHints: [],
  },
  careProfile,
  careContext: careContext.context,
  urgencyDetection,
  governanceSettings: DEFAULT_SOLENOS_SETTINGS,
  depletion: {
    caregiver_depletion_state: "elevated",
    is_single_caregiver: true,
    environmental_dependency_flag: "none",
  },
});
if (!priorityLayer.guarantee.ok) {
  throw new Error(`guarantee failed: ${priorityLayer.guarantee.violations.join("; ")}`);
}
if (priorityLayer.rankedForActionGenerator.length === 0) {
  throw new Error("must pass top-N vectors to Action Generator");
}
if (priorityLayer.rankedForActionGenerator.length > DEFAULT_TOP_N) {
  throw new Error("must not pass more than top N");
}
for (const v of priorityLayer.vectors) {
  if (v.totalScore < 0 || v.totalScore > 1) {
    throw new Error("all scores must be bounded 0–1");
  }
  if (typeof v.components.riskWeight !== "number") {
    throw new Error("riskWeight component must be present");
  }
}
const obs = formatPriorityEngineObservation(priorityLayer);
if (/should |please |I recommend/i.test(obs)) {
  throw new Error("observation must not contain NL action language");
}
if (!obs.includes("PRIORITY_ENGINE")) {
  throw new Error("observation tag required");
}
console.log("✓ processPriorityEngineLayer + guarantee");

// Determinism
const again = processPriorityEngineLayer({
  timeEngine: timeLayer,
  memoryState,
  memoryEnvelope: {
    identityBias: 0,
    patternBias: 0.2,
    operationalBias: 0.5,
    emotionalBias: 0.3,
    compositeInfluence: 0.5,
    interpretationHints: [],
  },
  careProfile,
  careContext: careContext.context,
  urgencyDetection,
  governanceSettings: DEFAULT_SOLENOS_SETTINGS,
  depletion: {
    caregiver_depletion_state: "elevated",
    is_single_caregiver: true,
    environmental_dependency_flag: "none",
  },
  nowMs: Date.now(),
});
// Re-run with fixed now for memory recency — use same nowMs
const fixedNow = 1_700_000_000_000;
const d1 = processPriorityEngineLayer({
  timeEngine: timeLayer,
  memoryState,
  careProfile,
  careContext: careContext.context,
  urgencyDetection,
  governanceSettings: DEFAULT_SOLENOS_SETTINGS,
  nowMs: fixedNow,
});
const d2 = processPriorityEngineLayer({
  timeEngine: timeLayer,
  memoryState,
  careProfile,
  careContext: careContext.context,
  urgencyDetection,
  governanceSettings: DEFAULT_SOLENOS_SETTINGS,
  nowMs: fixedNow,
});
if (JSON.stringify(d1.vectors) !== JSON.stringify(d2.vectors)) {
  throw new Error("priority engine must be deterministic for identical inputs");
}
void again;
console.log("✓ deterministic ordering");

const classification = classifyInputSurface(input);
let behavior = selectBehaviorProfile(classification);
behavior = applyPriorityEngineBehaviorWeighting(behavior, priorityLayer);
const governance = applyPriorityEngineGovernanceWeighting(
  applySettingsGovernance(VERIFY_VALID_SOLENOS, DEFAULT_SOLENOS_SETTINGS, {
    validatedRiskLevel: VERIFY_VALID_SOLENOS.risk_level,
  }),
  priorityLayer,
);
if (governance.moduleWeights.priority <= 0) {
  throw new Error("priority module weight must remain positive");
}
const payload = toPriorityEngineLayerPayload(priorityLayer);
if (payload.rankedActionIds.length === 0) {
  throw new Error("payload must expose ranked action ids");
}
console.log("✓ behavior + governance weighting");

// Guarantee re-check
const guarantee = runPriorityEngineGuarantee({
  weights: priorityLayer.weights,
  vectors: priorityLayer.vectors,
  riskPenaltyApplied: true,
  dependencyEvaluated: true,
  signalsNormalized: true,
});
if (!guarantee.ok) {
  throw new Error(`explicit guarantee failed: ${guarantee.violations.join("; ")}`);
}
console.log("✓ system guarantee checks");

// Pipeline wiring
const pipelineSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);
const timeIdx = pipelineSource.indexOf("processTimeEngineLayer(");
const priorityIdx = pipelineSource.indexOf("processPriorityEngineLayer(");
const geminiIdx = pipelineSource.indexOf("invokeGeminiExecution({");
const priorityGovIdx = pipelineSource.indexOf("applyPriorityEngineGovernanceWeighting(");
if (!(timeIdx > 0 && priorityIdx > timeIdx && priorityIdx < geminiIdx)) {
  throw new Error(
    "pipeline order must be time engine → priority engine → Action Generator (gemini)",
  );
}
if (!pipelineSource.includes("formatPriorityEngineObservation")) {
  throw new Error("pipeline must pass priority engine observation (scores only)");
}
if (!(priorityGovIdx > geminiIdx)) {
  throw new Error("priority governance weighting must run post-reasoning");
}
if (!pipelineSource.includes("priority_engine_layer")) {
  throw new Error("pipeline run must expose priority_engine_layer payload");
}
console.log("✓ analyze-pipeline wiring");

// Source must not implement NL action generation in priority-engine
const engineDir = path.join(process.cwd(), "src/lib/priority-engine");
for (const file of fs.readdirSync(engineDir)) {
  if (!file.endsWith(".ts")) continue;
  const src = fs.readFileSync(path.join(engineDir, file), "utf-8");
  if (/generateAction|writeAction|naturalLanguageAction/i.test(src)) {
    throw new Error(`${file} must not generate actions`);
  }
}
console.log("✓ no action generation in priority-engine sources");

console.log("\n✓ Priority Engine Math Model verified");
