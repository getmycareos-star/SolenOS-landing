/**
 * verify-load-interpretation.mts
 * Asserts Load-First Interpretation: heuristic detection, loadFirstMode rules, pipeline wiring.
 */

import fs from "node:fs";
import path from "node:path";

import {
  LOAD_FIRST_BURNOUT_THRESHOLD,
  LOAD_FIRST_EMOTIONAL_SCORE_THRESHOLD,
  LOAD_FIRST_MINIMAL_ACTION,
  LOAD_FIRST_MIN_SIGNAL_CATEGORIES,
  LOAD_INTERPRETATION_FORBIDDEN,
  LOAD_INTERPRETATION_IDENTITY,
  LOAD_INTERPRETATION_ONE_LINE_TRUTH,
  LOAD_INTERPRETATION_PIPELINE_POSITION,
  LOAD_SIGNAL_PATTERNS,
  applyLoadInterpretationToEmotionalInputs,
  buildBurdenSummary,
  detectLoadSignals,
  processLoadInterpretation,
  shapeLoadFirstOutput,
  toLoadInterpretationLayerPayload,
} from "../src/lib/load-interpretation";
import { buildEmotionalLoadSignalInputs, processEmotionalLoadSignalLayer } from "../src/lib/emotional-load-signal";
import type { CaregiverLoad } from "../src/lib/caregiver-load-index/types";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Load-First Interpretation ===\n");

assert(
  LOAD_INTERPRETATION_IDENTITY.includes("burden"),
  "identity must mention burden",
);
assert(
  LOAD_INTERPRETATION_ONE_LINE_TRUTH.includes("recognition-first"),
  "one-line truth",
);
assert(
  LOAD_INTERPRETATION_PIPELINE_POSITION.includes("LOAD INTERPRETATION"),
  "pipeline position",
);
assert(
  LOAD_INTERPRETATION_FORBIDDEN.some((f) => f.includes("LLM classification")),
  "forbids LLM classification for MVP",
);
console.log("✓ contract constants");

assert(LOAD_SIGNAL_PATTERNS.emotionalLoad.length >= 2, "emotional load patterns");
assert(LOAD_SIGNAL_PATTERNS.sleepRisk.length >= 2, "sleep risk patterns");
assert(LOAD_SIGNAL_PATTERNS.uncertaintyIndex.length >= 2, "uncertainty patterns");
assert(LOAD_SIGNAL_PATTERNS.cognitiveLoad.length >= 2, "cognitive load patterns");
assert(LOAD_SIGNAL_PATTERNS.burnoutProbability.length >= 2, "burnout patterns");
console.log("✓ signal pattern registry");

const abuseSleepInput =
  "He was yelling cruel words at me again. I am sleepless and exhausted nights are breaking me. I don't know what's next — everything is unpredictable.";
const abuseSignals = detectLoadSignals(abuseSleepInput);
assert(abuseSignals.emotionalLoad >= 0.35, "verbal abuse → emotional load");
assert(abuseSignals.sleepRisk >= 0.35, "sleepless → sleep risk");
assert(abuseSignals.uncertaintyIndex >= 0.35, "unpredictable → uncertainty");
console.log("✓ hidden signal mapping (abuse + sleep + uncertainty)");

const vigilanceInput =
  "I am always watching, on edge and vigilant. I am overwhelmed and can't cope anymore.";
const vigilanceSignals = detectLoadSignals(vigilanceInput);
assert(vigilanceSignals.cognitiveLoad >= 0.35, "vigilant → cognitive load");
assert(vigilanceSignals.burnoutProbability >= 0.35, "overwhelmed → burnout");
console.log("✓ hidden signal mapping (vigilance + burnout)");

const loadFirst = processLoadInterpretation({ rawInput: abuseSleepInput });
assert(loadFirst.loadFirstMode === true, "multi-signal input engages loadFirstMode");
assert(loadFirst.primaryContributors.length >= 2, "primary contributors populated");
assert(
  loadFirst.burdenSummary.includes("contributor"),
  "burdenSummary is recognition-first",
);
assert(loadFirst.emotionalLoadScore >= LOAD_FIRST_EMOTIONAL_SCORE_THRESHOLD - 10, "emotional load score");
console.log("✓ loadFirstMode + burdenSummary");

const calmInput = "Mom had a quiet morning. Vitals stable. No concerns today.";
const calm = processLoadInterpretation({ rawInput: calmInput });
assert(calm.loadFirstMode === false, "calm clinical input does not engage loadFirstMode");
console.log("✓ loadFirstMode fail-safe (low load)");

