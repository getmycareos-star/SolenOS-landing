import fs from "node:fs";
import path from "node:path";
import {
  ASSUMPTION_REGISTRY_LAYER_FORBIDDEN,
  ASSUMPTION_REGISTRY_LAYER_IDENTITY,
  ASSUMPTION_REGISTRY_LAYER_ONE_LINE_TRUTH,
  ASSUMPTION_REGISTRY_LAYER_PIPELINE_POSITION,
  DEFAULT_ASSUMPTION_EXPIRATION_DAYS,
  DEFAULT_ASSUMPTION_STALE_DAYS,
  ASSUMPTION_INFLUENCE_CAP,
  addAssumption,
  applyAssumptionExpiration,
  computeAssumptionInfluenceEnvelope,
  createAssumption,
  createDefaultAssumptionRegistryState,
  detectAssumptionSignalsFromInput,
  detectContradictoryInvalidations,
  getInfluenceableAssumptions,
  invalidateAssumption,
  processAssumptionRegistryLayer,
  applyAssumptionRegistryBehaviorWeighting,
  resetAssumptionRegistryStore,
  runAssumptionRegistryGuarantee,
  seedAssumptionsFromCareProfile,
  toAssumptionRegistryLayerPayload,
  toAssumptionRegistryView,
  validateAssumption,
} from "../src/lib/assumption-registry";
import { DEFAULT_CARE_PROFILE } from "../src/lib/care-profile";
import { collectAssumptionHealth } from "../src/lib/system-health";
import { selectBehaviorProfile } from "../src/lib/input-classification";

console.log("=== Assumption Registry ===\n");

if (!ASSUMPTION_REGISTRY_LAYER_IDENTITY.includes("temporary beliefs")) {
  throw new Error("assumption registry identity contract drift");
}
if (!ASSUMPTION_REGISTRY_LAYER_ONE_LINE_TRUTH.includes("never facts")) {
  throw new Error("assumption registry must emphasize temporary beliefs not facts");
}
if (!ASSUMPTION_REGISTRY_LAYER_PIPELINE_POSITION.includes("before Priority Engine")) {
  throw new Error("assumption registry must run before Priority Engine");
}
if (!ASSUMPTION_REGISTRY_LAYER_FORBIDDEN.some((r) => r.includes("memory truth"))) {
  throw new Error("must forbid persisting assumptions as memory truth");
}
if (!ASSUMPTION_REGISTRY_LAYER_FORBIDDEN.some((r) => r.includes("Care Profile"))) {
  throw new Error("must forbid merge into Care Profile identity");
}
if (!ASSUMPTION_REGISTRY_LAYER_FORBIDDEN.some((r) => r.includes("sidebar"))) {
  throw new Error("must forbid dedicated sidebar section");
}
console.log("✓ assumption registry contract constants");

if (DEFAULT_ASSUMPTION_EXPIRATION_DAYS !== 90) {
  throw new Error("default expiration must be ~90 days");
}
if (DEFAULT_ASSUMPTION_STALE_DAYS !== 30) {
  throw new Error("default stale threshold must be 30 days");
}
if (ASSUMPTION_INFLUENCE_CAP !== 0.25) {
  throw new Error("influence cap must be 0.25 (soft bias)");
}
console.log("✓ expiration / stale / influence policy defaults");

resetAssumptionRegistryStore();
const userId = "00000000-0000-4000-8000-0000000000aa";

const signals = detectAssumptionSignalsFromInput(
  "The appeal is still pending and medication schedule is unchanged",
);
if (signals.length < 2) {
  throw new Error("must detect appeal + medication schedule assumptions from input");
}
console.log("✓ input assumption signal detection");

let state = createDefaultAssumptionRegistryState(userId);
const appeal = createAssumption({
  statement: "Appeal is still unresolved",
  source: "user_input",
  confidence: 0.8,
  nowMs: Date.now(),
});
state = addAssumption(state, appeal);
if (getInfluenceableAssumptions(state).length !== 1) {
  throw new Error("active assumption must be influenceable");
}

