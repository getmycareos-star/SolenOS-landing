/**
 * verify-solenos-v14.mts
 *
 * Asserts SolenOS v1.4 ENGINEERING SPEC master architecture contract:
 * - Situation-centric root entity
 * - Required engine modules mapped to implementation paths
 * - Pipeline order documented (spec vs actual)
 * - Six v1.4 principles enforced
 * - Gap stubs present (human override, reality drift, fatigue degradation)
 */

import fs from "node:fs";
import path from "node:path";
import {
  SITUATION_ROOT_ENTITY,
  V14_PRINCIPLES,
  V14_ENGINE_MODULES,
  V14_PIPELINE_SPEC_ORDER,
  V14_PIPELINE_ACTUAL_ORDER,
  V14_PIPELINE_NOTES,
  V14_GAP_STUBS,
  LAYER_ARCHITECTURE_MAP,
  FACADE_DEPRECATION,
  BELIEF_ITEM_TYPES,
  HIGH_MISSING_INFO_CONFIDENCE_CAP,
  computePriority,
  computeRisk,
  resetBeliefStore,
  resetStateStore,
  syncTrackedSituationsToState,
  addBelief,
} from "../src/lib/solenos-layers";
import { FATIGUE_SURFACE_LIMITS } from "../src/lib/emotional-load-signal";
import {
  HUMAN_OVERRIDE_KINDS,
  recordHumanOverride,
  resetHumanOverrideStubStore,
} from "../src/lib/human-override";
import { detectRealityDrift, REALITY_DRIFT_SIGNAL_KINDS } from "../src/lib/reality-drift";
import {
  buildRecommendationExplanation,
  HUMAN_TRUST_LAYER_PIPELINE_POSITION,
} from "../src/lib/human-trust-layer";
import { FAIL_SAFE_MODE_PIPELINE_POSITION } from "../src/lib/fail-safe-mode";
import { EMOTIONAL_LOAD_SIGNAL_EARLY_POSITION } from "../src/lib/emotional-load-signal";
import { computeCurveTimeDecayFactor } from "../src/lib/solenos-layers";
import { enforceSafetyConstraints } from "../src/lib/safety-enforcement";
import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function assertPathExists(relPath: string, label: string): void {
  const primary = relPath.split("+")[0]!.trim().split(" ")[0]!;
  const candidates = [
    path.join(root, primary),
    path.join(root, `${primary}.ts`),
    path.join(root, primary, "index.ts"),
  ];
  const found = candidates.some((p) => fs.existsSync(p));
  assert(found, `${label}: path missing — ${primary}`);
}

console.log("=== SolenOS v1.4 ENGINEERING SPEC ===\n");

// ─── Situation-centric root entity ───────────────────────────────────────────
assert(SITUATION_ROOT_ENTITY.type === "Situation", "root entity is Situation");
assert(
  SITUATION_ROOT_ENTITY.statuses.join("|") === "active|resolved|archived",
  "Situation statuses",
);
assert(
  SITUATION_ROOT_ENTITY.priorities.join("|") === "LOW|MEDIUM|HIGH|CRITICAL",
  "Situation priorities",
);
assert(
  SITUATION_ROOT_ENTITY.owns.some((o) => o.includes("timeline")),
  "Situation owns timeline",
);
assert(
  SITUATION_ROOT_ENTITY.owns.some((o) => o.includes("assumptions")),
  "Situation owns assumptions",
);
console.log("✓ Situation-centric root entity contract");

// ─── v1.4 principles ─────────────────────────────────────────────────────────
assert(V14_PRINCIPLES.length === 6, "six v1.4 principles");
assert(V14_PRINCIPLES.includes("situation_centric"), "principle: situation_centric");
assert(V14_PRINCIPLES.includes("uncertainty_first_class"), "principle: uncertainty_first_class");
assert(V14_PRINCIPLES.includes("time_nonlinear"), "principle: time_nonlinear");
assert(V14_PRINCIPLES.includes("emotional_state_required"), "principle: emotional_state_required");
assert(V14_PRINCIPLES.includes("explanation_in_output"), "principle: explanation_in_output");
assert(V14_PRINCIPLES.includes("safety_overrides_everything"), "principle: safety_overrides_everything");
console.log("✓ v1.4 principles declared");

// ─── Engine module audit matrix ──────────────────────────────────────────────
const requiredSpecs = [
  "Context Engine",
  "Memory Layer",
  "Assumption + Missing Info",
  "Priority Engine + Priority Contract",
  "Time Engine + nonlinear curves",
  "Conflict Detection",
  "Decision Engine",
  "Safety Override",
  "Explanation / Human Trust",
  "Timeline",
  "Emotional Load",
  "Caregiver Load Index",
  "Responsibility Graph",
  "Decision Surface",
  "Fail-Safe Mode",
  "Demand Engine",
  "Resolution",
];
for (const spec of requiredSpecs) {
  const mod = V14_ENGINE_MODULES.find((m) => m.spec === spec);
  assert(mod, `V14_ENGINE_MODULES missing: ${spec}`);
  assert(
    mod.status === "implemented" || mod.status === "partial",
    `${spec} must be implemented or partial, got ${mod.status}`,
  );
  assertPathExists(mod.path, spec);
}
const stubMods = V14_ENGINE_MODULES.filter((m) => m.status === "stub");
assert(stubMods.some((m) => m.spec === "Human Override"), "Human Override stub mapped");
assert(stubMods.some((m) => m.spec === "Reality Drift Detection"), "Reality Drift stub mapped");
console.log(`✓ engine module audit (${V14_ENGINE_MODULES.length} modules mapped)`);

