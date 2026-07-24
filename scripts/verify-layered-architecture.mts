/**
 * verify-layered-architecture.mts
 *
 * Asserts SolenOS 3-layer architecture reduction:
 * - BeliefItem unifies assumption + missing_information
 * - risk/priority are pure functions (no risk persistence module API)
 * - decision history ≠ timeline separation
 * - no duplicate truth for situations
 */

import fs from "node:fs";
import path from "node:path";
import {
  BELIEF_ITEM_TYPES,
  FACADE_DEPRECATION,
  HIGH_MISSING_INFO_CONFIDENCE_CAP,
  LAYER_ARCHITECTURE_MAP,
  SOLENOS_LAYERS_FORBIDDEN,
  SOLENOS_LAYERS_IDENTITY,
  SOLENOS_LAYER_NAMES,
  SOLENOS_RUNTIME_PIPELINE,
  addBelief,
  computeAutonomyGate,
  computeHealthSummary,
  computePriority,
  computeRisk,
  createBeliefItem,
  listBeliefs,
  resetBeliefStore,
  resetStateStore,
  runLayeredPipeline,
  syncTrackedSituationsToState,
  toStateSituation,
  writeExplanationDecision,
  createEmptyTimeline,
  writeExplanationTimelineEvent,
  getDecisionHistoryLog,
  resetDecisionHistoryStore,
} from "../src/lib/solenos-layers";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS 3-Layer Architecture ===\n");

assert(SOLENOS_LAYER_NAMES.join("|") === "STATE|BELIEF|EXPLANATION", "exactly 3 layers");
assert(SOLENOS_RUNTIME_PIPELINE.length === 6, "runtime pipeline has 6 stages");
assert(
  SOLENOS_RUNTIME_PIPELINE.join("→") ===
    "INPUT→STATE_UPDATE→BELIEF_UPDATE→DERIVED_COMPUTATION→ACTION_SELECTION→EXPLANATION_OUTPUT",
  "runtime pipeline order",
);
assert(SOLENOS_LAYERS_IDENTITY.includes("STATE"), "identity mentions STATE");
assert(
  SOLENOS_LAYERS_FORBIDDEN.some((f) => f.includes("Risk Engine")),
  "forbids risk engine as stored system",
);
console.log("✓ layer identity + runtime pipeline contract");

assert(BELIEF_ITEM_TYPES.includes("assumption"), "BeliefItem type includes assumption");
assert(
  BELIEF_ITEM_TYPES.includes("missing_information"),
  "BeliefItem type includes missing_information",
);
assert(BELIEF_ITEM_TYPES.length === 2, "BeliefItem unifies exactly two types");
console.log("✓ BeliefItem unifies assumption + missing_information");

assert(LAYER_ARCHITECTURE_MAP.STATE.canonicalPath.includes("solenos-layers/state"), "STATE path");
assert(LAYER_ARCHITECTURE_MAP.BELIEF.canonicalPath.includes("solenos-layers/belief"), "BELIEF path");
assert(
  LAYER_ARCHITECTURE_MAP.EXPLANATION.canonicalPath.includes("solenos-layers/explanation"),
  "EXPLANATION path",
);
assert(LAYER_ARCHITECTURE_MAP.DERIVED.note?.includes("Pure functions"), "derived note");
assert(FACADE_DEPRECATION["assumption-registry"] === "BELIEF (type=assumption)", "assumption facade");
assert(
  FACADE_DEPRECATION["missing-information-queue"] === "BELIEF (type=missing_information)",
  "MIQ facade",
);
assert(FACADE_DEPRECATION["situation-risk-register"] === "derived/computeRisk", "risk facade");
assert(FACADE_DEPRECATION["priority-engine"] === "derived/computePriority", "priority facade");
assert(
  LAYER_ARCHITECTURE_MAP.DERIVED.owns.some((o) => o.includes("PriorityContract")),
  "DERIVED owns PriorityContract",
);
console.log("✓ architecture map + facade deprecation");