state = validateAssumption(state, appeal.assumptionId);
const validated = state.assumptions.find((a) => a.assumptionId === appeal.assumptionId);
if (validated?.status !== "validated") {
  throw new Error("validate must transition active → validated");
}
if (getInfluenceableAssumptions(state).length !== 1) {
  throw new Error("validated assumption must still be influenceable");
}
console.log("✓ create → active → validated lifecycle");

const invalidated = invalidateAssumption(
  state,
  appeal.assumptionId,
  "appeal approved",
  "document",
);
if (invalidated.state.assumptions.find((a) => a.assumptionId === appeal.assumptionId)?.status !==
  "invalidated") {
  throw new Error("invalidate must set status invalidated");
}
if (getInfluenceableAssumptions(invalidated.state).length !== 0) {
  throw new Error("invalidated must NOT be influenceable");
}
console.log("✓ invalidate removes from influence");

// Expiration: aged past 90 days
let expireState = createDefaultAssumptionRegistryState(userId + "-expire");
const old = createAssumption({
  statement: "Medication schedule is unchanged",
  source: "inference",
  confidence: 0.7,
  nowMs: Date.now() - 91 * 24 * 60 * 60 * 1000,
});
expireState = addAssumption(expireState, {
  ...old,
  lastCheckedAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString(),
});
const expired = applyAssumptionExpiration(expireState, Date.now());
if (expired.expiredIds.length !== 1) {
  throw new Error("assumptions older than expirationDays must expire");
}
if (getInfluenceableAssumptions(expired.state).length !== 0) {
  throw new Error("expired must NOT be influenceable");
}
console.log("✓ periodic expiration (~90 days)");

// Contradiction: appeal approved vs unresolved
let contraState = createDefaultAssumptionRegistryState(userId + "-contra");
contraState = addAssumption(
  contraState,
  createAssumption({
    statement: "Appeal is still unresolved",
    source: "user_input",
    confidence: 0.8,
  }),
);
const contradicted = detectContradictoryInvalidations(contraState, {
  input: "The appeal was approved yesterday",
});
if (contradicted.events.length === 0) {
  throw new Error("must invalidate on contradictory appeal-approved evidence");
}
console.log("✓ contradictory evidence invalidation (appeal)");

let medState = createDefaultAssumptionRegistryState(userId + "-med");
medState = addAssumption(
  medState,
  createAssumption({
    statement: "Medication schedule is unchanged",
    source: "user_input",
    confidence: 0.8,
  }),
);
const medContra = detectContradictoryInvalidations(medState, {
  input: "The doctor adjusted the dosage this morning",
});
if (medContra.events.length === 0) {
  throw new Error("must invalidate on doctor dosage adjustment vs unchanged schedule");
}
console.log("✓ contradictory evidence invalidation (medication)");

// Care profile seed — does not merge into identity
const seeded = seedAssumptionsFromCareProfile(
  createDefaultAssumptionRegistryState(userId + "-seed"),
  {
    ...DEFAULT_CARE_PROFILE,
    roleInCareGraph: "primary_caregiver",
    workloadIntensity: "HIGH",
  },
);
if (seeded.assumptions.length < 1) {
  throw new Error("care profile role must seed registry assumptions");
}
console.log("✓ care profile role seeding (separate from identity)");

resetAssumptionRegistryStore();
const layer = processAssumptionRegistryLayer({
  telemetry_user_id: userId,
  input: "The appeal is still pending",
  careProfile: {
    ...DEFAULT_CARE_PROFILE,
    roleInCareGraph: "primary_caregiver",
  },
});
if (layer.envelope.influenceableCount < 1) {
  throw new Error("process layer must produce influenceable assumptions");
}
if (layer.envelope.compositeBias > ASSUMPTION_INFLUENCE_CAP) {
  throw new Error("composite bias must respect influence cap");
}
const guarantee = runAssumptionRegistryGuarantee({
  state: layer.state,
  envelope: layer.envelope,
});
if (!guarantee.ok) {
  throw new Error(`guarantee failed: ${guarantee.violations.join("; ")}`);
}
console.log("✓ processAssumptionRegistryLayer + influence envelope");

