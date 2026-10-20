/**
 * verify-interaction-load-signal.mts
 * Caregiver Interaction Load Problem — pattern detection, metrics, output strategy.
 */

import fs from "node:fs";
import path from "node:path";

import {
  BOUNDARY_VIOLATION_STRESS_THRESHOLD,
  INTERACTION_LOAD_FLAG_DESCRIPTIONS,
  INTERACTION_LOAD_SIGNAL_FORBIDDEN,
  INTERACTION_LOAD_SIGNAL_IDENTITY,
  INTERACTION_LOAD_SIGNAL_ONE_LINE_TRUTH,
  INTERACTION_LOAD_SIGNAL_PIPELINE_POSITION,
  INTERACTION_LOAD_SYSTEM_INSIGHT,
  INTERACTION_PATTERN_HIT,
  REPETITION_FATIGUE_THRESHOLD,
  applyInteractionLoadToCliInputs,
  applyInteractionLoadToEmotionalInputs,
  computeBoundaryViolationIndex,
  detectInteractionLoadSignals,
  evaluateInteractionLoadFlags,
  evaluateSleepProtectionMode,
  isInteractionLoadDetected,
  processInteractionLoadSignal,
  shapeInteractionSurvivabilityOutput,
} from "../src/lib/interaction-load-signal";
import { V14_ENGINE_MODULES } from "../src/lib/solenos-layers";
import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Interaction Load Signal ===\n");

assert(
  INTERACTION_LOAD_SIGNAL_IDENTITY.includes("psychologically disengaging"),
  "identity",
);
assert(
  INTERACTION_LOAD_SIGNAL_ONE_LINE_TRUTH.includes("interaction survivability"),
  "one-line truth",
);
assert(
  INTERACTION_LOAD_SIGNAL_PIPELINE_POSITION.includes("INTERACTION LOAD SIGNAL"),
  "pipeline position",
);
assert(
  INTERACTION_LOAD_SIGNAL_FORBIDDEN.some((f) => f.includes("medical diagnosis")),
  "forbids medical diagnosis",
);
console.log("✓ contract constants");

const specInput =
  "She asks the same questions over and over. I can't redirect the conversation and she keeps calling at night. I'm emotionally exhausted and feel constantly on call — never off duty.";

const signals = detectInteractionLoadSignals(specInput);
assert(signals.matchedCategories.length >= 3, "multiple pattern categories matched");
assert(signals.repetitiveQuestioning >= INTERACTION_PATTERN_HIT, "repetitive questioning");
assert(signals.redirectFailure >= INTERACTION_PATTERN_HIT, "redirect failure");
assert(signals.nighttimeInterruption >= INTERACTION_PATTERN_HIT, "nighttime interruption");
assert(signals.alwaysOnCall >= INTERACTION_PATTERN_HIT, "always on call");
console.log("✓ pattern detection on spec input");

const bvi = computeBoundaryViolationIndex(signals);
assert(bvi >= BOUNDARY_VIOLATION_STRESS_THRESHOLD, "boundary violation index elevated");
console.log("✓ Boundary Violation Index");

const layer = processInteractionLoadSignal({ rawInput: specInput });
assert(layer.detected === true, "interaction load detected");
assert(layer.outputStrategy === "interaction_survivability", "interaction survivability strategy");
assert(layer.sleepProtectionMode.engaged === true, "sleep protection engaged");
assert(
  layer.metrics.sleepDisruptionRisk === "CRITICAL",
  "sleep disruption risk CRITICAL",
);
assert(layer.systemInsight === INTERACTION_LOAD_SYSTEM_INSIGHT, "system insight");
assert(layer.guarantee.ok === true, "guarantee ok");

const flags = evaluateInteractionLoadFlags(signals, layer.metrics);
assert(flags.some((f) => f.code === "repetition_fatigue"), "repetition_fatigue flag");
assert(flags.some((f) => f.code === "boundary_stress"), "boundary_stress flag");
assert(
  INTERACTION_LOAD_FLAG_DESCRIPTIONS.repetition_fatigue === "high recurrence interaction detected",
  "repetition fatigue description",
);
assert(
  INTERACTION_LOAD_FLAG_DESCRIPTIONS.boundary_stress === "user unable to redirect or disengage",
  "boundary stress description",
);
console.log("✓ flags + sleep protection + output strategy");

const empty = detectInteractionLoadSignals("");
assert(empty.matchedCategories.length === 0, "empty input → no matches");
assert(isInteractionLoadDetected(empty, []) === false, "empty not detected");
console.log("✓ empty input baseline");

const cliInputs = {
  activeDemandCount: 3,
  highPressureDemandCount: 1,
  unresolvedSituationCount: 2,
  uncertaintyLoad: 30,
  conflictLoad: 25,
  coordinationLoad: 20,
  timePressureLoad: 15,
};
const boostedCli = applyInteractionLoadToCliInputs(cliInputs, layer);
assert(boostedCli.conflictLoad > cliInputs.conflictLoad, "CLI conflict boost");
assert(boostedCli.coordinationLoad > cliInputs.coordinationLoad, "CLI coordination boost");

const emotionalInputs = {
  activeSituationCount: 2,
  unresolvedSituationCount: 1,
  activeDemandCount: 3,
  highPressureDemandCount: 1,
  highUrgencyDemandCount: 1,
  pendingConflictCount: 0,
  uncertaintyLoad: 30,
  conflictLoad: 25,
  operationalLoadScore: 45,
  emotionalBias: 0.2,
  depletionFactor: 0.3,
};
const boostedEmotional = applyInteractionLoadToEmotionalInputs(emotionalInputs, layer);
assert(boostedEmotional.depletionFactor > emotionalInputs.depletionFactor, "ELS depletion boost");
assert(boostedEmotional.conflictLoad > emotionalInputs.conflictLoad, "ELS conflict boost");
console.log("✓ CLI + Emotional Load metric wiring");

const shaped = shapeInteractionSurvivabilityOutput({
  response: VERIFY_VALID_SOLENOS,
  layer,
});
assert(
  !/schedule|checklist|step \d/i.test(shaped.what_to_ask_next),
  "suppresses procedural next action",
);
assert(shaped.what_is_happening.includes("overload"), "normalization in what_is_happening");
console.log("✓ interaction survivability output shaping");

const mod = V14_ENGINE_MODULES.find((m) => m.spec === "Interaction Load Signal");
assert(mod?.status === "implemented", "v1.4 audit matrix entry");
assert(
  fs.existsSync(path.join(process.cwd(), "src/lib/interaction-load-signal/index.ts")),
  "module path exists",
);

const pipelineSrc = fs.readFileSync(
  path.join(process.cwd(), "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);
assert(pipelineSrc.includes("processInteractionLoadSignal"), "pipeline runs interaction load");
assert(pipelineSrc.includes("interaction_load_layer"), "pipeline exposes interaction_load_layer");
assert(pipelineSrc.includes("shapeInteractionSurvivabilityOutput"), "pipeline shapes output");
console.log("✓ pipeline + architecture wiring");

console.log("\n=== All Interaction Load Signal checks passed ===");
