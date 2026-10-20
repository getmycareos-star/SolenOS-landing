/**
 * verify-fail-safe-mode.mts
 * FAIL-SAFE MODE — CRITICAL SYSTEM SAFETY RULE (post-decision gate).
 */

import fs from "node:fs";
import path from "node:path";
import {
  FAIL_SAFE_MODE_FORBIDDEN,
  FAIL_SAFE_MODE_IDENTITY,
  FAIL_SAFE_MODE_ONE_LINE_TRUTH,
  FAIL_SAFE_MODE_PIPELINE_POSITION,
  FAIL_SAFE_CLARIFY_ACTION_ID,
  applyFailSafeClarificationToResponse,
  buildClarificationModeOutput,
  buildDecisionConfidence,
  buildEscalationQuestions,
  evaluateFailSafeTriggers,
  processFailSafeMode,
  runFailSafeGuarantee,
  toFailSafeModeLayerPayload,
  type FailSafeModeInput,
} from "../src/lib/fail-safe-mode";
import { LAYER_ARCHITECTURE_MAP } from "../src/lib/solenos-layers";
import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS FAIL-SAFE MODE ===\n");

assert(
  FAIL_SAFE_MODE_IDENTITY.includes("pause") ||
    FAIL_SAFE_MODE_IDENTITY.includes("uncertainty"),
  "identity must declare pause-under-uncertainty posture",
);
assert(
  FAIL_SAFE_MODE_ONE_LINE_TRUTH.includes("wrong assumptions") ||
    FAIL_SAFE_MODE_ONE_LINE_TRUTH.includes("missing truth"),
  "one-line truth must forbid harmful guessing",
);
assert(
  FAIL_SAFE_MODE_PIPELINE_POSITION.includes("after Decision"),
  "pipeline must place Fail-Safe after Decision Engine",
);
assert(
  FAIL_SAFE_MODE_PIPELINE_POSITION.includes("before Human Trust"),
  "pipeline must place Fail-Safe before Human Trust",
);
assert(
  FAIL_SAFE_MODE_FORBIDDEN.some((f) => f.toLowerCase().includes("guess")),
  "must forbid guessing missing facts",
);
assert(
  FAIL_SAFE_MODE_FORBIDDEN.some((f) => f.includes("HIGH")),
  "must forbid HIGH confidence while engaged",
);
console.log("✓ contract constants + pipeline position");

assert(
  LAYER_ARCHITECTURE_MAP.DERIVED.owns.some((o) => o.includes("Fail-Safe")),
  "DERIVED layer must own Fail-Safe Mode",
);
assert(
  LAYER_ARCHITECTURE_MAP.DERIVED.facadeModules.includes("fail-safe-mode"),
  "architecture map must list fail-safe-mode facade",
);
console.log("✓ layered architecture ownership");

const clearInput: FailSafeModeInput = {
  chosenActionId: "demand-med-check",
  chosenActionLabel: "Confirm evening medication",
  rejectedAlternatives: [{ id: "demand-grocery", label: "Grocery run" }],
  highMissingInfoBlocked: false,
  openConflictCount: 0,
  criticalDecisionRestricted: false,
  systemHealthBand: "Strong",
};

const clear = processFailSafeMode(clearInput, { escalateMissingInfo: false });
assert(!clear.engaged, "clear path must not engage fail-safe");
assert(clear.posture === "allow", "clear posture allow");
assert(clear.effectiveActionId === "demand-med-check", "clear keeps chosen action");
assert(clear.guarantee.ok, `clear guarantee: ${clear.guarantee.violations.join("; ")}`);
console.log("✓ normal path allows recommendation");

const highMissingInput: FailSafeModeInput = {
  ...clearInput,
  highMissingInfoBlocked: true,
  highPriorityMissingInfoCount: 2,
  missingInfoQuestions: ["Was the evening dose taken?"],
  outputRiskLevel: "high",
  careContextUrgency: "HIGH",
  confidenceCap: 0.55,
};

const blocked = processFailSafeMode(highMissingInput, { escalateMissingInfo: false });
assert(blocked.engaged, "HIGH missing info must engage fail-safe");
assert(blocked.effectiveActionId === FAIL_SAFE_CLARIFY_ACTION_ID, "must force clarify action");
assert(blocked.decisionConfidence.level !== "HIGH", "confidence must not be HIGH when engaged");
assert(blocked.clarification?.suppressedRecommendation === true, "must suppress recommendation");
assert(
  blocked.clarification!.mustClarifyBeforeAction.length > 0,
  "must list must-clarify items",
);
assert(blocked.guarantee.ok, `blocked guarantee: ${blocked.guarantee.violations.join("; ")}`);
console.log("✓ HIGH uncertainty triggers clarification mode");

