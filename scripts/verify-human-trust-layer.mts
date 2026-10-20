/**
 * verify-human-trust-layer.mts
 * HUMAN TRUST LAYER — understand / challenge / undo; EXPLANATION only.
 */

import fs from "node:fs";
import path from "node:path";
import {
  HUMAN_TRUST_LAYER_FORBIDDEN,
  HUMAN_TRUST_LAYER_IDENTITY,
  HUMAN_TRUST_LAYER_ONE_LINE_TRUTH,
  HUMAN_TRUST_LAYER_PIPELINE_POSITION,
  HUMAN_TRUST_OPTIMIZE_FOR,
  buildHumanTrustLayer,
  buildRecommendationExplanation,
  challengeModeCompare,
  fingerprintDecisionContext,
  processHumanTrustLayer,
  runHumanTrustGuarantee,
  toHumanTrustLayerPayload,
  type DecisionExplanationContext,
} from "../src/lib/human-trust-layer";
import { LAYER_ARCHITECTURE_MAP } from "../src/lib/solenos-layers";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS HUMAN TRUST LAYER ===\n");

assert(
  HUMAN_TRUST_LAYER_IDENTITY.includes("understandable") ||
    HUMAN_TRUST_LAYER_IDENTITY.includes("reversible"),
  "identity must declare understand/challenge/undo posture",
);
assert(
  HUMAN_TRUST_LAYER_ONE_LINE_TRUTH.includes("never invents") ||
    HUMAN_TRUST_LAYER_ONE_LINE_TRUTH.includes("decision graph"),
  "one-line truth must forbid hallucinated reasoning",
);
assert(
  HUMAN_TRUST_LAYER_PIPELINE_POSITION.includes("before Safety") ||
    HUMAN_TRUST_LAYER_PIPELINE_POSITION.includes("before Safety Enforcement"),
  "pipeline must place Human Trust before Safety",
);
assert(
  HUMAN_TRUST_LAYER_PIPELINE_POSITION.includes("after Decision"),
  "pipeline must place Human Trust after Decision Engine",
);
assert(
  HUMAN_TRUST_LAYER_FORBIDDEN.some((f) => f.includes("STATE") || f.includes("BELIEF")),
  "must forbid STATE/BELIEF influence",
);
assert(
  HUMAN_TRUST_LAYER_FORBIDDEN.some((f) => f.toLowerCase().includes("llm")),
  "must forbid free LLM hallucination",
);
assert(
  HUMAN_TRUST_OPTIMIZE_FOR[0].includes("comprehension"),
  "optimize comprehension first",
);
console.log("✓ contract constants + pipeline position");

assert(
  LAYER_ARCHITECTURE_MAP.EXPLANATION.owns.some((o) =>
    o.includes("Human Trust"),
  ),
  "EXPLANATION layer must own Human Trust",
);
assert(
  LAYER_ARCHITECTURE_MAP.EXPLANATION.facadeModules.includes("human-trust-layer"),
  "architecture map must list human-trust-layer facade",
);
console.log("✓ layered architecture ownership");

const baseContext: DecisionExplanationContext = {
  chosenActionId: "demand-med-check",
  chosenActionLabel: "Confirm evening medication was taken",
  rejectedAlternatives: [
    { id: "demand-grocery", label: "Schedule grocery run" },
    { id: "demand-call-sibling", label: "Call sibling about weekend coverage" },
  ],
  priorityExplanationLines: [
    "SAFETY_OVERRIDE=CRITICAL×NOW; score=0.91; risk=CRITICAL×1.00",
  ],
  priorityOverrideApplied: true,
  topSituationId: "sit-med",
  demandRanking: [
    {
      id: "demand-med-check",
      title: "Confirm evening medication was taken",
      pressureScore: 88,
    },
    { id: "demand-grocery", title: "Schedule grocery run", pressureScore: 22 },
  ],
  conflictClarifications: [],
  caregiverLoadState: "MODERATE",
  emotionalStress: false,
  highMissingInfoBlocked: false,
  outputRiskLevel: "high",
  deferredDemandTitles: ["Update pharmacy auto-refill"],
};

const explanation = buildRecommendationExplanation(baseContext);
assert(explanation.whyThisWasChosen.length > 0, "why required");
assert(explanation.whatWasIgnored.length > 0, "ignored required");
assert(explanation.riskIfIgnored.length > 0, "risk required");
assert(
  !/PriorityContract|SAFETY_OVERRIDE|score=/i.test(explanation.whyThisWasChosen),
  "why must not leak internal jargon",
);
assert(
  explanation.whyThisWasChosen.toLowerCase().includes("critical") ||
    explanation.whyThisWasChosen.toLowerCase().includes("immediate"),
  "override should surface as plain-language urgency",
);
assert(
  explanation.whatWasIgnored.some((i) => i.toLowerCase().includes("grocery")),
  "ignored must include deferred alternative",
);
console.log("✓ deterministic RecommendationExplanation from decision graph");

