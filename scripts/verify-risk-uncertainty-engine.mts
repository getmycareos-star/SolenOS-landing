/**
 * verify-risk-uncertainty-engine.mts
 * Mandatory Risk & Uncertainty Engine — completeness gate before priority assignment.
 */

import fs from "node:fs";
import path from "node:path";

import {
  processRiskUncertainty,
  buildGateBlockedResponse,
  buildBlockedSolenOSResponse,
  enforceOutputSafety,
  checkInformationCompleteness,
  runDecisionGate,
  classifyPriority,
  RISK_UNCERTAINTY_BOUNDARY,
  PROHIBITED_WHEN_INSUFFICIENT,
} from "../src/lib/risk-uncertainty-engine";
import { withMeta } from "../src/lib/response-validator";
import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Risk & Uncertainty Engine ===\n");

const fallVague = "Mom fell.";
const completeness = checkInformationCompleteness(fallVague);
assert(completeness.status === "INSUFFICIENT", "vague fall is INSUFFICIENT");
assert(completeness.missing_signals.length > 0, "missing safety signals listed");
console.log("✓ domain trigger — falls require safety context");

const gate = runDecisionGate(completeness.status);
assert(gate.blocked === true, "INSUFFICIENT blocks decision gate");
console.log("✓ decision gate blocks when insufficient");

const blocked = processRiskUncertainty(fallVague);
assert(blocked.blocked === true, "pipeline blocks vague fall");
assert(blocked.output.priority_assessment === "Unable to Determine", "no priority when blocked");
assert(blocked.output.confidence_level === "Insufficient Information", "insufficient confidence");
assert(blocked.output.decision_gate_blocked === true, "gate blocked flag set");
console.log("✓ no priority/urgency when information missing");

const blockedResponse = buildGateBlockedResponse(fallVague);
assert(
  blockedResponse.result.what_matters_now.includes("Unable to determine priority"),
  "blocked response states unable to determine",
);
assert(blockedResponse.result.risk_level !== "low", "never assigns low risk when insufficient");
assert(
  !/monitor and observe/i.test(blockedResponse.result.what_can_wait),
  "no generic monitor reassurance",
);
console.log("✓ prohibited behaviors — no low priority, no monitor reassurance");

const fallComplete =
  "Mom fell in the bathroom this morning. She hit her head but is awake and responsive. We called the doctor and they said to watch for dizziness.";
const completeResult = processRiskUncertainty(fallComplete);
assert(!completeResult.blocked, "detailed fall context not blocked");
assert(
  completeResult.output.information_completeness === "COMPLETE" ||
    completeResult.output.information_completeness === "PARTIALLY_COMPLETE",
  "detailed fall context allows classification path",
);
console.log("✓ sufficient context allows classification");

const dizzyPartial = "Mom seems dizzy again.";
const partialResult = processRiskUncertainty(dizzyPartial);
assert(
  partialResult.blocked ||
    partialResult.output.priority_assessment === "Unable to Determine" ||
    partialResult.output.information_completeness !== "COMPLETE",
  "symptom without full context blocked or undetermined",
);
console.log("✓ symptom domain trigger without full context");

const classification = classifyPriority("PARTIALLY_COMPLETE", "She has chest pain");
assert(
  classification.priority === "High Priority" || classification.priority === "Unable to Determine",
  "partial only high if explicit critical signals",
);
console.log("✓ partial classification conservative");

const safeOutput = withMeta(VERIFY_VALID_SOLENOS);
const enforced = enforceOutputSafety(
  { ...safeOutput, risk_level: "low", what_can_wait: "Monitor and observe for now." },
  blocked.output,
);
assert(enforced.risk_level !== "low", "enforcement removes low risk when gate blocked");
assert(!/monitor and observe/i.test(enforced.what_can_wait), "strips forbidden reassurance");
console.log("✓ post-output enforcement");

assert(RISK_UNCERTAINTY_BOUNDARY.includes("Absence of data"), "fallacy prevention rule");
assert(PROHIBITED_WHEN_INSUFFICIENT.includes("assign priority"), "prohibited list documented");
console.log("✓ system safety constraints documented");

const required = [
  "src/lib/risk-uncertainty-engine/index.ts",
  "src/lib/risk-uncertainty-engine/process.ts",
  "src/lib/risk-uncertainty-engine/domain-triggers.ts",
  "src/lib/risk-uncertainty-engine/completeness-check.ts",
  "src/lib/risk-uncertainty-engine/decision-gate.ts",
  "src/components/ops-devtools/RiskUncertaintyPanel.tsx",
];

for (const rel of required) {
  assert(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
}

const pipeline = fs.readFileSync(path.join(root, "src/lib/analyze-pipeline/index.ts"), "utf-8");
assert(pipeline.includes("processRiskUncertainty"), "wired into analyze pipeline");
assert(pipeline.includes("risk_uncertainty_layer"), "layer exposed in pipeline output");
assert(pipeline.includes("applyRiskUncertaintyToResponse"), "post-output enforcement wired");

const validator = fs.readFileSync(path.join(root, "src/lib/response-validator/index.ts"), "utf-8");
assert(validator.includes("what_is_happening"), "SolenOSResponse schema unchanged");

console.log("\n=== Risk & Uncertainty Engine verification complete ===");