const conflictInput: FailSafeModeInput = {
  ...clearInput,
  openConflictCount: 1,
  reEvaluationRequired: true,
  criticalDecisionRestricted: true,
  conflictClarificationQuestion: "Did memory or today's note change the dose schedule?",
  outputRiskLevel: "critical",
  priorityOverrideApplied: true,
  confidenceCap: 0.55,
  conflictConfidencePenalty: 0.25,
};

const conflict = processFailSafeMode(conflictInput, { escalateMissingInfo: false });
assert(conflict.engaged, "unresolved conflict must engage fail-safe");
assert(
  conflict.triggers.some((t) => t.kind === "UNRESOLVED_CONFLICT"),
  "must record UNRESOLVED_CONFLICT trigger",
);
assert(conflict.decisionConfidence.level === "LOW", "critical conflict → LOW confidence");
console.log("✓ unresolved conflict triggers fail-safe");

const ownerInput: FailSafeModeInput = {
  ...clearInput,
  responsibilityEscalate: true,
  criticalUnassignedCount: 1,
  unassignedCount: 2,
  responsibilityHealthState: "critical",
};

const owner = processFailSafeMode(ownerInput, { escalateMissingInfo: false });
assert(owner.engaged, "critical unassigned owner must engage fail-safe");
assert(
  owner.clarification!.missing.some((q) =>
    q.toLowerCase().includes("responsible"),
  ),
  "must escalate ownership clarification",
);
console.log("✓ responsibility graph gaps trigger fail-safe");

const triggers = evaluateFailSafeTriggers({
  ...clearInput,
  highMissingInfoBlocked: true,
});
assert(triggers.length > 0, "evaluateFailSafeTriggers must be deterministic");
const triggersAgain = evaluateFailSafeTriggers({
  ...clearInput,
  highMissingInfoBlocked: true,
});
assert(
  JSON.stringify(triggersAgain) === JSON.stringify(triggers),
  "trigger evaluation must be stable",
);
console.log("✓ deterministic trigger evaluation (no LLM)");

const confidenceHigh = buildDecisionConfidence({
  engaged: false,
  triggers: [],
  input: { ...clearInput, systemHealthBand: "Strong" },
});
assert(confidenceHigh.level === "HIGH", "healthy clear path may be HIGH");

const confidenceEngaged = buildDecisionConfidence({
  engaged: true,
  triggers: [{ kind: "HIGH_UNCERTAINTY", reason: "missing data" }],
  input: highMissingInput,
});
assert(confidenceEngaged.level !== "HIGH", "engaged confidence never HIGH");
console.log("✓ DecisionConfidence shape + HIGH cap when engaged");

const payload = toFailSafeModeLayerPayload(blocked);
assert(payload.engaged === blocked.engaged, "payload mirrors result");
assert(payload.guaranteeOk === true, "payload guaranteeOk");
console.log("✓ layer payload");

const rewritten = applyFailSafeClarificationToResponse(VERIFY_VALID_SOLENOS, blocked);
assert(
  rewritten.what_matters_now.toLowerCase().includes("clarify"),
  "response rewrite must shift to clarification posture",
);
assert(
  !rewritten.what_matters_now.includes("demand-med-check"),
  "must not surface premature next-best-action id in what_matters_now",
);
console.log("✓ suppresses premature recommendation in SolenOS output");

const badGuarantee = runFailSafeGuarantee({
  engaged: true,
  triggers: [{ kind: "HIGH_UNCERTAINTY", reason: "x" }],
  decisionConfidence: { level: "HIGH", reason: "bad" },
  clarification: null,
  effectiveActionId: "demand-med-check",
});
assert(!badGuarantee.ok, "guarantee must reject HIGH confidence when engaged");
console.log("✓ guarantee invariants");

const pipelineSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);
const decisionIdx = pipelineSource.indexOf("Decision Engine assembly");
const failSafeIdx = pipelineSource.indexOf("processFailSafeMode(");
const humanTrustIdx = pipelineSource.indexOf("processHumanTrustLayer(");
const safetyIdx = pipelineSource.indexOf("enforceSafetyConstraints(");
const trustDisclaimerIdx = pipelineSource.indexOf("const trustLayer = assembleTrustLayer(");

assert(decisionIdx > 0, "analyze pipeline must assemble decision");
assert(failSafeIdx > 0, "analyze pipeline must call processFailSafeMode");
assert(
  decisionIdx < failSafeIdx &&
    failSafeIdx < humanTrustIdx &&
    humanTrustIdx < safetyIdx &&
    safetyIdx < trustDisclaimerIdx,
  "order must be Decision → Fail-Safe → Human Trust → Safety → trust/disclaimer",
);
assert(pipelineSource.includes("fail_safe_mode_layer"), "pipeline must expose fail_safe_mode_layer");
console.log("✓ analyze pipeline wiring order");

const derivedPath = path.join(
  process.cwd(),
  "src/lib/solenos-layers/derived/fail-safe.ts",
);
assert(fs.existsSync(derivedPath), "derived fail-safe companion must exist");
console.log("✓ derived companion module");

console.log("\n✓ FAIL-SAFE MODE enforced");