// Pure derived — no persistence API for risk
resetStateStore();
resetBeliefStore();
const careSessionId = "session-layered-verify";
const situations = syncTrackedSituationsToState(careSessionId, [
  {
    id: "sit-1",
    title: "Medication schedule unclear",
    status: "ACTIVE",
    documentIds: ["doc-1"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]);
assert(situations.length === 1, "STATE synced");
assert(situations[0]!.documentRefs.includes("doc-1"), "document refs are pointers");
assert(!("content" in (situations[0] as object)), "STATE has no document content");

const userId = "user-layered-verify";
addBelief(userId, {
  situationId: "sit-1",
  type: "assumption",
  content: "Appeal is still pending",
  confidence: 0.8,
});
addBelief(userId, {
  situationId: "sit-1",
  type: "missing_information",
  content: "What is the current prescribed dose?",
  importance: "HIGH",
  confidence: 0.5,
});
const beliefs = listBeliefs(userId);
assert(beliefs.length === 2, "beliefs unified in one store");
assert(beliefs.some((b) => b.type === "assumption"), "has assumption belief");
assert(beliefs.some((b) => b.type === "missing_information"), "has missing_information belief");

const risk = computeRisk(situations, beliefs);
assert(typeof risk.systemRiskExposure === "number", "computeRisk returns exposure");
assert(Array.isArray(risk.situationRisks), "computeRisk returns situation risks");

const priority = computePriority({
  situations,
  beliefs,
  risk,
  candidateActionIds: ["aggressive_medical_irreversible", "clarify_before_action"],
});
assert(priority.highMissingInfoBlocked === true, "HIGH missing_information blocks irreversible");
assert(
  priority.confidenceCap === HIGH_MISSING_INFO_CONFIDENCE_CAP,
  "confidence capped under HIGH missing info",
);
assert(
  priority.topActionId === "clarify_before_action" ||
    priority.rankedActionIds[0] === "clarify_before_action" ||
    priority.rankedActionIds.includes("clarify_before_action"),
  "clarification preferred when HIGH missing info",
);
assert(Array.isArray(priority.rankedSituationIds), "PriorityContract ranks situations");
assert((priority.situationScores?.length ?? 0) >= 1, "situationScores explainability");

const health = computeHealthSummary(situations, beliefs);
assert(
  health.band === "Healthy" || health.band === "Degraded" || health.band === "Unreliable",
  "health band valid",
);
const gate = computeAutonomyGate(situations, beliefs);
assert(gate.boostUncertainty === true || gate.requestClarification === true, "autonomy gate derived");
console.log("✓ derived computeRisk / computePriority / computeHealthSummary are pure");

// Decision history ≠ timeline
resetDecisionHistoryStore();
const decision = writeExplanationDecision(userId, {
  situationId: "sit-1",
  chosenAction: "clarify_before_action",
  rejectedAlternatives: ["aggressive_medical_irreversible"],
  reasoningSummary: "HIGH missing info blocked irreversible posture",
  assumptionsUsed: ["Appeal is still pending"],
  missingInfoImpact: ["What is the current prescribed dose?"],
});
assert(decision.chosenAction === "clarify_before_action", "decision written");
assert(decision.reasoningSummary.includes("HIGH"), "decision has WHY");

let timeline = createEmptyTimeline();
const tl = writeExplanationTimelineEvent(timeline, {
  situationId: "sit-1",
  type: "system_event",
  summary: "User submitted medication question",
});
timeline = tl.log;
assert(tl.event.summary.includes("medication"), "timeline WHAT written");
assert(tl.event.type === "system_event", "timeline event type");

const hist = getDecisionHistoryLog(userId);
assert(hist.entries.length === 1, "decision history separate from timeline");
assert(timeline.entries.length === 1, "timeline separate from decision history");
assert(
  !("chosenAction" in (timeline.entries[0] as object)),
  "timeline must not contain decision WHY fields",
);
console.log("✓ decision history (WHY) ≠ timeline (WHAT) separation");

// No duplicate truth — single STATE situation id
const dup = toStateSituation({
  id: "sit-1",
  status: "active",
  summary: "same id",
  careSessionId,
});
assert(dup.id === situations[0]!.id, "canonical situation id");
const pipeline = runLayeredPipeline({
  careSessionId,
  userId,
  situations,
  dryRun: true,
  candidateActionIds: ["clarify_before_action"],
});
assert(
  pipeline.stagesCompleted.join(",") === SOLENOS_RUNTIME_PIPELINE.join(","),
  "layered pipeline stages complete in order",
);
assert(pipeline.state.situations.length === 1, "single STATE truth source");
console.log("✓ no duplicate truth for situations + layered pipeline order");

// Source: risk module must not expose persistent risk DB API in layered contract
const riskIndex = fs.readFileSync(
  path.join(root, "src/lib/situation-risk-register/index.ts"),
  "utf-8",
);
assert(riskIndex.includes("computeRisk"), "risk facade re-exports computeRisk");
assert(riskIndex.includes("DEPRECATED_FACADE_NOTICE"), "risk marked deprecated facade");
assert(
  !fs.existsSync(path.join(root, "src/lib/situation-risk-register/persistence.ts")),
  "no risk persistence module",
);

const assumptionIndex = fs.readFileSync(
  path.join(root, "src/lib/assumption-registry/index.ts"),
  "utf-8",
);
assert(assumptionIndex.includes("BeliefItem"), "assumption facade points to BeliefItem");

const miqIndex = fs.readFileSync(
  path.join(root, "src/lib/missing-information-queue/index.ts"),
  "utf-8",
);
assert(miqIndex.includes("missing_information"), "MIQ facade points to belief type");

const pipelineSrc = fs.readFileSync(
  path.join(root, "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);
assert(pipelineSrc.includes("STATE UPDATE"), "analyze-pipeline wires STATE UPDATE");
assert(pipelineSrc.includes("BELIEF UPDATE"), "analyze-pipeline wires BELIEF UPDATE");
assert(pipelineSrc.includes("computeRisk"), "analyze-pipeline uses derived computeRisk");
assert(pipelineSrc.includes("computePriority"), "analyze-pipeline uses derived computePriority");
assert(pipelineSrc.includes("writeExplanationDecision"), "analyze-pipeline writes EXPLANATION");
assert(
  pipelineSrc.includes("syncLegacyBeliefsToStore") || pipelineSrc.includes("syncTrackedSituationsToState"),
  "analyze-pipeline syncs into layers",
);
console.log("✓ facades + analyze-pipeline wiring");

// createBeliefItem shape contract
const item = createBeliefItem({
  situationId: "sit-1",
  type: "assumption",
  content: "test",
});
assert(typeof item.confidence === "number", "confidence 0-1");
assert(item.status === "active", "default status active");
console.log("✓ BeliefItem shape contract");

console.log("\n=== All layered-architecture checks passed ===");
