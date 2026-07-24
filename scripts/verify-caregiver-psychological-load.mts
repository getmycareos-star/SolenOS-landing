/**
 * verify-caregiver-psychological-load.mts
 * Moral injury, identity drift, emotional validation, containment mode.
 */

import fs from "node:fs";
import path from "node:path";

import {
  CAREGIVER_PSYCHOLOGICAL_LOAD_IDENTITY,
  CAREGIVER_PSYCHOLOGICAL_LOAD_ONE_LINE_TRUTH,
  CAREGIVER_PSYCHOLOGICAL_LOAD_PIPELINE_POSITION,
  CLI_CONTAINMENT_ZONE,
  CONTAINMENT_MAX_ACTIONS,
  EMOTIONAL_VALIDATION_DEFAULT_MESSAGE,
  detectEmotionalContradictionLoops,
  detectIdentityDrift,
  detectMoralInjury,
  evaluateContainmentMode,
  evaluateEmotionalValidation,
  processCaregiverPsychologicalLoad,
} from "../src/lib/caregiver-psychological-load";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Caregiver Psychological Load ===\n");

assert(
  CAREGIVER_PSYCHOLOGICAL_LOAD_IDENTITY.includes("moral injury"),
  "identity",
);
assert(
  CAREGIVER_PSYCHOLOGICAL_LOAD_ONE_LINE_TRUTH.includes("pure derived"),
  "derived truth",
);
assert(
  CAREGIVER_PSYCHOLOGICAL_LOAD_PIPELINE_POSITION.includes("Moral Injury"),
  "pipeline position",
);
console.log("✓ contract constants");

const highLoad = {
  score: 88,
  state: "CRITICAL" as const,
  activeDemandCount: 6,
  highPressureDemandCount: 3,
  unresolvedSituationCount: 3,
  uncertaintyLoad: 55,
  conflictLoad: 48,
  coordinationLoad: 30,
  timePressureLoad: 50,
  updatedAt: new Date().toISOString(),
};

const guiltInput =
  "I should be able to handle this alone. I'm failing as a caregiver. No matter what I do it's not enough. I must keep doing everything but I'm burned out and have no energy left.";

const moral = detectMoralInjury({
  userInput: guiltInput,
  caregiverLoad: highLoad,
  guiltReplayDetected: true,
  openConflictCount: 2,
  emotionalContradictionLoopCount: 1,
});
assert(moral.severity === "HIGH" || moral.severity === "CRITICAL", "moral injury HIGH+");
assert(moral.indicators.length >= 2, "moral injury indicators");
assert(moral.contributionToLoad > 0 && moral.contributionToLoad <= 1, "contribution 0–1");
console.log("✓ moral injury detection");

const driftInput =
  "I don't know who I am anymore. She doesn't recognize me. All I am is a caregiver now.";
const drift = detectIdentityDrift({
  userInput: driftInput,
  caregiverLoad: highLoad,
  depletionState: "critical",
  unresolvedSituationCount: 3,
});
assert(
  drift.driftLevel === "SIGNIFICANT" || drift.driftLevel === "FRAGMENTED",
  "identity drift SIGNIFICANT+",
);
console.log("✓ identity drift detection");

const loops = detectEmotionalContradictionLoops({
  userInput: guiltInput,
  caregiverLoad: highLoad,
  moralInjury: moral,
});
assert(loops.length >= 1, "emotional contradiction loop detected");
assert(loops[0]!.triggersBehaviorChange, "loop triggers behavior change");
console.log("✓ emotional contradiction loops");

const containment = evaluateContainmentMode({
  caregiverLoad: highLoad,
  moralInjury: moral,
  identityDrift: drift,
  emotionalContradictionLoops: loops,
  deferredDemandTitles: ["Schedule specialist", "Call pharmacy"],
});
assert(containment.engaged, "containment engaged in CLI critical zone");
assert(containment.maxActions === CONTAINMENT_MAX_ACTIONS, "max 1 action");
assert(containment.suppressTaskExpansion, "suppress task expansion");
assert(containment.whatNotToDoToday.length >= 1, "what not to do today");
console.log("✓ containment mode");

const validation = evaluateEmotionalValidation({
  caregiverLoad: highLoad,
  moralInjury: moral,
  identityDrift: drift,
  emotionalContradictionLoops: loops,
  openConflictCount: 2,
  containmentEngaged: true,
});
assert(validation !== null, "emotional validation triggered");
assert(
  validation!.message === EMOTIONAL_VALIDATION_DEFAULT_MESSAGE,
  "default validation message",
);
assert(validation!.normalizeExperience, "normalizeExperience true");
console.log("✓ emotional validation triggers");

const cliNorm = highLoad.score / 100;
assert(
  cliNorm >= CLI_CONTAINMENT_ZONE.min && cliNorm <= CLI_CONTAINMENT_ZONE.max,
  "test load in containment zone",
);

const layer = processCaregiverPsychologicalLoad({
  userInput: guiltInput,
  caregiverLoad: highLoad,
  depletion: {
    caregiver_depletion_state: "critical",
    is_single_caregiver: true,
    environmental_dependency_flag: "none",
  },
  openConflictCount: 2,
  deferredDemandTitles: ["Defer task A"],
});
assert(layer.guarantee.ok, `layer guarantee: ${layer.guarantee.violations.join(", ")}`);
assert(layer.containmentMode.engaged, "process layer containment");
assert(layer.emotionalValidation !== null, "process layer validation");
console.log("✓ processCaregiverPsychologicalLoad guarantee");

const pipelineSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);
const elsIdx = pipelineSource.indexOf("processEmotionalLoadSignalLayer({");
const psychIdx = pipelineSource.indexOf("processCaregiverPsychologicalLoad({");
const earlyConflictIdx = pipelineSource.indexOf("const earlyConflictDetection = processConflictDetection");
const failSafeIdx = pipelineSource.indexOf("// FAIL-SAFE MODE — AFTER Emotional Load Signal");
const humanTrustIdx = pipelineSource.indexOf("// HUMAN TRUST LAYER — AFTER");

assert(elsIdx > 0 && psychIdx > elsIdx, "psych load after emotional load");
assert(psychIdx < earlyConflictIdx, "psych load before conflict");
assert(pipelineSource.includes("emotionalContradictionHints"), "conflict wired with emotional hints");
assert(pipelineSource.includes("emotionalValidation: finalPsychologicalLoad"), "validation in human trust");
assert(failSafeIdx > psychIdx, "fail-safe after psych load post-decision");
assert(humanTrustIdx > failSafeIdx, "human trust after fail-safe");
console.log("✓ analyze-pipeline wiring");

const decisionCardSource = fs.readFileSync(
  path.join(process.cwd(), "src/components/ui-runtime/DecisionCardView.tsx"),
  "utf-8",
);
assert(decisionCardSource.includes("emotional-validation"), "DecisionCard validation UI");
assert(decisionCardSource.includes("What NOT to do today"), "DecisionCard what-not-to-do");
console.log("✓ DecisionCard containment UI");

console.log("\n✓ Caregiver Psychological Load verified");