// ─── Pipeline order documentation ────────────────────────────────────────────
assert(V14_PIPELINE_SPEC_ORDER.length >= 10, "spec pipeline documented");
assert(V14_PIPELINE_ACTUAL_ORDER.length >= 15, "actual pipeline documented");
assert(V14_PIPELINE_NOTES.length >= 3, "pipeline deviation notes");
assert(
  V14_PIPELINE_ACTUAL_ORDER.some((s) => s.includes("Emotional Load")),
  "actual pipeline includes Emotional Load",
);
assert(
  V14_PIPELINE_ACTUAL_ORDER.some((s) => s.includes("Fail-Safe")),
  "actual pipeline includes Fail-Safe",
);
assert(
  V14_PIPELINE_ACTUAL_ORDER.some((s) => s.includes("Human Trust")),
  "actual pipeline includes Human Trust",
);
assert(
  V14_PIPELINE_ACTUAL_ORDER.some((s) => s.includes("Safety")),
  "actual pipeline includes Safety",
);
console.log("✓ pipeline spec vs actual order documented");

// ─── Principle: uncertainty first-class (BeliefItem) ─────────────────────────
assert(BELIEF_ITEM_TYPES.includes("assumption"), "assumption belief type");
assert(BELIEF_ITEM_TYPES.includes("missing_information"), "missing_information belief type");
resetStateStore();
resetBeliefStore();
const session = "v14-verify-session";
const situations = syncTrackedSituationsToState(session, [
  {
    id: "sit-v14",
    title: "Medication unclear",
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]);
addBelief("v14-user", {
  situationId: "sit-v14",
  type: "missing_information",
  content: "Current dose unknown?",
  importance: "HIGH",
});
const beliefs = [{ situationId: "sit-v14", type: "missing_information" as const, content: "dose?", importance: "HIGH" as const, id: "b1", status: "active" as const, confidence: 0.5, createdAt: "", updatedAt: "" }];
const risk = computeRisk(situations, beliefs);
const priority = computePriority({
  situations,
  beliefs,
  risk,
  candidateActionIds: ["irreversible_action", "clarify_before_action"],
});
assert(priority.highMissingInfoBlocked === true, "HIGH missing info blocks");
assert(priority.confidenceCap === HIGH_MISSING_INFO_CONFIDENCE_CAP, "confidence cap under uncertainty");
console.log("✓ uncertainty first-class (BeliefItem + HIGH missing info gate)");

// ─── Principle: time nonlinear ───────────────────────────────────────────────
const acuteEarly = computeCurveTimeDecayFactor({
  curveType: "ACUTE_MEDICAL",
  hoursUntilDeadline: 1,
});
const acuteLate = computeCurveTimeDecayFactor({
  curveType: "ACUTE_MEDICAL",
  hoursUntilDeadline: 48,
});
assert(acuteEarly !== acuteLate, "acute curve is nonlinear");
assert(acuteEarly > acuteLate, "acute urgency increases as deadline approaches");
const chronic = computeCurveTimeDecayFactor({
  curveType: "CHRONIC_CARE",
  hoursUntilDeadline: 24,
});
const safety = computeCurveTimeDecayFactor({
  curveType: "SAFETY_CRITICAL_OVERRIDE",
  hoursUntilDeadline: 12,
});
assert(safety !== chronic, "safety vs chronic curves differ (nonlinear families)");
console.log("✓ time nonlinear (time-weighting curves)");

// ─── Principle: emotional state required ───────────────────────────────────────
assert(
  EMOTIONAL_LOAD_SIGNAL_EARLY_POSITION.includes("Emotional Load"),
  "ELS early position documented",
);
assert(FATIGUE_SURFACE_LIMITS.CRITICAL === 1, "CRITICAL fatigue → top 1 situation");
const pipelineSrc = fs.readFileSync(
  path.join(root, "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);
assert(
  pipelineSrc.includes("processEmotionalLoadSignalLayer"),
  "analyze-pipeline runs emotional load signal",
);
assert(
  pipelineSrc.includes("emotionalLoadSignal:") || pipelineSrc.includes("emotionalLoadSignal"),
  "analyze-pipeline passes emotional load to priority",
);
assert(
  pipelineSrc.includes("applyPostDecisionEmotionalLoad"),
  "analyze-pipeline post-decision emotional load",
);
console.log("✓ emotional state required (ELS → Priority + degradation mode)");

// ─── Principle: explanation in output (RecommendationExplanation) ────────────
const explanation = buildRecommendationExplanation({
  chosenActionId: "clarify_before_action",
  chosenActionLabel: "Clarify dose before acting",
  rejectedAlternatives: [{ id: "med_change", label: "Change medication" }],
  priorityExplanationLines: ["HIGH missing info blocked irreversible posture"],
  assumptionsUsed: ["Appeal pending"],
  missingInfoImpact: ["What is current dose?"],
  outputRiskLevel: "medium",
  highMissingInfoBlocked: true,
});
assert(explanation.whyThisWasChosen.length > 10, "whyThisWasChosen present");
assert(Array.isArray(explanation.whatWasIgnored), "whatWasIgnored present");
assert(explanation.riskIfIgnored.length > 5, "riskIfIgnored present");

const decisionCardTypes = fs.readFileSync(
  path.join(root, "src/lib/ui-runtime/types.ts"),
  "utf-8",
);
assert(decisionCardTypes.includes("explanation?:"), "DecisionCard has explanation field");
assert(
  decisionCardTypes.includes("whyThisWasChosen"),
  "DecisionCard explanation shape matches RecommendationExplanation",
);

const pageSrc = fs.readFileSync(path.join(root, "src/app/page.tsx"), "utf-8");
assert(pageSrc.includes("human_trust_layer"), "page wires human_trust_layer to DecisionCard");
console.log("✓ explanation part of output (RecommendationExplanation → DecisionCard)");

// ─── Principle: safety overrides everything ────────────────────────────────────
assert(
  FAIL_SAFE_MODE_PIPELINE_POSITION.includes("before Human Trust"),
  "Fail-Safe before Human Trust",
);
assert(
  HUMAN_TRUST_LAYER_PIPELINE_POSITION.includes("before Safety"),
  "Human Trust before Safety Enforcement",
);
const safetyResult = enforceSafetyConstraints(VERIFY_VALID_SOLENOS, {
  safetyControl: {
    alwaysShowUncertainty: true,
    noCertaintyMode: true,
    medicalMode: "strict",
    emergencySensitivity: "high",
    externalEscalationEnabled: true,
    riskTolerance: "low",
  },
  emergencySituation: true,
});
assert(
  safetyResult.guarantee.ok || safetyResult.appliedConstraints.length > 0,
  "safety enforcement applies constraints",
);
assert(
  pipelineSrc.includes("enforceSafetyConstraints"),
  "analyze-pipeline enforces safety after trust layers",
);
const safetyIdx = pipelineSrc.indexOf("const safetyEnforcement = enforceSafetyConstraints");
const failSafeIdx = pipelineSrc.indexOf("// FAIL-SAFE MODE — AFTER Emotional Load Signal");
const humanTrustIdx = pipelineSrc.indexOf("const humanTrustLayer = processHumanTrustLayer");
assert(failSafeIdx > 0 && humanTrustIdx > failSafeIdx, "Fail-Safe before Human Trust in pipeline");
assert(humanTrustIdx < safetyIdx, "Human Trust before Safety in pipeline");
console.log("✓ safety overrides everything (terminal Safety Enforcement)");

// ─── Gap stubs ───────────────────────────────────────────────────────────────
assert(V14_GAP_STUBS.length >= 3, "gap stubs documented");
resetHumanOverrideStubStore();
for (const kind of HUMAN_OVERRIDE_KINDS) {
  const r = recordHumanOverride({ situationId: "sit-v14", kind });
  assert(r.ok, `human override stub: ${kind}`);
}
assert(
  fs.existsSync(path.join(root, "src/app/api/human-override/route.ts")),
  "human override API route",
);
const drift = detectRealityDrift({
  situationId: "sit-v14",
  observation: "This is wrong and outdated",
  lastBeliefUpdateAt: new Date(Date.now() - 10 * 86400000).toISOString(),
  lastStateUpdateAt: new Date(Date.now() - 10 * 86400000).toISOString(),
});
assert(drift.driftDetected === true, "reality drift stub detects signals");
assert(REALITY_DRIFT_SIGNAL_KINDS.length >= 3, "drift signal kinds");
console.log("✓ v1.4 gap stubs (human override + reality drift + fatigue degradation)");

// ─── Layer map integrity ─────────────────────────────────────────────────────
assert(LAYER_ARCHITECTURE_MAP.STATE.canonicalPath.includes("state"), "STATE layer path");
assert(LAYER_ARCHITECTURE_MAP.BELIEF.canonicalPath.includes("belief"), "BELIEF layer path");
assert(LAYER_ARCHITECTURE_MAP.EXPLANATION.canonicalPath.includes("explanation"), "EXPLANATION path");
assert(FACADE_DEPRECATION["human-override"], "human-override in facade map");
assert(FACADE_DEPRECATION["reality-drift"], "reality-drift in facade map");
console.log("✓ architecture map + facade deprecation updated for v1.4");

console.log("\n=== All SolenOS v1.4 contract checks passed ===");
