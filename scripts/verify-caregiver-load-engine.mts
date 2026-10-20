/**
 * verify-caregiver-load-engine.mts
 * Asserts Caregiver Load Engine: 5 dimensions, dependency load, unified burnout, burden messages, pipeline wiring.
 */

import fs from "node:fs";
import path from "node:path";

import {
  ACTION_REDUCTION_LIMITS,
  BURDEN_DRIVERS,
  CAREGIVER_LOAD_ENGINE_ANTI_PATTERNS,
  CAREGIVER_LOAD_ENGINE_FORBIDDEN,
  CAREGIVER_LOAD_ENGINE_IDENTITY,
  CAREGIVER_LOAD_ENGINE_NORTH_STAR,
  CAREGIVER_LOAD_ENGINE_PIPELINE_POSITION,
  DEPENDENCY_LOAD_PATTERNS,
  STAGE_BURDEN_DRIVERS,
  buildBurdenSummary,
  computeBurnoutRisk,
  containsForbiddenKnowledge,
  deriveActionReduction,
  detectLoadSignalFamilies,
  inferDependencyStage,
  processCaregiverLoadEngine,
  resetCaregiverLoadStores,
  saveLoadScores,
  getLoadScores,
  scoreLoadDimensions,
  toCaregiverLoadEngineLayerPayload,
} from "../src/lib/caregiver-load-engine";
import {
  V14_ANTI_PATTERNS,
  V14_ENGINE_MODULES,
  V14_PRODUCT_NORTH_STAR,
} from "../src/lib/solenos-layers/architecture-map";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Caregiver Load Engine ===\n");

assert(
  CAREGIVER_LOAD_ENGINE_IDENTITY.includes("burden"),
  "identity must mention burden",
);
assert(
  CAREGIVER_LOAD_ENGINE_NORTH_STAR.includes("burden reduction"),
  "north star",
);
assert(
  CAREGIVER_LOAD_ENGINE_PIPELINE_POSITION.includes("CAREGIVER LOAD ENGINE"),
  "pipeline position",
);
assert(
  CAREGIVER_LOAD_ENGINE_FORBIDDEN.some((f) => f.includes("pathology")),
  "forbids pathology education",
);
assert(CAREGIVER_LOAD_ENGINE_ANTI_PATTERNS.length >= 4, "anti-patterns declared");
assert(V14_PRODUCT_NORTH_STAR.includes("caregiver"), "architecture north star");
assert(V14_ANTI_PATTERNS.some((p) => p.includes("symptom checker")), "v14 anti-patterns");
console.log("✓ contract constants + north star");

const engineMod = V14_ENGINE_MODULES.find((m) => m.spec.includes("Caregiver Load Engine"));
assert(engineMod?.status === "implemented", "architecture map lists Caregiver Load Engine");
assertPathExists("src/lib/caregiver-load-engine", "Caregiver Load Engine path");
console.log("✓ architecture map entry");

assert(DEPENDENCY_LOAD_PATTERNS.supervision.length >= 2, "supervision patterns");
assert(DEPENDENCY_LOAD_PATTERNS.assistance.length >= 2, "assistance patterns");
assert(BURDEN_DRIVERS.length >= 6, "burden drivers registry");
assert(containsForbiddenKnowledge("plaques and tau in the hippocampus"), "forbidden knowledge filter detects pathology");
assert(!containsForbiddenKnowledge("He yells at night and I can't sleep"), "forbidden knowledge filter allows burden language");
console.log("✓ dementia-context (burden-only)");

const abuseSleepInput =
  "He was yelling cruel words at me again. I am sleepless and exhausted nights are breaking me. I don't know what's next — everything is unpredictable.";
const signals = detectLoadSignalFamilies(abuseSleepInput);
assert(signals.emotionalDistress >= 0.35, "verbal abuse → emotional distress");
assert(signals.sleep >= 0.35, "sleepless → sleep");
assert(signals.uncertainty >= 0.35, "unpredictable → uncertainty");
console.log("✓ signal detection (emotional + sleep + uncertainty)");

const dependencyInput =
  "I can't leave him alone anymore. He needs help with everything — dressing, bathing, feeding. Each week is harder.";
const depSignals = detectLoadSignalFamilies(dependencyInput);
const depScores = scoreLoadDimensions(depSignals);
assert(depScores.dependencyLoadScore >= 35, "dependency load score from supervision + assistance");
assert(inferDependencyStage({ rawInput: dependencyInput, dependencyLoadScore: depScores.dependencyLoadScore }) !== "early", "dependency stage inference");
console.log("✓ dependency load score (NEW dimension)");

const vigilanceInput =
  "I am always watching, on edge and vigilant. Same questions over and over. I am overwhelmed and can't cope anymore.";