const payload = toAssumptionRegistryLayerPayload(layer);
if (payload.health.activeAssumptions < 1) {
  throw new Error("payload health must report active assumptions");
}
const view = toAssumptionRegistryView(payload);
if (view.source !== "assumption_registry_layer") {
  throw new Error("view model must bind to assumption_registry_layer");
}
console.log("✓ layer payload + UI view model");

const health = collectAssumptionHealth(layer);
if (health.activeAssumptions !== layer.envelope.health.activeAssumptions) {
  throw new Error("system health collector must mirror registry health");
}
console.log("✓ system health AssumptionHealth collector");

// Soft behavior bias only
const behavior = selectBehaviorProfile({ mode: "emotional_narrative" });
const weighted = applyAssumptionRegistryBehaviorWeighting(behavior, layer);
if (typeof weighted.verbosity_factor !== "number") {
  throw new Error("behavior weighting must return profile");
}
console.log("✓ soft behavior weighting");

const pipelineSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);
const memoryIdx = pipelineSource.indexOf("processMemoryInfluenceLayer({");
const assumptionIdx = pipelineSource.indexOf("processAssumptionRegistryLayer({");
const priorityIdx = pipelineSource.indexOf("processPriorityEngineLayer({");
if (!(memoryIdx > 0 && assumptionIdx > memoryIdx && priorityIdx > assumptionIdx)) {
  throw new Error(
    "assumption registry must wire after memory influence and before priority engine",
  );
}
if (!pipelineSource.includes("assumptionEnvelope: assumptionRegistryLayer.envelope")) {
  throw new Error("priority engine must consume assumptionEnvelope");
}
if (!pipelineSource.includes("assumptionRegistryLayer: refreshedAssumptionRegistry")) {
  throw new Error("system health must receive assumption registry layer");
}

const sidebarSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/ui-runtime/contract-constants.ts"),
  "utf-8",
);
if (/assumptions/i.test(sidebarSource) && /SIDEBAR_SECTION_IDS/.test(sidebarSource)) {
  const sectionBlock = sidebarSource.slice(
    sidebarSource.indexOf("SIDEBAR_SECTION_IDS"),
    sidebarSource.indexOf("SIDEBAR_SECTION_IDS") + 400,
  );
  if (/\bassumptions\b/i.test(sectionBlock)) {
    throw new Error("must NOT add a dedicated assumptions sidebar section");
  }
}
console.log("✓ analyze pipeline wiring + no dedicated sidebar section");

// Stale influence warning text
let staleState = createDefaultAssumptionRegistryState(userId + "-stale", {
  staleDays: 1,
  expirationDays: 90,
});
const staleAssumption = createAssumption({
  statement: "Insurance/coverage issue still pending",
  source: "user_input",
  confidence: 0.7,
  nowMs: Date.now() - 5 * 24 * 60 * 60 * 1000,
});
staleState = addAssumption(staleState, {
  ...staleAssumption,
  lastCheckedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
});
const staleEnvelope = computeAssumptionInfluenceEnvelope(staleState, Date.now());
if (staleEnvelope.health.staleAssumptions < 1) {
  throw new Error("stale assumptions must be counted in health");
}
const staleView = toAssumptionRegistryView({
  influenceableCount: staleEnvelope.influenceableCount,
  compositeBias: staleEnvelope.compositeBias,
  staleInfluenceCount: staleEnvelope.staleInfluenceCount,
  health: staleEnvelope.health,
  influenceHints: staleEnvelope.influenceHints,
  recentInvalidations: [],
});
if (!staleView.staleWarning?.includes("Decision quality may be reduced")) {
  throw new Error("stale warning must match system health warning language");
}
console.log("✓ stale assumption health warning");

console.log("\n✓ Assumption Registry enforced");
