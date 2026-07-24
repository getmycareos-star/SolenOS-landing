import fs from "node:fs";
import path from "node:path";
import {
  FORBIDDEN_RESOLUTION_TRIGGERS,
  REQUIRED_STATE_FLOW,
  RESOLUTION_ENGINE_LAYER_FORBIDDEN,
  RESOLUTION_ENGINE_LAYER_IDENTITY,
  RESOLUTION_ENGINE_LAYER_ONE_LINE_TRUTH,
  RESOLUTION_EVIDENCE_KINDS,
  SITUATION_LIFECYCLE_STATUSES,
  assertNotForbiddenTrigger,
  archiveSituation,
  buildArchiveEligibility,
  canTransition,
  countByStatus,
  createEmptyTrackedSituation,
  createNewSituationFromSupersede,
  evaluateResolutionSignals,
  filterSituationsForPriority,
  filterSituationsForRisk,
  formatResolutionEngineObservation,
  getActiveSituations,
  mapLifecycleToUiStatus,
  mapUiStatusToLifecycle,
  processResolutionEngineLayer,
  resetResolutionStoreForTests,
  resolveSituation,
  runResolutionEngineGuarantee,
  toResolutionEngineLayerPayload,
  validateLifecycleTransition,
  validateResolutionEvidence,
  type ResolutionEvidence,
} from "../src/lib/resolution-engine";
import { processPriorityEngineLayer } from "../src/lib/priority-engine";
import { DEFAULT_SOLENOS_SETTINGS } from "../src/lib/settings-governance";
import { createDefaultMemoryInfluenceState } from "../src/lib/memory-influence";
import { DEFAULT_CARE_PROFILE } from "../src/lib/care-profile";
import { computeCareContext } from "../src/lib/care-context/situational";
import { classifyInputSurface, selectBehaviorProfile } from "../src/lib/input-classification";
import { detectUrgencyLevel } from "../src/lib/urgency-detection";
import { processTimeEngineLayer } from "../src/lib/time-engine";

console.log("=== SolenOS Resolution Engine ===\n");

if (!RESOLUTION_ENGINE_LAYER_IDENTITY.includes("no longer operationally active")) {
  throw new Error("resolution engine identity contract drift");
}
if (!RESOLUTION_ENGINE_LAYER_ONE_LINE_TRUTH.includes("outcome has been achieved")) {
  throw new Error("resolution engine one-line truth must forbid time-based completion");
}
if (!RESOLUTION_ENGINE_LAYER_FORBIDDEN.some((r) => r.includes("elapsed time"))) {
  throw new Error("resolution engine must forbid elapsed time auto-resolve");
}
if (!RESOLUTION_ENGINE_LAYER_FORBIDDEN.some((r) => r.includes("inactivity"))) {
  throw new Error("resolution engine must forbid inactivity auto-resolve");
}
if (SITUATION_LIFECYCLE_STATUSES.join(",") !== "ACTIVE,RESOLVED,ARCHIVED") {
  throw new Error("lifecycle statuses drift");
}
if (RESOLUTION_EVIDENCE_KINDS.length !== 5) {
  throw new Error("evidence kinds must match spec");
}
if (FORBIDDEN_RESOLUTION_TRIGGERS.length !== 5) {
  throw new Error("forbidden triggers must match spec");
}
if (REQUIRED_STATE_FLOW !== "ACTIVE → RESOLVED → ARCHIVED") {
  throw new Error("required state flow drift");
}
console.log("✓ contract constants");

// Lifecycle transitions
if (!canTransition("ACTIVE", "RESOLVED")) throw new Error("ACTIVE→RESOLVED must be allowed");
if (!canTransition("RESOLVED", "ARCHIVED")) throw new Error("RESOLVED→ARCHIVED must be allowed");
if (canTransition("RESOLVED", "ACTIVE")) throw new Error("RESOLVED→ACTIVE must be forbidden");
if (canTransition("ARCHIVED", "ACTIVE")) throw new Error("ARCHIVED→ACTIVE must be forbidden");
if (canTransition("ACTIVE", "ARCHIVED")) throw new Error("ACTIVE→ARCHIVED must be forbidden");

const revive = validateLifecycleTransition("ARCHIVED", "ACTIVE");
if (revive.ok) throw new Error("ARCHIVED resurrection must fail");
const reverse = validateLifecycleTransition("RESOLVED", "ACTIVE");
if (reverse.ok) throw new Error("RESOLVED→ACTIVE reverse must fail");
console.log("✓ lifecycle state machine (one-way ACTIVE→RESOLVED→ARCHIVED)");