const vigilanceSignals = detectLoadSignalFamilies(vigilanceInput);
const vigilanceScores = scoreLoadDimensions(vigilanceSignals);
assert(vigilanceScores.cognitiveLoadScore >= 35, "vigilance + repetition → cognitive load");
console.log("✓ cognitive load scoring");

const burnout = computeBurnoutRisk({
  scores: vigilanceScores,
  burnoutLanguageSignal: vigilanceSignals.burnoutLanguage,
  acuteBurnoutTriggered: false,
});
assert(burnout.probability >= 0.35, "burnout from load combination");
assert(["stable", "rising", "critical"].includes(burnout.trend), "burnout trend");
console.log("✓ unified burnout calculation");

const acuteBurnout = computeBurnoutRisk({
  scores: depScores,
  burnoutLanguageSignal: depSignals.burnoutLanguage,
  acuteBurnoutTriggered: true,
});
assert(acuteBurnout.acuteTriggered === true, "acute burnout triad elevates probability");
assert(acuteBurnout.probability >= 0.72, "acute floor applied");
console.log("✓ acute burnout unification");

const engineForBurden = processCaregiverLoadEngine({ rawInput: vigilanceInput });
assert(
  engineForBurden.state.burdenStatements.some((s) =>
    /held|Living Care Record|sleep|uncertaint|care needs|shared/i.test(s),
  ),
  "record-based burden statements",
);
assert(
  !engineForBurden.state.burdenStatements.some((s) => /burnout risk|%\b|experiencing elevated/i.test(s)),
  "no burnout-risk or invented strain theater",
);
const summary = buildBurdenSummary(engineForBurden.state.burdenStatements);
assert(summary.length > 10, "burden summary");
console.log("✓ burden message generation");

const loadFirst = engineForBurden.state.loadFirstMode;
assert(loadFirst === true, "loadFirstMode from multi-signal input");
const reduction = deriveActionReduction({
  scores: engineForBurden.state.scores,
  loadFirstMode: loadFirst,
  burnoutProbability: engineForBurden.state.burnout.probability,
  acuteBurnoutTriggered: false,
});
assert(reduction.maxActions <= ACTION_REDUCTION_LIMITS.loadFirst + 1, "action reduction limits surface");
assert(reduction.suppressEducation === true, "suppress education when load detected");
console.log("✓ action reduction strategy");

const engine = processCaregiverLoadEngine({ rawInput: abuseSleepInput });
assert(engine.guarantee.ok, `engine guarantee: ${engine.guarantee.violations.join(", ")}`);
assert(engine.state.scores.dependencyLoadScore >= 0, "dependency in engine state");
assert(engine.loadInterpretation.loadFirstMode === true, "engine loadFirstMode");
const payload = toCaregiverLoadEngineLayerPayload(engine);
assert(payload.dependencyLoadScore === engine.state.scores.dependencyLoadScore, "layer payload dependency");
assert(typeof payload.burnoutTrend === "string", "payload burnout trend");
console.log("✓ process + layer payload");

resetCaregiverLoadStores();
saveLoadScores("test-session", engine.state.scores);
assert(getLoadScores("test-session")?.emotionalLoadScore === engine.state.scores.emotionalLoadScore, "in-memory store");
console.log("✓ in-memory stores");

const pipelineSrc = fs.readFileSync(
  path.join(root, "src/lib/analyze-pipeline/index.ts"),
  "utf8",
);
assert(pipelineSrc.includes("processCaregiverLoadEngine"), "analyze-pipeline imports engine");
assert(pipelineSrc.includes("caregiver_load_engine"), "analyze-pipeline emits caregiver_load_engine payload");
assert(pipelineSrc.includes("toCaregiverLoadEngineLayerPayload"), "analyze-pipeline layer payload");
console.log("✓ analyze-pipeline wiring");

const calm = processCaregiverLoadEngine({ rawInput: "Mom had a quiet morning. Vitals stable." });
assert(calm.state.loadFirstMode === false, "calm input does not engage loadFirstMode");
console.log("✓ loadFirstMode fail-safe");

assert(STAGE_BURDEN_DRIVERS.early.length >= 2, "progressive dependency model early");
assert(STAGE_BURDEN_DRIVERS.late.some((d) => d.includes("supervision")), "progressive dependency model late");
console.log("✓ progressive dependency model");

console.log("\n=== All Caregiver Load Engine checks passed ===\n");

function assertPathExists(relPath: string, label: string): void {
  const candidates = [
    path.join(root, relPath),
    path.join(root, relPath, "index.ts"),
  ];
  const found = candidates.some((p) => fs.existsSync(p));
  assert(found, `${label}: path missing — ${relPath}`);
}