const payload = toLoadInterpretationLayerPayload(loadFirst);
assert(payload.loadFirstMode === loadFirst.loadFirstMode, "payload round-trip");
assert(payload.burdenSummary === loadFirst.burdenSummary, "payload burdenSummary");
console.log("✓ layer payload");

const shaped = shapeLoadFirstOutput({
  response: {
    what_is_happening: "Try these 5 dementia techniques for redirection.",
    what_matters_now: "Medication education is important.",
    what_to_ask_next: "Review dementia care tips and schedule a neurology visit.",
    risk_level: "medium",
    what_can_wait: "Housekeeping",
  },
  interpretation: loadFirst,
  deferredDemandTitles: ["Laundry"],
});
assert(
  shaped.what_is_happening.includes(loadFirst.burdenSummary.slice(0, 40)),
  "what_is_happening leads with burden",
);
assert(
  !/^try these/i.test(shaped.what_is_happening),
  "suppresses care-tip lead in what_is_happening",
);
assert(
  shaped.what_to_ask_next.includes(LOAD_FIRST_MINIMAL_ACTION.slice(0, 30)),
  "caps next action to minimal/containment when care-tip lead",
);
assert(shaped.what_can_wait.includes("ignored today"), "expands what_can_wait");
assert(shaped.what_can_wait.includes("Laundry"), "includes deferred demands");
console.log("✓ post-LLM output shaping");

const baseLoad: CaregiverLoad = {
  score: 52,
  state: "MODERATE",
  activeDemandCount: 2,
  highPressureDemandCount: 1,
  unresolvedSituationCount: 1,
  uncertaintyLoad: 30,
  conflictLoad: 25,
  coordinationLoad: 20,
  timePressureLoad: 15,
  updatedAt: new Date().toISOString(),
};

const baseInputs = buildEmotionalLoadSignalInputs({
  caregiverLoad: baseLoad,
  demands: [],
  baseTopN: 3,
});
const boosted = applyLoadInterpretationToEmotionalInputs(baseInputs, loadFirst);
assert(boosted.uncertaintyLoad > baseInputs.uncertaintyLoad, "boosts uncertaintyLoad");
assert(boosted.depletionFactor > baseInputs.depletionFactor, "boosts depletion from sleepRisk");
console.log("✓ emotional load signal integration");

const layer = processEmotionalLoadSignalLayer({
  caregiverLoad: baseLoad,
  demands: [],
  baseTopN: 3,
  loadInterpretation: loadFirst,
});
assert(layer.signal.compositeScore >= 0, "emotional load layer accepts loadInterpretation");
console.log("✓ emotional load layer wiring");

const root = process.cwd();
const pipelineSrc = fs.readFileSync(
  path.join(root, "src/lib/analyze-pipeline/index.ts"),
  "utf8",
);
assert(pipelineSrc.includes("processLoadInterpretation"), "pipeline calls processLoadInterpretation");
assert(pipelineSrc.includes("shapeLoadFirstOutput"), "pipeline calls shapeLoadFirstOutput");
assert(pipelineSrc.includes("loadInterpretationObservation"), "pipeline emits observation tag");
assert(
  pipelineSrc.includes("loadInterpretation,"),
  "pipeline passes loadInterpretation to emotional load",
);
console.log("✓ analyze-pipeline wiring");

const decisionCardSrc = fs.readFileSync(
  path.join(root, "src/components/ui-runtime/DecisionCardView.tsx"),
  "utf8",
);
assert(decisionCardSrc.includes("load-first-burden"), "DecisionCardView shows burden block");
console.log("✓ DecisionCardView wiring");

const humanTrustSrc = fs.readFileSync(
  path.join(root, "src/lib/human-trust-layer/build-explanation.ts"),
  "utf8",
);
assert(humanTrustSrc.includes("loadFirstMode"), "human trust references loadFirstMode");
console.log("✓ human-trust-layer wiring");

console.log("\n=== Load-First Interpretation verify OK ===");
console.log(`Thresholds: score≥${LOAD_FIRST_EMOTIONAL_SCORE_THRESHOLD}, burnout≥${LOAD_FIRST_BURNOUT_THRESHOLD}, categories≥${LOAD_FIRST_MIN_SIGNAL_CATEGORIES}`);
console.log(`Example burden: ${loadFirst.burdenSummary.slice(0, 120)}…`);