const again = buildRecommendationExplanation(baseContext);
assert(
  JSON.stringify(again) === JSON.stringify(explanation),
  "same decision graph must yield identical explanation (no LLM drift)",
);
assert(
  fingerprintDecisionContext(baseContext) ===
    fingerprintDecisionContext({ ...baseContext }),
  "fingerprint stability",
);
console.log("✓ multi-user explanation consistency (deterministic)");

const stressed = buildRecommendationExplanation({
  ...baseContext,
  caregiverLoadState: "CRITICAL",
  emotionalStress: true,
});
assert(
  stressed.whyThisWasChosen.split(/\s+/).length <=
    explanation.whyThisWasChosen.split(/\s+/).length + 2,
  "emotional readability should not expand under CRITICAL load",
);
assert(stressed.whatWasIgnored.length <= 2, "CRITICAL load caps ignored list");
console.log("✓ emotional readability simplification under HIGH/CRITICAL");

const layer = processHumanTrustLayer(baseContext);
assert(layer.guarantee.ok, `guarantee failed: ${layer.guarantee.violations.join("; ")}`);
assert(layer.reversibility.canUndo && layer.reversibility.canIgnore, "undo+ignore");
assert(layer.reversibility.canChooseAlternative, "alternatives present");
assert(layer.challengeModeAvailable === true, "challenge mode flag");
const payload = toHumanTrustLayerPayload(layer);
assert(payload.whyThisWasChosen === layer.explanation.whyThisWasChosen, "payload");
assert(payload.guaranteeOk === true, "payload guarantee");
console.log("✓ reversibility metadata + payload");

const bad = runHumanTrustGuarantee({
  whyThisWasChosen: "",
  whatWasIgnored: [],
  riskIfIgnored: "",
});
assert(!bad.ok && bad.violations.length >= 3, "guarantee rejects empty explanation");
console.log("✓ every recommendation must include complete explanation");

const compare = challengeModeCompare(
  { id: "demand-med-check", label: "Confirm evening medication was taken" },
  { id: "demand-grocery", label: "Schedule grocery run" },
  ["Same situation ranking"],
);
assert(compare.question.toLowerCase().includes("why not"), "challenge question");
assert(compare.whyChosenInstead.length > 0, "why chosen instead");
assert(compare.whatAlternativeWouldTrade.length > 0, "tradeoff");
console.log("✓ Challenge Mode MVP compare API");

// Same graph across “users” — identical Human Trust output
const userA = buildHumanTrustLayer(baseContext);
const userB = buildHumanTrustLayer(baseContext);
assert(
  userA.decisionFingerprint === userB.decisionFingerprint,
  "fingerprint must match across callers",
);
assert(
  JSON.stringify(userA.explanation) === JSON.stringify(userB.explanation),
  "multi-user consistency for same decision graph",
);
console.log("✓ multi-user same decision graph → same explanation");

const pipelineSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);
const decisionIdx = pipelineSource.indexOf("Decision Engine assembly");
const failSafeIdx = pipelineSource.indexOf("processFailSafeMode(");
const humanTrustIdx = pipelineSource.indexOf("processHumanTrustLayer(");
const safetyIdx = pipelineSource.indexOf("enforceSafetyConstraints(");
const trustDisclaimerIdx = pipelineSource.indexOf("const trustLayer = assembleTrustLayer(");
assert(humanTrustIdx > 0, "analyze pipeline must call processHumanTrustLayer");
assert(failSafeIdx > 0, "analyze pipeline must call processFailSafeMode");
assert(
  decisionIdx < failSafeIdx &&
    failSafeIdx < humanTrustIdx &&
    humanTrustIdx < safetyIdx,
  "Human Trust must run AFTER Fail-Safe and BEFORE Safety Enforcement",
);
assert(
  safetyIdx < trustDisclaimerIdx,
  "Safety must still run before trust/disclaimer assembly",
);
assert(
  pipelineSource.includes("human_trust_layer"),
  "pipeline must expose human_trust_layer",
);
console.log("✓ analyze pipeline: Decision → Fail-Safe → Human Trust → Safety → trust/disclaimer");

const cardView = fs.readFileSync(
  path.join(process.cwd(), "src/components/ui-runtime/DecisionCardView.tsx"),
  "utf-8",
);
assert(cardView.includes("Why this was chosen"), "DecisionCard must surface Why");
assert(cardView.includes("What was ignored"), "DecisionCard must surface ignored");
assert(cardView.includes("Risk if ignored"), "DecisionCard must surface risk");
assert(cardView.includes("reversibility"), "DecisionCard must surface undo/ignore");
console.log("✓ DecisionCard UI affordances");

const facadeExists = fs.existsSync(
  path.join(process.cwd(), "src/lib/human-trust-layer/index.ts"),
);
assert(facadeExists, "human-trust-layer module must exist");
const explanationReexport = fs.readFileSync(
  path.join(process.cwd(), "src/lib/solenos-layers/explanation/index.ts"),
  "utf-8",
);
assert(
  explanationReexport.includes("buildRecommendationExplanation"),
  "EXPLANATION layer must re-export Human Trust builders",
);
console.log("✓ module placement (facade + EXPLANATION re-export)");

console.log("\n✓ HUMAN TRUST LAYER enforced");