// Evidence validation
const goodEvidence: ResolutionEvidence = {
  kind: "USER_CONFIRMATION",
  detail: "User confirmed issue handled",
  source: "user_input",
  recordedAt: new Date().toISOString(),
};
if (!validateResolutionEvidence(goodEvidence).ok) {
  throw new Error("valid evidence must pass");
}
const idleEvidence = {
  kind: "ELAPSED_TIME" as ResolutionEvidence["kind"],
  detail: "30 days passed",
  source: "system_event" as const,
  recordedAt: new Date().toISOString(),
};
if (validateResolutionEvidence(idleEvidence).ok) {
  throw new Error("forbidden trigger must not validate as evidence");
}
const forbiddenCheck = assertNotForbiddenTrigger("inactivity");
if (forbiddenCheck.ok) throw new Error("inactivity trigger must be rejected");
console.log("✓ evidence validators forbid time/inactivity triggers");

resetResolutionStoreForTests();

const sessionId = "00000000-0000-4000-8000-000000000001";
const active = createEmptyTrackedSituation({
  id: "00000000-0000-4000-8000-000000000010",
  title: "Medication pickup",
  careSessionId: sessionId,
  timelineEntryIds: ["tl-1"],
  memoryNodeIds: ["mem-1"],
  documentIds: ["doc-1"],
});

const resolved = resolveSituation(active, {
  kind: "COMPLETION_EVENT",
  detail: "Medication picked up at pharmacy",
  source: "user_input",
  recordedAt: new Date().toISOString(),
});
if (!resolved.ok || resolved.situation.status !== "RESOLVED") {
  throw new Error("resolveSituation must transition ACTIVE→RESOLVED");
}
if (
  resolved.situation.timelineEntryIds.length !== 1 ||
  resolved.situation.memoryNodeIds.length !== 1 ||
  resolved.situation.documentIds.length !== 1
) {
  throw new Error("resolve must preserve timeline/memory/document refs");
}
console.log("✓ resolveSituation preserves refs (no deletion)");

const supersede = createNewSituationFromSupersede({
  prior: createEmptyTrackedSituation({
    id: "00000000-0000-4000-8000-000000000011",
    title: "Old discharge workflow",
    careSessionId: sessionId,
  }),
  newTitle: "New discharge plan",
  detail: "New discharge paperwork replaces previous workflow",
});
if (!supersede.ok || supersede.resolved.status !== "RESOLVED" || supersede.created.status !== "ACTIVE") {
  throw new Error("supersede must resolve prior and create new ACTIVE");
}
if (supersede.created.supersedesId !== supersede.resolved.id) {
  throw new Error("supersede link must be recorded");
}
console.log("✓ createNewSituationFromSupersede (no resurrection)");

const archiveChecks = buildArchiveEligibility(
  resolved.situation,
  [resolved.situation],
  0,
  Date.now(),
);
const archived = archiveSituation(resolved.situation, {
  ...archiveChecks,
  retentionSatisfied: true,
  noActiveReferences: true,
  noUnresolvedDependencies: true,
});
if (!archived.ok || archived.situation.status !== "ARCHIVED") {
  throw new Error("archiveSituation must transition RESOLVED→ARCHIVED when eligible");
}
console.log("✓ archiveSituation eligibility checks");

// Signal detection — valid vs forbidden
const confirmSignals = evaluateResolutionSignals({
  input: "Yes, the issue is handled — medication was picked up.",
});
if (!confirmSignals.proposedEvidence || confirmSignals.proposedEvidence.kind !== "USER_CONFIRMATION") {
  throw new Error("must detect user confirmation evidence");
}

const idleSignals = evaluateResolutionSignals({
  input: "Auto-close after enough time has passed due to inactivity",
  attemptedTrigger: "INACTIVITY",
});
if (idleSignals.proposedEvidence) {
  throw new Error("idle/time language must not propose resolution evidence");
}
if (!idleSignals.rejectedForbiddenTriggers.includes("INACTIVITY")) {
  throw new Error("must reject INACTIVITY trigger");
}
console.log("✓ evaluateResolutionSignals — evidence without idle auto-resolve");

// Process layer + guarantee
const layer = processResolutionEngineLayer({
  input: "Insurance appeal was approved for mom's coverage.",
  careSessionId: sessionId,
  applyDetectedEvidence: true,
});
if (layer.active.length > 0) {
  throw new Error("approval resolution should leave no ACTIVE when only one situation");
}
if (layer.resolved.length === 0) {
  throw new Error("approval evidence should resolve situation");
}
const guarantee = runResolutionEngineGuarantee({ situations: layer.situations });
if (!guarantee.ok) {
  throw new Error(`guarantee failed: ${guarantee.violations.join("; ")}`);
}
const payload = toResolutionEngineLayerPayload(layer);
if (payload.activeCount !== layer.active.length) {
  throw new Error("payload activeCount drift");
}
if (!formatResolutionEngineObservation(layer).includes("RESOLUTION_ENGINE")) {
  throw new Error("observation tag missing");
}
console.log("✓ processResolutionEngineLayer + guarantee + payload");

