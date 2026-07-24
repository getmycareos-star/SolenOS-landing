/**
 * verify-high-signal-stress.mts
 * High-Signal Stress Pattern — detection, acute burnout classification, containment mode.
 */

import fs from "node:fs";
import path from "node:path";

import {
  ACUTE_BURNOUT_GROUNDING_MESSAGE,
  CONTAINMENT_MAX_ACTIONS,
  detectHighSignalStressPattern,
  evaluateContainmentMode,
  highSignalStressMetricBoosts,
  processCaregiverPsychologicalLoad,
  shapeContainmentOutput,
  toHighSignalStressLayerPayload,
} from "../src/lib/caregiver-psychological-load";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS High-Signal Stress Pattern ===\n");

const acuteInput =
  "He yelled at me again last night — verbal abuse is constant. I have sleepless nights and haven't slept in days. I don't know what's next; everything is unpredictable and I can't anticipate anything.";

const partialInput = "I'm overwhelmed and exhausted but managing.";

const acute = detectHighSignalStressPattern({ userInput: acuteInput });
assert(acute.emotionalLoadScore === "HIGH", "emotional load HIGH");
assert(acute.sleepDisruptionRisk === "CRITICAL", "sleep disruption CRITICAL");
assert(acute.uncertaintyIndex === "HIGH", "uncertainty HIGH");
assert(acute.safetyStressEnvironmentFlag === true, "safety/stress environment flag");
assert(acute.acuteCaregiverBurnoutRiskState === true, "acute burnout risk state");
assert(acute.groundingMessage === ACUTE_BURNOUT_GROUNDING_MESSAGE, "grounding message");
assert(
  acute.signals.emotionalHarm.detected &&
    acute.signals.sleepDisruption.detected &&
    acute.signals.uncertaintyOverload.detected,
  "all three signal families",
);
console.log("✓ acute burnout detection + classification");

const partial = detectHighSignalStressPattern({ userInput: partialInput });
assert(partial.acuteCaregiverBurnoutRiskState === false, "partial input not acute");
assert(partial.emotionalLoadScore === "HIGH" || partial.emotionalLoadScore === "MEDIUM", "partial emotional");
console.log("✓ partial signal detection");

const boosts = highSignalStressMetricBoosts(acute);
assert(boosts.uncertaintyLoadFloor >= 75, "uncertainty boost");
assert(boosts.depletionFactorFloor >= 0.85, "depletion boost");
assert(boosts.compositeScoreFloor >= 78, "composite boost");
console.log("✓ metric boosts for ELS/CLI");

const baseLoad = {
  score: 55,
  state: "MODERATE" as const,
  activeDemandCount: 3,
  highPressureDemandCount: 1,
  unresolvedSituationCount: 1,
  uncertaintyLoad: 30,
  conflictLoad: 20,
  coordinationLoad: 15,
  timePressureLoad: 25,
  updatedAt: new Date().toISOString(),
};

const containment = evaluateContainmentMode({
  caregiverLoad: baseLoad,
  moralInjury: {
    severity: "LOW",
    indicators: [],
    contributionToLoad: 0.1,
    explanation: "none",
  },
  identityDrift: { driftLevel: "STABLE", signals: [], explanation: "stable" },
  emotionalContradictionLoops: [],
  highSignalStress: acute,
});
assert(containment.engaged, "containment engaged on acute burnout");
assert(containment.maxActions === CONTAINMENT_MAX_ACTIONS, "max 1 action");
assert(containment.acuteBurnoutTriggered === true, "acuteBurnoutTriggered flag");
assert(containment.suppressTaskExpansion, "suppress task expansion");
console.log("✓ containment mode trigger");

const layer = processCaregiverPsychologicalLoad({
  userInput: acuteInput,
  caregiverLoad: baseLoad,
  highSignalStress: acute,
});
assert(layer.guarantee.ok, `layer guarantee: ${layer.guarantee.violations.join(", ")}`);
assert(layer.containmentMode.engaged, "process layer containment");
assert(layer.emotionalValidation !== null, "emotional validation");
assert(
  layer.emotionalValidation!.message === ACUTE_BURNOUT_GROUNDING_MESSAGE,
  "acute grounding validation",
);
console.log("✓ processCaregiverPsychologicalLoad integration");

const payload = toHighSignalStressLayerPayload(acute, true);
assert(payload.acuteCaregiverBurnoutRiskState, "payload acute flag");
assert(payload.containmentModeEngaged, "payload containment");
console.log("✓ layer payload");

const shaped = shapeContainmentOutput({
  response: {
    what_is_happening: "Schedule three appointments and track symptoms daily.",
    what_matters_now: "Medication adherence plan",
    what_to_ask_next: "Step 1: call doctor. Step 2: update chart. Step 3: log vitals.",
    what_can_wait: "Nothing",
    risk_level: "medium",
  },
  highSignalStress: acute,
  deferredDemandTitles: ["Pharmacy call"],
});
assert(
  shaped.what_to_ask_next.includes("breath") || shaped.what_to_ask_next.includes("no care"),
  "minimal grounding action",
);
assert(!shaped.what_to_ask_next.includes("Step 2"), "no multi-step tasks");
assert(shaped.what_can_wait.includes("Multi-step"), "defer care plans");
console.log("✓ containment output enforcement");

const pipelineSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);
assert(pipelineSource.includes("detectHighSignalStressPattern"), "pipeline detection");
assert(pipelineSource.includes("high_signal_stress_layer"), "pipeline layer payload");
assert(pipelineSource.includes("shapeContainmentOutput"), "pipeline output shaping");
assert(pipelineSource.includes("highSignalStressObservation"), "pipeline observation tag");
console.log("✓ analyze-pipeline wiring");

console.log("\n✓ High-Signal Stress Pattern verified");