// Priority / risk filtering — ONLY ACTIVE
const catalog = [
  createEmptyTrackedSituation({ title: "A", careSessionId: sessionId }),
  { ...resolved.situation, status: "RESOLVED" as const },
  { ...archived.situation, status: "ARCHIVED" as const },
];
const forPriority = filterSituationsForPriority(catalog);
const forRisk = filterSituationsForRisk(catalog);
if (forPriority.length !== 1 || forRisk.length !== 1) {
  throw new Error("priority/risk filters must include ONLY ACTIVE");
}
const counts = countByStatus(catalog);
if (counts.active !== 1 || counts.resolved !== 1 || counts.archived !== 1) {
  throw new Error("countByStatus drift");
}
console.log("✓ getActiveSituations / priority+risk filters");

// Priority engine integration — empty when no ACTIVE
const careCtx = computeCareContext({
  input: "Need medication within 1 hour urgently",
  inputMode: "crisis_urgent",
  urgencyDetection: detectUrgencyLevel("Need medication within 1 hour urgently", "crisis_urgent"),
});
const timeLayer = processTimeEngineLayer({
  input: "Need medication within 1 hour urgently",
  governanceSettings: DEFAULT_SOLENOS_SETTINGS,
  careProfile: DEFAULT_CARE_PROFILE,
  careContext: careCtx.context,
  memoryState: createDefaultMemoryInfluenceState("00000000-0000-4000-8000-000000000099"),
  urgencyDetection: detectUrgencyLevel("Need medication within 1 hour urgently", "crisis_urgent"),
});
const onlyResolved = processPriorityEngineLayer({
  timeEngine: timeLayer,
  careProfile: DEFAULT_CARE_PROFILE,
  careContext: careCtx.context,
  trackedSituations: catalog.filter((s) => s.status !== "ACTIVE"),
});
if (onlyResolved.vectors.length !== 0 || onlyResolved.rankedForActionGenerator.length !== 0) {
  throw new Error("priority engine must skip ranking when no ACTIVE situations");
}
const withActive = processPriorityEngineLayer({
  timeEngine: timeLayer,
  careProfile: DEFAULT_CARE_PROFILE,
  careContext: careCtx.context,
  trackedSituations: [createEmptyTrackedSituation({ title: "Active only", careSessionId: sessionId })],
});
if (withActive.vectors.length === 0) {
  throw new Error("priority engine must rank when ACTIVE situations exist");
}
console.log("✓ priority engine wired to ACTIVE-only filter");

// UI bridge
if (mapUiStatusToLifecycle("blocked") !== "ACTIVE") {
  throw new Error("blocked must map to ACTIVE lifecycle");
}
if (mapUiStatusToLifecycle("resolved") !== "RESOLVED") {
  throw new Error("resolved must map to RESOLVED lifecycle");
}
if (mapLifecycleToUiStatus("ARCHIVED") !== "resolved") {
  throw new Error("ARCHIVED maps to UI resolved for queue exclusion");
}
console.log("✓ UI status bridge");

// Analyze pipeline wiring
const pipelineSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);
const resolutionIdx = pipelineSource.indexOf("processResolutionEngineLayer(");
const priorityIdx = pipelineSource.indexOf("processPriorityEngineLayer({", resolutionIdx);
const geminiIdx = pipelineSource.indexOf("invokeGeminiExecution({");
if (!(resolutionIdx > 0 && priorityIdx > resolutionIdx && priorityIdx < geminiIdx)) {
  throw new Error("resolution engine must run before priority engine and before generation");
}
if (!pipelineSource.includes("trackedSituations: resolutionEngineLayer.situations")) {
  throw new Error("priority engine must receive resolution trackedSituations");
}
if (!pipelineSource.includes("resolution_engine_layer")) {
  throw new Error("pipeline must expose resolution_engine_layer payload");
}
console.log("✓ analyze pipeline wiring");

const routeSource = fs.readFileSync(
  path.join(process.cwd(), "src/app/api/analyze/route.ts"),
  "utf-8",
);
if (!routeSource.includes("resolution_engine_layer")) {
  throw new Error("analyze API must expose resolution_engine_layer");
}
console.log("✓ analyze API payload");

console.log("\n✓ Resolution Engine verified");
